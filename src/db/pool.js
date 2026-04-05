const { Pool } = require('pg')

const pool = new Pool({
  host:     process.env.PGHOST     || 'db',
  port:     parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE || 'ts3auth',
  user:     process.env.PGUSER     || 'ts3auth',
  password: process.env.PGPASSWORD,
  max: 10,
})

pool.on('error', (err) => {
  console.error('Unexpected pg pool error', err)
})

module.exports = pool
