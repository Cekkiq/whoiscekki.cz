const InviteToken = require('../models/InviteToken');
const User = require('../models/User');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const config = require('../config');
const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const SpecialCode = require('../models/SpecialCode');
const ClickerScore = require('../models/ClickerScore');

exports.dashboard = async (req, res) => {
  try {
    let invites = await InviteToken.findAll();
    let users = await User.findAll();
    const plans = await new Promise((resolve) => {
      db.all('SELECT id, name FROM subscriptions ORDER BY price ASC', [], (err, rows) => {
        if (err) return resolve([]);
        resolve(rows || []);
      });
    });

    const usersWithScores = await Promise.all(users.map(async (user) => {
      const score = await new Promise((resolve) => {
        db.get('SELECT score FROM clicker_scores WHERE user = ?', [user.id], (err, row) => {
          if (err || !row) return resolve({ score: 0 });
          resolve(row);
        });
      });
      return {
        ...user,
        score: score ? score.score : 0
      };
    }));

    users = usersWithScores;

    // Sort: headadmin(s) first, then admins, then users
    users = users.sort((a, b) => {
      const roleOrder = { headadmin: 0, admin: 1, user: 2 };
      return roleOrder[a.role] - roleOrder[b.role];
    });

    // Only load special codes if user is headadmin
    let specialCodes = [];
    if (res.locals.userRole === 'headadmin') {
      specialCodes = await SpecialCode.getAll();
    }

    res.render('admin/dashboard', { 
      title: 'Admin Panel', 
      invites, 
      users, 
      plans, 
      specialCodes,
      user: {
        role: res.locals.userRole,
        id: res.locals.userId
      },
      userRole: res.locals.userRole, 
      userId: res.locals.userId 
    });
  } catch (error) {
    console.error('Error in admin dashboard:', error);
    res.status(500).send('Internal Server Error');
  }
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
    const plans = await new Promise((resolve) => {
      db.all('SELECT id, name FROM subscriptions ORDER BY price ASC', [], (err, rows) => {
        if (err) return resolve([]);
        resolve(rows || []);
      });
    });
    res.render('admin/dashboard', { title: 'Admin Panel', invites, users, plans, error: error.message, userRole: res.locals.userRole, userId: res.locals.userId });
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

exports.changeSubscription = async (req, res) => {
  const currentUser = await User.findById(req.session.userId);
  const target = await User.findById(req.params.id);
  const { subscription_id } = req.body;
  if (currentUser && currentUser.role === 'headadmin' && target) {
    target.subscription_id = Number(subscription_id) || 1;
    await User.update(target);
  }
  res.redirect('/AdminPanel');
};

exports.specialCodes = async (req, res) => {
  try {
    const codes = await SpecialCode.getAll();
    res.render('admin/special-codes', { 
      title: 'Special Codes',
      codes,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error fetching special codes:', error);
    res.status(500).send('Error loading special codes');
  }
};

exports.updateUserScore = async (req, res) => {
  try {
    if (res.locals.userRole !== 'headadmin') {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const userId = req.params.id; // Changed from destructuring to use req.params.id
    const { score } = req.body;

    if (!userId || isNaN(parseInt(score))) {
      console.log('Invalid input:', { userId, score }); // Add logging for debugging
      return res.status(400).json({ success: false, error: 'Invalid input' });
    }

    await ClickerScore.updateByUserId(userId, parseInt(score));
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating user score:', error);
    res.status(500).json({ success: false, error: 'Failed to update score' });
  }
};

exports.createSpecialCode = async (req, res) => {
  try {
    const { code, gbAmount, maxUses } = req.body;
    
    if (!code || !gbAmount) {
      return res.status(400).json({ success: false, error: 'Code and GB amount are required' });
    }

    const gbValue = parseFloat(gbAmount);
    if (isNaN(gbValue) || gbValue <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid GB amount' });
    }

    const uses = maxUses ? parseInt(maxUses) : 1;
    if (uses < 1) {
      return res.status(400).json({ success: false, error: 'Max uses must be at least 1' });
    }

    await SpecialCode.create({
      code,
      gbAmount: gbValue,
      maxUses: uses,
      createdBy: req.session.userId
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error creating special code:', error);
    if (error.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({ success: false, error: 'Code already exists' });
    }
    res.status(500).json({ success: false, error: 'Error creating code' });
  }
};

exports.deleteSpecialCode = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await SpecialCode.delete(id);
    
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Code not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting special code:', error);
    res.status(500).json({ success: false, error: 'Error deleting code' });
  }
};