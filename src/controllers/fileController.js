const File = require('../models/File');
const User = require('../models/User');
const db = require('../config/db');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const path = require('path');
let archiver;

async function getBonusGb(userId) {
  return new Promise((resolve) => {
    db.get('SELECT bonus_gb FROM user_storage_bonus WHERE user=?', [userId], (err, row) => {
      if (err) return resolve(0);
      resolve(row ? Number(row.bonus_gb || 0) : 0);
    });
  });
}

async function ensureAddBonus(userId, gb) {
  return new Promise((resolve) => {
    db.run(
      'INSERT INTO user_storage_bonus (user, bonus_gb) VALUES (?, ?) ON CONFLICT(user) DO UPDATE SET bonus_gb = bonus_gb + excluded.bonus_gb',
      [userId, gb],
      () => resolve()
    );
  });
}

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: parseInt(process.env.UPLOAD_LIMIT || '2147483648', 10) },
});

exports.uploadMiddleware = upload.array('file', 20);
exports.uploadChunkMiddleware = upload.single('chunk');

exports.dashboard = async (req, res) => {
  const userId = req.session.userId;
  const files = await File.findByOwner(userId);
  const usedBytes = files.reduce((acc, f) => acc + (Number(f.size) || 0), 0);

  const user = await User.findById(userId);
  const subscription = await new Promise((resolve, reject) => {
    db.get('SELECT * FROM subscriptions WHERE id = ?', [user?.subscription_id || 1], (err, row) => {
      if (err) return reject(err);
      resolve(row || { id: 1, name: 'Free', storage_limit_gb: 5, price: 0, description: '' });
    });
  });

  const bonusGb = await getBonusGb(userId);
  if (subscription) subscription.storage_limit_gb = Number(subscription.storage_limit_gb || 0) + Number(bonusGb || 0);

  const { error, message } = req.query;

  res.render('file/dashboard', {
    title: 'My Cloud',
    files,
    subscription,
    usedBytes,
    query: {
      error,
      message: message ? decodeURIComponent(message) : ''
    }
  });
};

exports.uploadFile = async (req, res) => {
  const wantsJson = req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1) || req.query.ajax === '1';
  if (!req.files || req.files.length === 0) {
    if (wantsJson) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }
    return res.render('file/dashboard', { title: 'My Cloud', error: 'No file uploaded.' });
  }

  const userId = req.session.userId;
  const existingFiles = await File.findByOwner(userId);
  const usedBytes = existingFiles.reduce((acc, f) => acc + (Number(f.size) || 0), 0);

  const user = await User.findById(userId);
  const subscription = await new Promise((resolve, reject) => {
    db.get('SELECT * FROM subscriptions WHERE id = ?', [user?.subscription_id || 1], (err, row) => {
      if (err) return reject(err);
      resolve(row || { id: 1, name: 'Free', storage_limit_gb: 5, price: 0, description: '' });
    });
  });
  const bonusGb = await getBonusGb(userId);
  const limitBytes = (Number(subscription.storage_limit_gb || 5) + Number(bonusGb || 0)) * 1024 * 1024 * 1024;
  const incomingBytes = req.files.reduce((acc, f) => acc + (Number(f.size) || 0), 0);

  if (usedBytes + incomingBytes > limitBytes) {
    const remaining = Math.max(0, limitBytes - usedBytes);
    const msg = `Storage limit exceeded. You have ${(remaining/1024/1024).toFixed(2)} MB remaining.`;
    if (wantsJson) {
      return res.status(413).json({ error: msg });
    }
    return res.render('file/dashboard', { title: 'My Cloud', error: msg });
  }

  for (const f of req.files) {
    await File.create({
      owner: userId,
      originalName: f.originalname,
      filePath: f.filename,
      size: f.size,
    });
  }

  if (wantsJson) {
    return res.json({ success: true });
  }
  res.redirect('/FileAccess');
};

exports.initChunkUpload = async (req, res) => {
  const userId = req.session.userId;
  const { fileName, fileSize } = req.body;
  if (!fileName || !fileSize) return res.status(400).json({ error: 'Missing file info' });

  const existingFiles = await File.findByOwner(userId);
  const usedBytes = existingFiles.reduce((acc, f) => acc + (Number(f.size) || 0), 0);
  const user = await User.findById(userId);
  const subscription = await new Promise((resolve, reject) => {
    db.get('SELECT * FROM subscriptions WHERE id = ?', [user?.subscription_id || 1], (err, row) => {
      if (err) return reject(err);
      resolve(row || { id: 1, name: 'Free', storage_limit_gb: 5, price: 0, description: '' });
    });
  });
  const bonusGb = await getBonusGb(userId);
  const limitBytes = (Number(subscription.storage_limit_gb || 5) + Number(bonusGb || 0)) * 1024 * 1024 * 1024;
  if (usedBytes + Number(fileSize) > limitBytes) {
    const remaining = Math.max(0, limitBytes - usedBytes);
    return res.status(413).json({ error: `Storage limit exceeded. You have ${(remaining/1024/1024).toFixed(2)} MB remaining.` });
  }

  const uploadId = crypto.randomBytes(12).toString('hex');
  const tempDir = path.join(uploadsDir, 'temp', uploadId);
  fs.mkdirSync(tempDir, { recursive: true });
  fs.writeFileSync(path.join(tempDir, 'meta.json'), JSON.stringify({ fileName, fileSize, owner: userId }));
  return res.json({ uploadId });
};

exports.receiveChunk = async (req, res) => {
  const { uploadId, index } = req.body;
  if (!uploadId || typeof index === 'undefined' || !req.file) return res.status(400).json({ error: 'Missing chunk data' });
  const tempDir = path.join(uploadsDir, 'temp', uploadId);
  if (!fs.existsSync(tempDir)) return res.status(404).json({ error: 'Upload not found' });
  const targetPath = path.join(tempDir, `part-${index}`);
  fs.renameSync(req.file.path, targetPath);
  return res.json({ success: true });
};

exports.redeemCode = async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.redirect('/FileAccess?error=true&message=Code is required');
  }

  try {

    await new Promise((resolve, reject) => {
      db.run('BEGIN TRANSACTION', (err) => err ? reject(err) : resolve());
    });

    try {

      const specialCode = await new Promise((resolve) => {
        db.get(`
          SELECT * FROM special_codes 
          WHERE code = ? AND (max_uses = 0 OR use_count < max_uses)
          LIMIT 1
        `, [code], (err, row) => resolve(row));
      });

      if (specialCode) {

        const hasUsed = await new Promise((resolve) => {
          db.get(`
            SELECT 1 FROM storage_code_redemptions 
            WHERE code = ? AND user_id = ?
          `, [code, req.session.userId], (err, row) => resolve(!!row));
        });

        if (hasUsed) {
          await new Promise((resolve) => db.run('ROLLBACK', resolve));
          return res.redirect('/FileAccess?error=true&message=You have already used this code');
        }

        // Add bonus storage
        await ensureAddBonus(req.session.userId, specialCode.gb_amount);

        // Record redemption and increment use count
        await Promise.all([
          new Promise((resolve, reject) => {
            db.run(
              'INSERT INTO storage_code_redemptions (code, user_id, gb_amount) VALUES (?, ?, ?)',
              [code, req.session.userId, specialCode.gb_amount],
              (err) => err ? reject(err) : resolve()
            );
          }),
          new Promise((resolve, reject) => {
            db.run(
              'UPDATE special_codes SET use_count = use_count + 1 WHERE id = ?',
              [specialCode.id],
              (err) => err ? reject(err) : resolve()
            );
          })
        ]);

        await new Promise((resolve) => db.run('COMMIT', resolve));
        return res.redirect(`/FileAccess?error=false&message=Successfully redeemed ${specialCode.gb_amount}GB!`);
      }

      // If not a special code, check old storage codes
      const legacyCode = await new Promise((resolve) => {
        db.get('SELECT * FROM storage_codes WHERE code = ?', [code], (err, row) => resolve(row));
      });

      if (legacyCode) {
        // Check if code has already been used by this user
        const existingUse = await new Promise((resolve) => {
          db.get('SELECT * FROM storage_code_redemptions WHERE code = ? AND user_id = ?', 
            [code, req.session.userId], (err, row) => resolve(row));
        });

        if (existingUse) {
          await new Promise((resolve) => db.run('ROLLBACK', resolve));
          return res.redirect('/FileAccess?error=true&message=You have already used this code');
        }

        // Add bonus storage
        await ensureAddBonus(req.session.userId, legacyCode.gb);

        // Mark the code as used and record redemption in a single transaction
        await Promise.all([
          new Promise((resolve, reject) => {
            db.run('INSERT INTO storage_code_redemptions (code, user_id, gb_amount) VALUES (?, ?, ?)', 
              [code, req.session.userId, legacyCode.gb], 
              (err) => err ? reject(err) : resolve()
            );
          }),
          new Promise((resolve, reject) => {
            db.run('UPDATE storage_codes SET used = 1, used_by = ?, used_at = ? WHERE code = ?', 
              [req.session.userId, new Date().toISOString(), code],
              (err) => err ? reject(err) : resolve()
            );
          })
        ]);

        await new Promise((resolve) => db.run('COMMIT', resolve));
        return res.redirect(`/FileAccess?error=false&message=Successfully redeemed ${legacyCode.gb}GB!`);
      }

      // If we get here, code is invalid
      await new Promise((resolve) => db.run('ROLLBACK', resolve));
      return res.redirect('/FileAccess?error=true&message=Invalid or expired code');

    } catch (err) {
      await new Promise((resolve) => db.run('ROLLBACK', resolve));
      console.error('Error redeeming code:', err);
      return res.redirect('/FileAccess?error=true&message=Error processing code');
    }
  } catch (err) {
    console.error('Transaction error:', err);
    return res.redirect('/FileAccess?error=true&message=Transaction error');
  }
};

exports.completeChunkUpload = async (req, res) => {
  const { uploadId, total } = req.body;
  const tempDir = path.join(uploadsDir, 'temp', uploadId);
  if (!fs.existsSync(tempDir)) return res.status(404).json({ error: 'Upload not found' });
  const meta = JSON.parse(fs.readFileSync(path.join(tempDir, 'meta.json'), 'utf-8'));
  const finalName = crypto.randomBytes(8).toString('hex');
  const finalPath = path.join(uploadsDir, finalName);

  const writeStream = fs.createWriteStream(finalPath);
  try {
    for (let i = 0; i < Number(total); i++) {
      const partPath = path.join(tempDir, `part-${i}`);
      if (!fs.existsSync(partPath)) throw new Error(`Missing part ${i}`);
      const data = fs.readFileSync(partPath);
      writeStream.write(data);
    }
  } catch (e) {
    writeStream.close();
    return res.status(400).json({ error: e.message });
  } finally {
    writeStream.end();
  }

  const stats = fs.statSync(finalPath);
  await File.create({
    owner: meta.owner,
    originalName: meta.fileName,
    filePath: path.basename(finalPath),
    size: stats.size,
  });

  // cleanup
  try {
    fs.readdirSync(tempDir).forEach(f => fs.unlinkSync(path.join(tempDir, f)));
    fs.rmdirSync(tempDir);
  } catch (_) {}

  return res.json({ success: true });
};

exports.deleteBatch = async (req, res) => {
  let ids = [];
  if (Array.isArray(req.body.ids)) ids = req.body.ids;
  else if (typeof req.body.ids === 'string') ids = req.body.ids.split(',');
  ids = ids.map(s => String(s).trim()).filter(Boolean);
  if (!ids.length) return res.redirect('/FileAccess');
  for (const id of ids) {
    const file = await File.findById(id);
    if (file && file.owner == req.session.userId) {
      try {
        const p = path.join(__dirname, '../uploads', file.filePath);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch (_) {}
      await File.deleteById(file.id);
    }
  }
  res.redirect('/FileAccess');
};

exports.downloadZip = async (req, res) => {
  let ids = [];
  if (Array.isArray(req.body.ids)) ids = req.body.ids;
  else if (typeof req.body.ids === 'string') ids = req.body.ids.split(',');
  ids = ids.map(s => String(s).trim()).filter(Boolean);
  if (!ids.length) return res.redirect('/FileAccess');
  try {
    archiver = archiver || require('archiver');
  } catch (e) {
    return res.status(500).send('ZIP feature requires archiver. Please install with: npm i archiver');
  }
  const archive = archiver('zip', { zlib: { level: 9 } });
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="files.zip"');
  archive.pipe(res);

  for (const id of ids) {
    const f = await File.findById(id);
    if (f && f.owner == req.session.userId) {
      const p = path.join(__dirname, '../uploads', f.filePath);
      if (fs.existsSync(p)) archive.file(p, { name: f.originalName });
    }
  }
  archive.finalize();
};

exports.downloadFile = async (req, res) => {
  const file = await File.findById(req.params.id);
  if (!file || file.owner != req.session.userId) return res.status(404).send('File not found');
  res.download(require('path').join(__dirname, '../uploads', file.filePath), file.originalName);
};

exports.deleteFile = async (req, res) => {
  const file = await File.findById(req.params.id);
  if (!file || file.owner != req.session.userId) return res.status(404).send('File not found');
  try {
    const p = require('path').join(__dirname, '../uploads', file.filePath);
    if (require('fs').existsSync(p)) {
      require('fs').unlinkSync(p);
    }
  } catch (e) {
    // ignore filesystem errors to ensure DB stays consistent
  }
  await File.deleteById(file.id);
  res.redirect('/FileAccess');
};

exports.shareFile = async (req, res) => {
  const { expiresIn, password } = req.body || {};
  const file = await File.findById(req.params.id);
  if (!file || file.owner != req.session.userId) return res.status(404).send('File not found');
  file.shared_publicToken = require('crypto').randomBytes(16).toString('hex');
  if (expiresIn) file.shared_expiresAt = new Date(Date.now() + parseInt(expiresIn) * 60 * 60 * 1000).toISOString();
  if (password) file.shared_password = await require('bcrypt').hash(password, 10);
  await File.update(file);
  const wantsJson = req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1);
  if (wantsJson) {
    const url = `${req.protocol}://${req.get('host')}/FileAccess/public/${file.shared_publicToken}`;
    return res.json({ success: true, token: file.shared_publicToken, url });
  }
  res.redirect('/FileAccess');
};

exports.publicLink = async (req, res) => {
  try {
    const file = await File.findByPublicToken(req.params.token);
    if (!file) return res.status(404).render('file/not-found', { title: 'File Not Found' });
    
    if (file.shared_expiresAt && new Date(file.shared_expiresAt) < new Date()) {
      return res.status(403).render('file/expired', { title: 'Link Expired' });
    }

    const filePath = path.join(__dirname, '../uploads', file.filePath);
    
    if (file.shared_password) {
      if (req.method === 'POST') {
        const { password } = req.body;
        const match = await bcrypt.compare(password, file.shared_password);
        if (!match) {
          return res.render('file/share', { 
            title: 'Password Required',
            file: {
              name: file.originalName,
              size: formatFileSize(file.size),
              uploaded: new Date(file.uploadedAt).toLocaleString(),
              token: file.shared_publicToken,
              passwordProtected: true
            },
            error: 'Incorrect password. Please try again.'
          });
        }
        
        return res.download(filePath, file.originalName);
      }
      
      return res.render('file/share', { 
        title: 'Password Required',
        file: {
          name: file.originalName,
          size: formatFileSize(file.size),
          uploaded: new Date(file.uploadedAt).toLocaleString(),
          token: file.shared_publicToken,
          passwordProtected: true
        }
      });
    }
    
    if (req.method === 'GET') {
      return res.render('file/share', { 
        title: 'Download File',
        file: {
          name: file.originalName,
          size: formatFileSize(file.size),
          uploaded: new Date(file.uploadedAt).toLocaleString(),
          token: file.shared_publicToken,
          passwordProtected: false
        }
      });
    }
    
    return res.download(filePath, file.originalName);
    
  } catch (error) {
    console.error('Error in publicLink:', error);
    return res.status(500).render('file/error', {
      title: 'Error',
      message: 'An error occurred while processing your request.'
    });
  }
};

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

exports.unshareFile = async (req, res) => {
  const file = await File.findById(req.params.id);
  if (!file || file.owner != req.session.userId) return res.status(404).send('File not found');
  file.shared_publicToken = null;
  file.shared_expiresAt = null;
  file.shared_password = null;
  await File.update(file);
  res.redirect('/FileAccess');
};

exports.managePlan = async (req, res) => {
  const userId = req.session.userId;
  
  // Get user's current plan and coins
  const [plans, userData] = await Promise.all([
    new Promise((resolve, reject) => {
      db.all('SELECT * FROM subscriptions ORDER BY coin_price ASC', [], (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    }),
    new Promise((resolve) => {
      db.get(`
        SELECT u.subscription_id, s.name as plan_name, cs.score as coins
        FROM users u
        LEFT JOIN subscriptions s ON u.subscription_id = s.id
        LEFT JOIN clicker_scores cs ON cs.user = u.id
        WHERE u.id = ?
      `, [userId], (err, row) => {
        if (err || !row) return resolve({ subscription_id: 1, plan_name: 'Free', coins: 0 });
        resolve(row);
      });
    })
  ]);

  // Process each plan to add features array and format coin price
  const processedPlans = plans.map(plan => ({
    ...plan,
    features: plan.features ? plan.features.split(',') : [],
    formattedCoins: plan.coin_price.toLocaleString()
  }));

  res.render('file/managePlan', { 
    title: 'Upgrade Plan', 
    plans: processedPlans,
    currentPlanId: userData.subscription_id,
    currentPlanName: userData.plan_name,
    userCoins: userData.coins || 0,
    formattedUserCoins: (userData.coins || 0).toLocaleString()
  });
};

exports.upgradePlan = async (req, res) => {
  const userId = req.session.userId;
  const { planId } = req.body;

  if (!planId) {
    return res.status(400).json({ success: false, message: 'Plan ID is required' });
  }

  try {
    // Start transaction
    await new Promise((resolve, reject) => {
      db.run('BEGIN TRANSACTION', (err) => err ? reject(err) : resolve());
    });

    // Get plan details and user's current coins
    const [plan, userData] = await Promise.all([
      new Promise((resolve) => {
        db.get('SELECT * FROM subscriptions WHERE id = ?', [planId], (err, row) => {
          if (err || !row) return resolve(null);
          resolve(row);
        });
      }),
      new Promise((resolve) => {
        db.get(`
          SELECT u.subscription_id, cs.score as coins, cs.id as score_id
          FROM users u
          LEFT JOIN clicker_scores cs ON cs.user = u.id
          WHERE u.id = ?
        `, [userId], (err, row) => {
          if (err || !row) return resolve(null);
          resolve(row);
        });
      })
    ]);

    // Validate data
    if (!plan || !userData) {
      await new Promise((resolve) => db.run('ROLLBACK', resolve));
      return res.status(400).json({ success: false, message: 'Invalid plan or user data' });
    }

    // Check if user already has this plan
    if (userData.subscription_id === plan.id) {
      await new Promise((resolve) => db.run('ROLLBACK', resolve));
      return res.status(400).json({ success: false, message: 'You already have this plan' });
    }

    // Check if user has enough coins
    if (userData.coins < plan.coin_price) {
      await new Promise((resolve) => db.run('ROLLBACK', resolve));
      return res.status(400).json({ success: false, message: 'Not enough coins' });
    }

    // Deduct coins and update plan
    await Promise.all([
      new Promise((resolve, reject) => {
        db.run(
          'UPDATE users SET subscription_id = ? WHERE id = ?',
          [plan.id, userId],
          (err) => err ? reject(err) : resolve()
        );
      }),
      new Promise((resolve, reject) => {
        db.run(
          'UPDATE clicker_scores SET score = score - ? WHERE id = ?',
          [plan.coin_price, userData.score_id],
          (err) => err ? reject(err) : resolve()
        );
      })
    ]);

    // Commit transaction
    await new Promise((resolve) => db.run('COMMIT', resolve));
    
    res.json({
      success: true,
      message: `Successfully upgraded to ${plan.name} plan!`,
      newPlan: plan.name,
      remainingCoins: userData.coins - plan.coin_price
    });

  } catch (error) {
    await new Promise((resolve) => db.run('ROLLBACK', resolve));
    console.error('Error upgrading plan:', error);
    res.status(500).json({ success: false, message: 'Error upgrading plan' });
  }
};