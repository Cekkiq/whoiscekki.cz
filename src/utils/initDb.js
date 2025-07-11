const db = require('../config/db');

const initDb = () => {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      isActive INTEGER DEFAULT 0,
      registeredAt TEXT,
      lastLogin TEXT,
      lockedUntil TEXT,
      failedLoginAttempts INTEGER DEFAULT 0,
      twoFA_enabled INTEGER DEFAULT 0,
      twoFA_secret TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS invite_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      createdAt TEXT,
      used INTEGER DEFAULT 0,
      usedBy INTEGER,
      FOREIGN KEY (usedBy) REFERENCES users(id)
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
    db.run(`CREATE TABLE IF NOT EXISTS clicker_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user INTEGER,
      sessionId TEXT,
      score INTEGER DEFAULT 0,
      lastClick TEXT,
      FOREIGN KEY (user) REFERENCES users(id)
    )`);
  });
};

module.exports = initDb; 