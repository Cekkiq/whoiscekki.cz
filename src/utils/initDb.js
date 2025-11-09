const db = require('../config/db');
const SpecialCode = require('../models/SpecialCode');

const initDb = () => {
  db.serialize(() => {
    // Ensure tables exist (non-destructive)
    db.run(`CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      storage_limit_gb INTEGER NOT NULL,
      price REAL NOT NULL,
      coin_price BIGINT DEFAULT 0,
      description TEXT,
      features TEXT
    )`);

    // Seed subscription plans only if empty
    db.get(`SELECT COUNT(*) as cnt FROM subscriptions`, [], (err, row) => {
      if (err) return;
      if (!row || Number(row.cnt) === 0) {
        db.run(`INSERT INTO subscriptions (id, name, storage_limit_gb, price, coin_price, description, features) VALUES 
          (1, 'Free', 5, 0.00, 0, 'Basic access with limited storage. Perfect for casual use.', '5GB Storage,Standard Speed,Basic Support'),
          (2, 'Pro', 15, 1.99, 1000000000, 'More space and faster upload speeds for active users.', '15GB Storage,Faster Uploads,Priority Support,Early Access to New Features'),
          (3, 'Ultra', 50, 4.99, 100000000000, 'Maximum performance, priority support, and huge storage.', '50GB Storage,Maximum Speed,24/7 Priority Support,All Pro Features,Exclusive Content')
        `);
      }
    });

    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      subscription_id INTEGER DEFAULT 1,
      isActive INTEGER DEFAULT 0,
      registeredAt TEXT,
      lastLogin TEXT,
      lockedUntil TEXT,
      failedLoginAttempts INTEGER DEFAULT 0,
      twoFA_enabled INTEGER DEFAULT 0,
      twoFA_secret TEXT,
      activationToken TEXT,
      FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS invite_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      createdAt TEXT,
      used INTEGER DEFAULT 0,
      usedBy INTEGER,
      FOREIGN KEY (usedBy) REFERENCES users(id)
    )`);

    // Create storage_code_redemptions table for tracking code usage
    db.run(`CREATE TABLE IF NOT EXISTS storage_code_redemptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      gb_amount REAL NOT NULL,
      redeemed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(code, user_id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner INTEGER NOT NULL,
      originalName TEXT NOT NULL,
      filePath TEXT NOT NULL,
      size INTEGER NOT NULL,
      uploadedAt TEXT,
      shared_publicToken TEXT,
      shared_expiresAt TEXT,
      shared_password TEXT,
      FOREIGN KEY (owner) REFERENCES users(id)
    )`);
    // Create editable scores table
    db.run(`CREATE TABLE IF NOT EXISTS clicker_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user INTEGER NOT NULL,
      sessionId TEXT,
      score INTEGER DEFAULT 0,
      lastClick TEXT,
      is_edited BOOLEAN DEFAULT 0,
      last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user) REFERENCES users(id) ON DELETE CASCADE
    )`);
    
    // Create admin edits log
    db.run(`CREATE TABLE IF NOT EXISTS admin_edits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      old_score INTEGER,
      new_score INTEGER,
      edit_time TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (admin_id) REFERENCES users(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);
    // Create storage_codes table for special code drops
    db.run(`CREATE TABLE IF NOT EXISTS storage_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      gb INTEGER NOT NULL,
      code_type INTEGER NOT NULL,
      used BOOLEAN DEFAULT 0,
      used_by INTEGER,
      used_at TEXT,
      created_by INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (used_by) REFERENCES users(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS clicker_upgrades (
      user INTEGER PRIMARY KEY,
      level INTEGER DEFAULT 0,
      FOREIGN KEY (user) REFERENCES users(id)
    )`);
    // add luck_level column if missing (ignore error if exists)
    db.run(`ALTER TABLE clicker_upgrades ADD COLUMN luck_level INTEGER DEFAULT 0`, () => {});
    // Initialize special_codes table
    SpecialCode.createTable().catch(console.error);

    db.run(`CREATE TABLE IF NOT EXISTS user_storage_bonus (
      user INTEGER PRIMARY KEY,
      bonus_gb INTEGER DEFAULT 0,
      FOREIGN KEY (user) REFERENCES users(id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS storage_codes (
      code TEXT PRIMARY KEY,
      gb INTEGER NOT NULL,
      createdAt TEXT,
      claimed_by INTEGER,
      claimedAt TEXT,
      FOREIGN KEY (claimed_by) REFERENCES users(id)
    )`);
  });
};

module.exports = initDb; 