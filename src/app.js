require('dotenv').config()

const express    = require('express')
const session    = require('express-session')
const pgSession  = require('connect-pg-simple')(session)
const passport   = require('passport')
const path       = require('path')
const fs         = require('fs')
const { Eta }    = require('eta')

const pool               = require('./db/pool')
const { expireOldTokens } = require('./db/queries')

require('./auth')  // register passport strategy

const app = express()
const eta = new Eta({
  views: path.join(__dirname, '../views'),
  cache: process.env.NODE_ENV === 'production',
})

app.use(express.urlencoded({ extended: false }))
app.use(express.json())
app.use(express.static(path.join(__dirname, '../public')))

app.use(session({
  store: new pgSession({ pool, tableName: 'session' }),
  secret: process.env.SESSION_SECRET || 'changeme-set-SESSION_SECRET-in-env',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
  },
}))

app.use(passport.initialize())
app.use(passport.session())

// Attach render helper that wraps Eta
app.use((req, res, next) => {
  res.render = (view, data = {}) => {
    try {
      const html = eta.render(view, { ...data, currentUser: req.user || null })
      res.send(html)
    } catch (e) {
      next(e)
    }
  }
  next()
})

app.use('/auth',  require('./routes/auth'))
app.use('/admin', require('./routes/admin'))
app.use('/',      require('./routes/index'))

// Error handler
app.use((err, req, res, _next) => {
  console.error(err)
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal Server Error'
    : (err.stack || err.message || 'Internal Server Error')
  res.status(500).render('error', { message })
})

// Background: sweep expired tokens every 5 minutes
setInterval(async () => {
  try { await expireOldTokens() }
  catch (e) { console.error('Token expiry sweep error:', e) }
}, 5 * 60 * 1000)

async function main() {
  // Apply DB schema (idempotent CREATE IF NOT EXISTS)
  const schema = fs.readFileSync(path.join(__dirname, 'db/schema.sql'), 'utf8')
  await pool.query(schema)
  console.log('Database schema applied.')

  // Start TS3 bot (non-fatal if TS3 is unavailable at startup)
  const ts3 = require('./ts3')
  ts3.connect().catch(err => {
    console.error('[TS3] Initial connection failed (will not retry automatically):', err.message)
  })

  const PORT = parseInt(process.env.PORT || '3000')
  app.listen(PORT, () => console.log(`Web app listening on port ${PORT}`))
}

main().catch(err => {
  console.error('Fatal startup error:', err)
  process.exit(1)
})
