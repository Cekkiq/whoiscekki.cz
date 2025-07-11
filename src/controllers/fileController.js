const File = require('../models/File');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const fs = require('fs');

const upload = multer({
  dest: path.join(__dirname, '../uploads'),
  limits: { fileSize: process.env.UPLOAD_LIMIT || 2147483648 },
});

exports.uploadMiddleware = upload.single('file');

exports.dashboard = async (req, res) => {
  const files = await File.findByOwner(req.session.userId);
  res.render('file/dashboard', { title: 'My Cloud', files });
};

exports.uploadFile = async (req, res) => {
  if (!req.file) {
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }
    return res.render('file/dashboard', { title: 'My Cloud', error: 'No file uploaded.' });
  }
  await File.create({
    owner: req.session.userId,
    originalName: req.file.originalname,
    filePath: req.file.filename,
    size: req.file.size,
  });
  if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
    return res.json({ success: true });
  }
  res.redirect('/FileAccess');
};

exports.downloadFile = async (req, res) => {
  const file = await File.findById(req.params.id);
  if (!file || file.owner != req.session.userId) return res.status(404).send('File not found');
  res.download(require('path').join(__dirname, '../uploads', file.filePath), file.originalName);
};

exports.deleteFile = async (req, res) => {
  const file = await File.findById(req.params.id);
  if (!file || file.owner != req.session.userId) return res.status(404).send('File not found');
  require('fs').unlinkSync(require('path').join(__dirname, '../uploads', file.filePath));
  await File.deleteById(file.id);
  res.redirect('/FileAccess');
};

exports.shareFile = async (req, res) => {
  const { expiresIn, password } = req.body;
  const file = await File.findById(req.params.id);
  if (!file || file.owner != req.session.userId) return res.status(404).send('File not found');
  file.shared_publicToken = require('crypto').randomBytes(16).toString('hex');
  if (expiresIn) file.shared_expiresAt = new Date(Date.now() + parseInt(expiresIn) * 60 * 60 * 1000).toISOString();
  if (password) file.shared_password = await require('bcrypt').hash(password, 10);
  await File.update(file);
  res.redirect('/FileAccess');
};

exports.publicLink = async (req, res) => {
  const file = await File.findByPublicToken(req.params.token);
  if (!file) return res.status(404).send('File not found');
  if (file.shared_expiresAt && new Date(file.shared_expiresAt) < Date.now()) return res.status(403).send('Link expired');
  if (file.shared_password) {
    if (req.method === 'POST') {
      const { password } = req.body;
      const match = await require('bcrypt').compare(password, file.shared_password);
      if (!match) return res.render('file/public', { title: 'Shared File', error: 'Wrong password', file: null });
      return res.download(require('path').join(__dirname, '../uploads', file.filePath), file.originalName);
    }
    return res.render('file/public', { title: 'Shared File', file, requirePassword: true });
  }
  res.download(require('path').join(__dirname, '../uploads', file.filePath), file.originalName);
};

exports.unshareFile = async (req, res) => {
  const file = await File.findById(req.params.id);
  if (!file || file.owner != req.session.userId) return res.status(404).send('File not found');
  file.shared_publicToken = null;
  file.shared_expiresAt = null;
  file.shared_password = null;
  await File.update(file);
  res.redirect('/FileAccess');
}; 