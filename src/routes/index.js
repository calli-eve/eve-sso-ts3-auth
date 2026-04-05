const router = require('express').Router()
const db     = require('../db/queries')

router.get('/', async (req, res, next) => {
  try {
    if (!req.isAuthenticated()) {
      return res.render('index', { user: null, token: null, error: req.query.error || null })
    }

    const { character_id, character_name, corporation_id, alliance_id } = req.user

    // Re-use pending token from this session if still valid
    let tokenRecord = null
    if (req.session.pendingToken) {
      tokenRecord = await db.getTokenIfStillPending(req.session.pendingToken)
    }

    if (!tokenRecord) {
      delete req.session.pendingToken

      const groupIds = await db.resolveGroupsForCharacter(corporation_id, alliance_id)

      if (groupIds.length === 0) {
        await db.insertLog({
          characterId: character_id,
          characterName: character_name,
          eventType: 'no_mapping',
          detail: `corp=${corporation_id} alliance=${alliance_id}`,
        })
        return res.render('index', { user: req.user, token: null, noMapping: true })
      }

      tokenRecord = await db.createToken(character_id, groupIds)
      req.session.pendingToken = tokenRecord.token

      await db.insertLog({
        characterId: character_id,
        characterName: character_name,
        token: tokenRecord.token,
        eventType: 'token_issued',
        detail: `groups=${groupIds.join(',')}`,
      })
    }

    const isAdmin = await db.isAdmin(character_id)

    res.render('index', {
      user: req.user,
      token: tokenRecord.token,
      expiresAt: tokenRecord.expires_at,
      isAdmin,
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
