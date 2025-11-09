const User = require('../models/User');
const InviteToken = require('../models/InviteToken');
const jwt = require('jsonwebtoken');
const config = require('../config');
const nodemailer = require('nodemailer');
const speakeasy = require('speakeasy');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const fetch = require('node-fetch').default;

exports.register = async (req, res) => {
  const { invite, email, password } = req.body;
  const tokenDoc = await InviteToken.findOne({ token: invite, used: false });
  if (!tokenDoc) return res.render('register', { title: 'Register', token: invite, error: 'Invalid or used invitation token.' });
  const existing = await User.findByEmail(email);
  if (existing) return res.render('register', { title: 'Register', token: invite, error: 'Email already registered.' });
  const activationToken = crypto.randomBytes(20).toString('hex');
  const user = await User.create({ email, password, isActive: false, activationToken });
  await InviteToken.markUsed(invite, user.id);
  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
    secure: config.smtp.secure === 'true' || config.smtp.secure === true
  });
  const link = `${req.protocol}://${req.get('host')}/Account/Activate/${activationToken}`;
  const mailOptions = {
    from: config.smtp.user,
    to: email,
    subject: 'Activate your WhoisCekki.cz account',
    html: `<p>Click to activate: <a href="${link}">${link}</a></p>`
  };
  console.log('[MAIL][Activation] Attempting to send email:', mailOptions);
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('[MAIL][Activation] Email sent successfully:', info.response);
    res.render('login', { title: 'Login', info: 'Activation email sent. Please check your inbox.' });
  } catch (error) {
    console.error('[MAIL][Activation] Error sending email:', error);
    res.render('register', { title: 'Register', token: invite, error: error.message });
  }
};

exports.activate = async (req, res) => {
  const { token } = req.params;
  const user = await User.findByActivationToken(token);
  if (!user) {
    return res.render('login', { title: 'Login', error: 'Invalid or expired activation link.' });
  }
  user.isActive = 1;
  user.activationToken = null;
  await User.update(user);
  res.render('login', { title: 'Login', info: 'Account activated. You can now log in.' });
};

exports.login = async (req, res) => {
  const { email, password, ReturnUrl } = req.body;
  const user = await User.findByEmail(email);
  if (!user) return res.render('login', { title: 'Login', error: 'Invalid credentials.', ReturnUrl });
  if (!user.isActive) return res.render('login', { title: 'Login', error: 'Account not activated.', ReturnUrl });
  if (user.lockedUntil && new Date(user.lockedUntil) > Date.now()) return res.render('login', { title: 'Login', error: 'Account is locked. Try again later.', ReturnUrl });
  const valid = await User.comparePassword(password, user.password);
  if (!valid) {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    if (user.failedLoginAttempts >= 5) {
      user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      await User.update(user);
      return res.render('login', { title: 'Login', error: 'Account locked due to too many failed attempts.', ReturnUrl });
    }
    await User.update(user);
    return res.render('login', { title: 'Login', error: 'Invalid credentials.', ReturnUrl });
  }
  if (user.twoFA_enabled) {
    req.session.pending2FA = user.id;
    return res.redirect('/Account/2fa/verify-login');
  }
  user.failedLoginAttempts = 0;
  user.lastLogin = new Date().toISOString();
  await User.update(user);
  req.session.userId = user.id;
  if (ReturnUrl && /^\//.test(ReturnUrl)) {
    return res.redirect(ReturnUrl);
  }
  res.redirect('/Account/Manage');
};

exports.verify2FALogin = async (req, res) => {
  const { code } = req.body;
  const userId = req.session.pending2FA;
  if (!userId) return res.redirect('/Account/Login');
  const user = await User.findById(userId);
  if (!user || !user.twoFA_enabled) return res.redirect('/Account/Login');
  const verified = speakeasy.totp.verify({
    secret: user.twoFA_secret,
    encoding: 'base32',
    token: code,
  });
  if (!verified) return res.render('2fa-verify', { title: '2FA Verification', error: 'Invalid 2FA code.' });
  user.failedLoginAttempts = 0;
  user.lastLogin = new Date().toISOString();
  await User.update(user);
  req.session.userId = user.id;
  delete req.session.pending2FA;
  res.redirect('/Account/Manage');
};

exports.setup2FA = async (req, res) => {
  const user = await User.findById(req.session.userId);
  if (!user) return res.redirect('/Account/Login');
  const secret = speakeasy.generateSecret();
  console.log('[2FA][Setup] Creating 2FA for user:', user.id, 'Secret:', secret.base32, 'otpauth_url:', secret.otpauth_url);
  user.twoFA_secret = secret.base32;
  await User.update(user);
  res.render('2fa-setup', { title: '2FA Setup', otpauth_url: secret.otpauth_url, secret: secret.base32 });
};

exports.verify2FA = async (req, res) => {
  const { code } = req.body;
  const user = await User.findById(req.session.userId);
  if (!user) return res.redirect('/Account/Login');
  const verified = speakeasy.totp.verify({
    secret: user.twoFA_secret,
    encoding: 'base32',
    token: code,
  });
  if (verified) {
    user.twoFA_enabled = 1;
    await User.update(user);
    res.redirect('/Account/Manage');
  } else {
    res.render('2fa-setup', { title: '2FA Setup', secret: user.twoFA_secret, error: 'Invalid code.' });
  }
};

exports.getRegister = (req, res) => {
  const token = req.query.token || '';
  res.render('register', { title: 'Register', token });
};

exports.getLogin = (req, res) => {
  const ReturnUrl = req.query.ReturnUrl || '';
  res.render('login', { title: 'Login', ReturnUrl });
};

exports.get2FAVerify = (req, res) => {
  res.render('2fa-verify', { title: '2FA Verification' });
};

exports.getManage = async (req, res) => {
  const user = await User.findById(req.session.userId);
  if (!user) return res.redirect('/Account/Login');
  res.render('manage', { title: 'Account Management', user });
};

exports.updateAccount = async (req, res) => {
  const user = await User.findById(req.session.userId);
  if (!user) return res.redirect('/Account/Login');
  const { email, password, action, currentPassword, oldPassword } = req.body;
  // Change email: require current password
  if (action === 'changeEmail' && email && currentPassword) {
    const valid = await User.comparePassword(currentPassword, user.password);
    if (!valid) {
      return res.render('manage/email', { title: 'Change Email', user, error: 'Incorrect password.' });
    }
    user.email = email;
    await User.update(user);
    req.session.destroy(() => {
      res.redirect('/Account/Login');
    });
    return;
  }
  // Change password: require old password
  if (action === 'changePassword' && password && oldPassword) {
    const valid = await User.comparePassword(oldPassword, user.password);
    if (!valid) {
      return res.render('manage/password', { title: 'Change Password', user, error: 'Incorrect old password.' });
    }
    user.password = await bcrypt.hash(password, 10);
    await User.update(user);
    req.session.destroy(() => {
      res.redirect('/Account/Login');
    });
    return;
  }
  if (action === 'disable2FA') {
    user.twoFA_enabled = 0;
    user.twoFA_secret = null;
    await User.update(user);
    return res.render('manage/twofa', { title: 'Two-factor authentication', user, info: '2FA disabled.' });
  }
  if (action === 'exportData') {
    res.setHeader('Content-Disposition', 'attachment; filename="userdata.json"');
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      email: user.email,
      registeredAt: user.registeredAt,
      lastLogin: user.lastLogin,
      role: user.role,
      isActive: user.isActive,
    }, null, 2));
  }
  if (action === 'deleteAccount') {
    await User.deleteById(user.id);
    req.session.destroy(() => {
      res.redirect('/');
    });
    return;
  }
  res.render('manage/profile', { title: 'Profile', user, error: 'Invalid action.' });
};

exports.getManageProfile = async (req, res) => {
  const user = await User.findById(req.session.userId);
  if (!user) return res.redirect('/Account/Login');
  res.render('manage/profile', { title: 'Profile', user });
};
exports.getManageEmail = async (req, res) => {
  const user = await User.findById(req.session.userId);
  if (!user) return res.redirect('/Account/Login');
  res.render('manage/email', { title: 'Change Email', user });
};
exports.getManagePassword = async (req, res) => {
  const user = await User.findById(req.session.userId);
  if (!user) return res.redirect('/Account/Login');
  res.render('manage/password', { title: 'Change Password', user });
};
exports.getManageTwoFA = async (req, res) => {
  const user = await User.findById(req.session.userId);
  if (!user) return res.redirect('/Account/Login');
  res.render('manage/twofa', { title: 'Two-factor authentication', user });
};
exports.getManageData = async (req, res) => {
  const user = await User.findById(req.session.userId);
  if (!user) return res.redirect('/Account/Login');
  res.render('manage/data', { title: 'Personal data', user });
}; 