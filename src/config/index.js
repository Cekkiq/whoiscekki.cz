require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  smtp: {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || '465',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    secure: process.env.SMTP_SECURE || 'tls',
  },
  uploadLimit: process.env.UPLOAD_LIMIT || 2147483648,
  defaultAdminEmail: process.env.DEFAULT_ADMIN_EMAIL,
  defaultAdminPass: process.env.DEFAULT_ADMIN_PASS,
  clicker: {
    baseChance: 0.002,
    luckBonusPerLevel: 0.001,
  },
};