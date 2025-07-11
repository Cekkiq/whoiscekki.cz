module.exports = function requireLogin(req, res, next) {
  if (!req.session || !req.session.userId) {
    const returnUrl = encodeURIComponent(req.originalUrl);
    return res.redirect(`/Account/Login?ReturnUrl=${returnUrl}`);
  }
  next();
}; 