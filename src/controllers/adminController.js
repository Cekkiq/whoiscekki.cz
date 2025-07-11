const InviteToken = require('../models/InviteToken');
const User = require('../models/User');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const config = require('../config');

exports.dashboard = async (req, res) => {
  let invites = await InviteToken.findAll();
  let users = await User.findAll();
  // Sort: headadmin(s) first, then admins, then users
  users = users.sort((a, b) => {
    const roleOrder = { headadmin: 0, admin: 1, user: 2 };
    return roleOrder[a.role] - roleOrder[b.role];
  });
  res.render('admin/dashboard', { title: 'Admin Panel', invites, users, userRole: res.locals.userRole, userId: res.locals.userId });
};

exports.createInvite = async (req, res) => {
  const token = crypto.randomBytes(16).toString('hex');
  await InviteToken.create({ token });
  res.redirect('/AdminPanel');
};

exports.sendInviteEmail = async (req, res) => {
  const { email, token } = req.body;
  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
    secure: config.smtp.secure === 'true' || config.smtp.secure === true
  });
  const link = `${req.protocol}://${req.get('host')}/Account/Register?token=${token}`;
  const mailOptions = {
    from: config.smtp.user,
    to: email,
    subject: 'Your Invitation to WhoisCekki.cz',
    html: `<p>You have been invited. Register here: <a href="${link}">${link}</a></p>`
  };
  console.log('[MAIL][Invite] Attempting to send email:', mailOptions);
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('[MAIL][Invite] Email sent successfully:', info.response);
    res.redirect('/AdminPanel');
  } catch (error) {
    console.error('[MAIL][Invite] Error sending email:', error);
    // Render main dashboard with error
    const invites = await InviteToken.findAll();
    const users = await User.findAll();
    res.render('admin/dashboard', { title: 'Admin Panel', invites, users, error: error.message });
  }
};

exports.activateUser = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (user) {
    user.isActive = 1;
    await User.update(user);
  }
  res.redirect('/AdminPanel');
};

exports.deactivateUser = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (user) {
    user.isActive = 0;
    await User.update(user);
  }
  res.redirect('/AdminPanel');
};

exports.deleteUser = async (req, res) => {
  await User.deleteById(req.params.id);
  res.redirect('/AdminPanel');
};

exports.changeRole = async (req, res) => {
  const { role } = req.body;
  const user = await User.findById(req.params.id);
  const currentUser = await User.findById(req.session.userId);
  // Only headadmin can change roles, and not their own, and cannot promote anyone to headadmin
  if (currentUser.role === 'headadmin' && user.id !== currentUser.id && role !== 'headadmin') {
    user.role = role;
    await User.update(user);
  }
  res.redirect('/AdminPanel');
};

exports.impersonateUser = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (user && user.role !== 'headadmin') {
    req.session.userId = user.id;
    return res.redirect('/Account/Manage');
  }
  // If trying to impersonate headadmin, do nothing
  res.redirect('/AdminPanel');
};

exports.deleteInvite = async (req, res) => {
  await InviteToken.deleteByToken(req.params.token);
  res.redirect('/AdminPanel');
}; 