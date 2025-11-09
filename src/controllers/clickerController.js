const db = require('../config/db');
const config = require('../config');

// Define code types and their probabilities (in %)
const CODE_TYPES = [
  { gb: 1, chance: 50, weight: 5 },
  { gb: 2, chance: 30, weight: 3 },
  { gb: 3, chance: 10, weight: 1 },
  { gb: 4, chance: 7, weight: 0.7 },
  { gb: 5, chance: 2.5, weight: 0.25 },
  { gb: 10, chance: 0.5, weight: 0.05 }
];

// Function to get a random code type based on weights
function getRandomCodeType() {
  const totalWeight = CODE_TYPES.reduce((sum, type) => sum + type.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const type of CODE_TYPES) {
    if (random < type.weight) {
      return type;
    }
    random -= type.weight;
  }
  
  // Fallback to 2GB if something goes wrong
  return CODE_TYPES[1];
}

async function getUserCoins(userId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT score FROM clicker_scores WHERE user=?', [userId], (err, row) => {
      if (err) return reject(err);
      resolve(row ? Number(row.score) : 0);
    });
  });
}

async function setUserCoins(userId, score) {
  const now = new Date().toISOString();
  return new Promise((resolve, reject) => {
    db.get('SELECT id FROM clicker_scores WHERE user=?', [userId], (err, row) => {
      if (err) return reject(err);
      if (row) {
        db.run('UPDATE clicker_scores SET score=?, lastClick=? WHERE user=?', [score, now, userId], function (uErr) {
          if (uErr) return reject(uErr);
          resolve();
        });
      } else {
        db.run('INSERT INTO clicker_scores (user, score, lastClick) VALUES (?, ?, ?)', [userId, score, now], function (iErr) {
          if (iErr) return reject(iErr);
          resolve();
        });
      }
    });
  });
}

async function getUserLevel(userId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT level, luck_level FROM clicker_upgrades WHERE user=?', [userId], (err, row) => {
      if (err) return reject(err);
      resolve({ level: row ? Number(row.level) : 0, luck: row ? Number(row.luck_level || 0) : 0 });
    });
  });
}

async function setUserLevel(userId, level) {
  return new Promise((resolve, reject) => {
    db.get('SELECT user FROM clicker_upgrades WHERE user=?', [userId], (err, row) => {
      if (err) return reject(err);
      if (row) {
        db.run('UPDATE clicker_upgrades SET level=? WHERE user=?', [level, userId], function (uErr) {
          if (uErr) return reject(uErr);
          resolve();
        });
      } else {
        db.run('INSERT INTO clicker_upgrades (user, level, luck_level) VALUES (?, ?, 0)', [userId, level], function (iErr) {
          if (iErr) return reject(iErr);
          resolve();
        });
      }
    });
  });
}

async function setUserLuck(userId, luckLevel) {
  return new Promise((resolve, reject) => {
    db.get('SELECT user FROM clicker_upgrades WHERE user=?', [userId], (err, row) => {
      if (err) return reject(err);
      if (row) {
        db.run('UPDATE clicker_upgrades SET luck_level=? WHERE user=?', [luckLevel, userId], function (uErr) {
          if (uErr) return reject(uErr);
          resolve();
        });
      } else {
        db.run('INSERT INTO clicker_upgrades (user, level, luck_level) VALUES (?, 0, ?)', [userId, luckLevel], function (iErr) {
          if (iErr) return reject(iErr);
          resolve();
        });
      }
    });
  });
}

function nextUpgradeCost(level) {
  // base 50, doubles each level: 50, 100, 200, 400...
  return 50 * Math.pow(2, level);
}

function nextLuckCost(luckLevel) {
  // base 100, doubles each level: 100, 200, 400, ...
  return 100 * Math.pow(2, luckLevel);
}

exports.getGame = async (req, res) => {
  if (!req.session.userId) return res.render('clicker', { title: 'Access Denied' });
  const userId = req.session.userId;
  const coins = await getUserCoins(userId);
  const { level, luck } = await getUserLevel(userId);
  const cost = nextUpgradeCost(level);
  const luckCost = nextLuckCost(luck);
  // Calculate expected clicks until next code based on the current luck level
  const luckBonus = luck * config.clicker.luckBonusPerLevel;
  // Get total chance by summing up all possible code type chances
  const totalChance = (config.clicker.baseChance + luckBonus) * (CODE_TYPES.reduce((sum, type) => sum + type.weight, 0) / CODE_TYPES.length);
  const expectedClicks = Math.ceil(1 / totalChance);
  // Calculate remaining clicks based on current count (simplified for now)
  const remainingClicks = Math.max(0, expectedClicks - (coins % expectedClicks));
  const message = req.query.msg || '';
  
  // Get user's found codes
  const foundCodes = await new Promise((resolve) => {
    db.all(
      `SELECT code, gb, 
              CASE WHEN used = 1 THEN 1 ELSE 0 END as used, 
              used_at, 
              used_by,
              (SELECT email FROM users WHERE id = used_by) as used_by_email,
              strftime('%Y-%m-%d %H:%M', created_at) as found_at
       FROM storage_codes 
       WHERE created_by = ? 
       ORDER BY created_at DESC`, 
      [req.session.userId],
      (err, rows) => {
        if (err) {
          console.error('Error fetching found codes:', err);
          return resolve([]);
        }
        // Ensure used is a proper boolean
        const processedRows = (rows || []).map(row => ({
          ...row,
          used: Boolean(row.used)
        }));
        resolve(processedRows);
      }
    );
  });
  
  // Get user's role for admin features
  const user = await new Promise((resolve) => {
    db.get('SELECT role FROM users WHERE id = ?', [userId], (err, row) => {
      if (err || !row) return resolve({ role: 'user' });
      resolve(row);
    });
  });
  
  res.render('clicker', { 
    title: 'Clicker', 
    coins, 
    level, 
    cost, 
    luck, 
    luckCost, 
    message,
    foundCodes,
    isHeadAdmin: user.role === 'headadmin',
    baseChance: config.clicker.baseChance,
    luckBonusPerLevel: config.clicker.luckBonusPerLevel,
    codeTypes: CODE_TYPES
  });
};

exports.click = async (req, res) => {
  if (!req.session.userId) return res.redirect('/Account/Login');
  const userId = req.session.userId;
  const { level, luck } = await getUserLevel(userId);
  const add = 1 + level;
  let coins = await getUserCoins(userId);
  coins += add;
  await setUserCoins(userId, coins);

  // Check for code drop chance (base 0.2% + 0.1% per luck level)
  let drop = null;
  const baseChance = 0.002; // 0.2%
  const luckBonus = luck * 0.001; // +0.1% per luck level
  
  if (Math.random() < (baseChance + luckBonus)) {
    // Generate random alphanumeric characters for the code
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const generateSegment = () => {
      let result = '';
      for (let i = 0; i < 4; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };
    
    const code = `SC-${generateSegment()}-${generateSegment()}-${generateSegment()}`;
    const codeType = getRandomCodeType();
    const gb = codeType.gb;
    
    await new Promise((resolve) => {
      db.run(
        'INSERT INTO storage_codes (code, gb, code_type, created_at, created_by) VALUES (?, ?, ?, ?, ?)', 
        [code, gb, gb, new Date().toISOString(), userId], 
        (err) => {
          if (err) console.error('Error saving code:', err);
          resolve();
        }
      );
    });
    drop = { code, gb };
  }

  if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
    return res.json({ coins, add, drop });
  }
  const msg = drop ? encodeURIComponent(`Lucky! You found a code ${drop.code} (+${drop.gb} GB)`) : '';
  res.redirect(`/Clicker${msg ? `?msg=${msg}` : ''}`);
};

exports.upgrade = async (req, res) => {
  if (!req.session.userId) return res.redirect('/Account/Login');
  const userId = req.session.userId;
  const { level, luck } = await getUserLevel(userId);
  const type = (req.body && req.body.type) ? String(req.body.type) : 'power';
  const isLuck = type === 'luck';
  const cost = isLuck ? nextLuckCost(luck) : nextUpgradeCost(level);
  let coins = await getUserCoins(userId);
  if (coins >= cost) {
    coins -= cost;
    await setUserCoins(userId, coins);
    if (isLuck) {
      await setUserLuck(userId, luck + 1);
    } else {
      await setUserLevel(userId, level + 1);
    }
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
      const newLevel = isLuck ? level : level + 1;
      const newLuck = isLuck ? luck + 1 : luck;
      return res.json({ success: true, level: newLevel, luck: newLuck, coins, nextCost: isLuck ? nextLuckCost(newLuck) : nextUpgradeCost(newLevel) });
    }
  }
  if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
    return res.status(400).json({ success: false, error: 'Not enough coins' });
  }
  res.redirect('/Clicker');
};