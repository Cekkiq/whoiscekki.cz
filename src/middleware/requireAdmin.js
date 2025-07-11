const User = require('../models/User');

module.exports = async function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(403).render('access-denied', { title: 'Access Denied' });
  }
  const user = await User.findById(req.session.userId);
  if (!user || (user.role !== 'admin' && user.role !== 'headadmin')) {
    return res.status(403).render('access-denied', { title: 'Access Denied' });
  }
  next();
}; 