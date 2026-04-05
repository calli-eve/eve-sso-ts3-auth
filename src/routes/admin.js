const router = require('express').Router()
const db     = require('../db/queries')
const ts3    = require('../ts3')

async function requireAdmin(req, res, next) {
  if (!req.isAuthenticated()) return res.redirect('/auth/eve')
  const admin = await db.isAdmin(req.user.character_id)
  if (!admin) return res.status(403).render('error', { message: 'Forbidden: you are not an admin.' })
  res.locals.isAdmin = true
  next()
}

router.use(requireAdmin)

// Dashboard
router.get('/', async (req, res, next) => {
  try {
    const [mappings, logs] = await Promise.all([db.getMappings(), db.getRecentLogs(20)])
    res.render('admin/dashboard', { user: req.user, mappings, logs })
  } catch (e) { next(e) }
})

// List mappings
router.get('/mappings', async (req, res, next) => {
  try {
    const [mappings, ts3Groups] = await Promise.all([db.getMappings(), ts3.getServerGroups()])
    res.render('admin/mappings', { user: req.user, mappings, ts3Groups, saved: req.query.saved })
  } catch (e) { next(e) }
})

// Create mapping
router.post('/mappings', async (req, res, next) => {
  try {
    const { entity_type, entity_id, entity_name, ts3_group_ids } = req.body
    // ts3_group_ids may be a single string or an array (multi-select)
    const raw = Array.isArray(ts3_group_ids) ? ts3_group_ids : [ts3_group_ids]
    const groupIds = raw.map(s => parseInt(s, 10)).filter(n => !isNaN(n) && n > 0)
    if (!groupIds.length) return res.redirect('/admin/mappings?error=invalid_groups')
    await db.createMapping({
      entityType:  entity_type,
      entityId:    parseInt(entity_id, 10),
      entityName:  entity_name,
      ts3GroupIds: groupIds,
    })
    res.redirect('/admin/mappings?saved=1')
  } catch (e) { next(e) }
})

// Edit form
router.get('/mappings/:id/edit', async (req, res, next) => {
  try {
    const [mapping, ts3Groups] = await Promise.all([db.getMappingById(req.params.id), ts3.getServerGroups()])
    if (!mapping) return res.status(404).render('error', { message: 'Mapping not found' })
    res.render('admin/mapping-edit', { user: req.user, mapping, ts3Groups })
  } catch (e) { next(e) }
})

// Update mapping
router.post('/mappings/:id/edit', async (req, res, next) => {
  try {
    const { entity_name, ts3_group_ids } = req.body
    const raw = Array.isArray(ts3_group_ids) ? ts3_group_ids : [ts3_group_ids]
    const groupIds = raw.map(s => parseInt(s, 10)).filter(n => !isNaN(n) && n > 0)
    if (!groupIds.length) return res.redirect(`/admin/mappings/${req.params.id}/edit?error=invalid_groups`)
    await db.updateMapping(req.params.id, { entityName: entity_name, ts3GroupIds: groupIds })
    res.redirect('/admin/mappings?saved=1')
  } catch (e) { next(e) }
})

// Delete mapping
router.post('/mappings/:id/delete', async (req, res, next) => {
  try {
    await db.deleteMapping(req.params.id)
    res.redirect('/admin/mappings')
  } catch (e) { next(e) }
})

// Auth logs
router.get('/logs', async (req, res, next) => {
  try {
    const logs = await db.getRecentLogs(200)
    res.render('admin/logs', { user: req.user, logs })
  } catch (e) { next(e) }
})

// Admin characters
router.get('/admins', async (req, res, next) => {
  try {
    const admins = await db.getAdminCharacters()
    res.render('admin/admins', { user: req.user, admins })
  } catch (e) { next(e) }
})

router.post('/admins', async (req, res, next) => {
  try {
    const { character_id, character_name } = req.body
    await db.addAdminCharacter(parseInt(character_id, 10), character_name)
    res.redirect('/admin/admins')
  } catch (e) { next(e) }
})

router.post('/admins/:id/delete', async (req, res, next) => {
  try {
    await db.removeAdminCharacter(parseInt(req.params.id, 10))
    res.redirect('/admin/admins')
  } catch (e) { next(e) }
})

module.exports = router
