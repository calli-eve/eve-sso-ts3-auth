const passport       = require('passport')
const OAuth2Strategy = require('passport-oauth2')
const jwt            = require('jsonwebtoken')
const jwksClient     = require('jwks-rsa')
const db             = require('./db/queries')
const esi            = require('./esi')

const JWKS_URI = 'https://login.eveonline.com/oauth/jwks'

const jwks = jwksClient({
  jwksUri: JWKS_URI,
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 5,
})

function getSigningKey(header) {
  return new Promise((resolve, reject) => {
    jwks.getSigningKey(header.kid, (err, key) => {
      if (err) return reject(err)
      resolve(key.getPublicKey())
    })
  })
}

async function verifyEveJwt(token) {
  const decoded = jwt.decode(token, { complete: true })
  if (!decoded) throw new Error('Failed to decode EVE SSO JWT')
  const signingKey = await getSigningKey(decoded.header)
  return jwt.verify(token, signingKey, {
    issuer: ['login.eveonline.com', 'https://login.eveonline.com'],
    algorithms: ['RS256'],
  })
}

passport.use('eve-sso', new OAuth2Strategy(
  {
    authorizationURL: 'https://login.eveonline.com/v2/oauth/authorize',
    tokenURL:         'https://login.eveonline.com/v2/oauth/token',
    clientID:         process.env.EVE_CLIENT_ID,
    clientSecret:     process.env.EVE_CLIENT_SECRET,
    callbackURL:      process.env.EVE_CALLBACK_URL,
    scope:            [],
    state:            true,
  },
  async (accessToken, refreshToken, params, profile, done) => {
    try {
      const claims = await verifyEveJwt(accessToken)

      // sub format: "CHARACTER:EVE:12345678"
      const characterId = parseInt(claims.sub.split(':')[2], 10)
      const characterName = claims.name

      const charInfo = await esi.getCharacterInfo(characterId)
      const corporationId = charInfo.corporation_id
      const allianceId    = charInfo.alliance_id || null

      const character = await db.upsertCharacter({
        characterId,
        characterName,
        corporationId,
        allianceId,
        accessToken,
        refreshToken,
        tokenExpiry: new Date(claims.exp * 1000),
      })

      return done(null, character)
    } catch (err) {
      console.error('[auth] EVE SSO callback error:', err)
      return done(err)
    }
  }
))

passport.serializeUser((user, done) => done(null, user.character_id))

passport.deserializeUser(async (id, done) => {
  try {
    const pool = require('./db/pool')
    const { rows } = await pool.query(
      'SELECT * FROM eve_characters WHERE character_id = $1', [id]
    )
    done(null, rows[0] || false)
  } catch (e) {
    done(e)
  }
})
