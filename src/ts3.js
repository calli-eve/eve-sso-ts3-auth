const { TeamSpeak, QueryProtocol, TextMessageTargetMode } = require('ts3-nodejs-library')
const db   = require('./db/queries')
const pool = require('./db/pool')

let ts3 = null

async function connect() {
  console.log('[TS3] Connecting to ServerQuery...')

  ts3 = await TeamSpeak.connect({
    protocol:   QueryProtocol.RAW,
    host:       process.env.TS3_HOST       || '127.0.0.1',
    queryport:  parseInt(process.env.TS3_QUERY_PORT  || '10011'),
    serverport: parseInt(process.env.TS3_SERVER_PORT || '9987'),
    username:   process.env.TS3_USERNAME,
    password:   process.env.TS3_PASSWORD,
    nickname:   process.env.TS3_BOT_NICKNAME || 'AuthBot',
    keepAlive:  true,
  })

  await ts3.registerEvent('textprivate')
  await ts3.registerEvent('textchannel')
  await ts3.registerEvent('textserver')

  ts3.on('textmessage', handleTextMessage)

  ts3.on('error', (err) => {
    console.error('[TS3] Error:', err.message)
  })

  ts3.on('close', async () => {
    console.warn('[TS3] Connection closed. Reconnecting in 10s...')
    ts3 = null
    await new Promise(r => setTimeout(r, 10000))
    connect().catch(e => console.error('[TS3] Reconnect failed:', e.message))
  })

  console.log('[TS3] Bot connected and listening for !auth commands.')
  return ts3
}

async function handleTextMessage(event) {
  // Ignore messages sent by the bot itself
  if (event.invoker.clid === undefined) return
  try {
    const self = await ts3.whoami()
    if (event.invoker.clid === self.clientId) return
  } catch (_) {}


  const msg     = event.msg.trim()
  const invoker = event.invoker

  if (!msg.startsWith('!auth ') && msg !== '!auth') return

  const tokenStr = msg.slice(6).trim()

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(tokenStr)) {
    return sendPrivateMessage(invoker, 'Invalid token format. Usage: !auth <your-token>')
  }

  try {
    const tokenRecord = await db.claimToken(tokenStr)

    if (!tokenRecord) {
      return sendPrivateMessage(invoker, 'Token not found, already used, or expired. Please log in again to get a new token.')
    }

    const clientDbId = invoker.databaseId
    const groupIds   = tokenRecord.ts3_group_ids
    const errors     = []

    for (const groupId of groupIds) {
      try {
        await ts3.serverGroupAddClient(clientDbId, groupId)
      } catch (e) {
        if (e.id !== 2561) {  // 2561 = already in group, not an error
          errors.push(`group ${groupId}: ${e.message}`)
          console.error(`[TS3] Failed to assign group ${groupId} to dbid ${clientDbId}:`, e.message)
        }
      }
    }

    await db.updateTokenWithTs3Client(tokenStr, clientDbId)

    const charRow = await pool.query(
      'SELECT character_name FROM eve_characters WHERE character_id=$1',
      [tokenRecord.character_id]
    )
    const characterName = charRow.rows[0]?.character_name || 'Unknown'

    await db.insertLog({
      characterId:     tokenRecord.character_id,
      characterName,
      ts3ClientDbId:   clientDbId,
      ts3Nickname:     invoker.nickname,
      token:           tokenStr,
      groupsAssigned:  groupIds,
      eventType:       'token_used',
      detail:          errors.length ? `errors: ${errors.join('; ')}` : null,
    })

    if (errors.length) {
      await sendPrivateMessage(invoker,
        `Auth partially completed. Some groups could not be assigned. Contact an admin. Errors: ${errors.join(', ')}`)
    } else {
      await sendPrivateMessage(invoker,
        `Auth successful! Welcome, ${characterName}! You have been assigned ${groupIds.length} role(s).`)
    }

  } catch (err) {
    console.error('[TS3] handleTextMessage error:', err)
    await sendPrivateMessage(invoker, 'An internal error occurred during auth. Please contact an admin.')
  }
}

async function sendPrivateMessage(client, message) {
  if (!ts3) return
  try {
    await ts3.sendTextMessage(client.clid, TextMessageTargetMode.CLIENT, message)
  } catch (e) {
    console.error('[TS3] sendPrivateMessage failed:', e.message)
  }
}

async function getServerGroups() {
  if (!ts3) return null
  try {
    const groups = await ts3.serverGroupList()
    // Filter out template groups (type 0) and query groups (type 2), keep regular groups (type 1)
    return groups
      .filter(g => g.type === 1)
      .map(g => ({ id: g.sgid, name: g.name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  } catch (e) {
    console.error('[TS3] getServerGroups failed:', e.message)
    return null
  }
}

module.exports = { connect, getServerGroups }
