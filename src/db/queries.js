const pool = require('./pool')

// ---- Characters ----

async function upsertCharacter({ characterId, characterName, corporationId, allianceId, accessToken, refreshToken, tokenExpiry }) {
  const sql = `
    INSERT INTO eve_characters
      (character_id, character_name, corporation_id, alliance_id, access_token, refresh_token, token_expiry, last_seen)
    VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
    ON CONFLICT (character_id) DO UPDATE SET
      character_name = EXCLUDED.character_name,
      corporation_id = EXCLUDED.corporation_id,
      alliance_id    = EXCLUDED.alliance_id,
      access_token   = EXCLUDED.access_token,
      refresh_token  = EXCLUDED.refresh_token,
      token_expiry   = EXCLUDED.token_expiry,
      last_seen      = NOW()
    RETURNING *`
  const { rows } = await pool.query(sql, [characterId, characterName, corporationId, allianceId, accessToken, refreshToken, tokenExpiry])
  return rows[0]
}

// ---- Mappings ----

async function getMappings() {
  const { rows } = await pool.query(`SELECT * FROM ts3_mappings ORDER BY entity_type, entity_name`)
  return rows
}

async function getMappingById(id) {
  const { rows } = await pool.query(`SELECT * FROM ts3_mappings WHERE id = $1`, [id])
  return rows[0] || null
}

async function createMapping({ entityType, entityId, entityName, ts3GroupIds }) {
  const { rows } = await pool.query(
    `INSERT INTO ts3_mappings (entity_type, entity_id, entity_name, ts3_group_ids)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [entityType, entityId, entityName, ts3GroupIds]
  )
  return rows[0]
}

async function updateMapping(id, { entityName, ts3GroupIds }) {
  const { rows } = await pool.query(
    `UPDATE ts3_mappings SET entity_name=$1, ts3_group_ids=$2 WHERE id=$3 RETURNING *`,
    [entityName, ts3GroupIds, id]
  )
  return rows[0] || null
}

async function deleteMapping(id) {
  await pool.query(`DELETE FROM ts3_mappings WHERE id=$1`, [id])
}

async function resolveGroupsForCharacter(corporationId, allianceId) {
  const sql = `
    SELECT ts3_group_ids FROM ts3_mappings
    WHERE (entity_type = 'corporation' AND entity_id = $1)
       OR (entity_type = 'alliance'    AND entity_id = $2)`
  const { rows } = await pool.query(sql, [corporationId || 0, allianceId || 0])
  const allIds = rows.flatMap(r => r.ts3_group_ids)
  return [...new Set(allIds)]
}

// ---- Tokens ----

async function createToken(characterId, ts3GroupIds) {
  const { rows } = await pool.query(
    `INSERT INTO auth_tokens (character_id, ts3_group_ids, expires_at) VALUES ($1,$2, NOW() + INTERVAL '5 minutes') RETURNING *`,
    [characterId, ts3GroupIds]
  )
  return rows[0]
}

async function getTokenIfStillPending(tokenUuid) {
  const { rows } = await pool.query(
    `SELECT * FROM auth_tokens WHERE token=$1 AND status='pending' AND expires_at > NOW()`,
    [tokenUuid]
  )
  return rows[0] || null
}

async function claimToken(tokenUuid) {
  const { rows } = await pool.query(
    `UPDATE auth_tokens
     SET status='used', used_at=NOW()
     WHERE token=$1 AND status='pending' AND expires_at > NOW()
     RETURNING *`,
    [tokenUuid]
  )
  return rows[0] || null
}

async function updateTokenWithTs3Client(tokenUuid, ts3ClientDbId) {
  await pool.query(
    `UPDATE auth_tokens SET ts3_client_db_id=$2 WHERE token=$1`,
    [tokenUuid, ts3ClientDbId]
  )
}

async function expireOldTokens() {
  await pool.query(
    `UPDATE auth_tokens SET status='expired' WHERE status='pending' AND expires_at < NOW()`
  )
}

// ---- Auth log ----

async function insertLog({ characterId, characterName, ts3ClientDbId, ts3Nickname, token, groupsAssigned, eventType, detail }) {
  await pool.query(
    `INSERT INTO auth_log
       (character_id, character_name, ts3_client_db_id, ts3_nickname, token, groups_assigned, event_type, detail)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [characterId || null, characterName || null, ts3ClientDbId || null, ts3Nickname || null,
     token || null, groupsAssigned || null, eventType, detail || null]
  )
}

async function getRecentLogs(limit = 100) {
  const { rows } = await pool.query(
    `SELECT * FROM auth_log ORDER BY created_at DESC LIMIT $1`,
    [limit]
  )
  return rows
}

// ---- Admin ----

async function isAdmin(characterId) {
  const envAdmins = (process.env.ADMIN_CHARACTER_IDS || '').split(',').map(Number).filter(Boolean)
  if (envAdmins.includes(Number(characterId))) return true
  const { rows } = await pool.query(
    `SELECT 1 FROM admin_characters WHERE character_id=$1`, [characterId]
  )
  return rows.length > 0
}

async function getAdminCharacters() {
  const { rows } = await pool.query(`SELECT * FROM admin_characters ORDER BY character_name`)
  return rows
}

async function addAdminCharacter(characterId, characterName) {
  await pool.query(
    `INSERT INTO admin_characters (character_id, character_name) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [characterId, characterName]
  )
}

async function removeAdminCharacter(characterId) {
  await pool.query(`DELETE FROM admin_characters WHERE character_id=$1`, [characterId])
}

module.exports = {
  upsertCharacter,
  getMappings, getMappingById, createMapping, updateMapping, deleteMapping, resolveGroupsForCharacter,
  createToken, getTokenIfStillPending, claimToken, updateTokenWithTs3Client, expireOldTokens,
  insertLog, getRecentLogs,
  isAdmin, getAdminCharacters, addAdminCharacter, removeAdminCharacter,
}
