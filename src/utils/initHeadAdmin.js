const User = require('../models/User');
const config = require('../config');

async function initHeadAdmin() {
  const headadmin = await User.findByEmail(config.defaultAdminEmail);
  if (!headadmin) {
    await User.create({
      email: config.defaultAdminEmail,
      password: config.defaultAdminPass,
      role: 'headadmin',
      isActive: true,
      twoFA_enabled: 0,
      twoFA_secret: null
    });
    console.log('Default headadmin account created.');
  }
}

module.exports = initHeadAdmin; 