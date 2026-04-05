const router   = require('express').Router()
const passport = require('passport')

router.get('/eve', passport.authenticate('eve-sso'))

router.get('/callback',
  passport.authenticate('eve-sso', { failureRedirect: '/?error=auth_failed' }),
  (req, res) => res.redirect('/')
)

router.post('/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err)
    req.session.destroy(() => res.redirect('/'))
  })
})

module.exports = router
