const db = require('../config/db');
const bcrypt = require('bcrypt');

const User = {
  async findByEmail(email) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  },
  async findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  },
  async findByActivationToken(token) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE activationToken = ?', [token], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  },
  async create(user) {
    const hash = await bcrypt.hash(user.password, 10);
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO users (email, password, role, isActive, registeredAt, lastLogin, lockedUntil, failedLoginAttempts, twoFA_enabled, twoFA_secret, activationToken) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [user.email, hash, user.role || 'user', user.isActive ? 1 : 0, new Date().toISOString(), user.lastLogin || null, user.lockedUntil || null, user.failedLoginAttempts || 0, user.twoFA_enabled ? 1 : 0, user.twoFA_secret || null, user.activationToken || null],
        function (err) {
          if (err) return reject(err);
          db.get('SELECT * FROM users WHERE id = ?', [this.lastID], (err, row) => {
            if (err) return reject(err);
            resolve(row);
          });
        }
      );
    });
  },
  async update(user) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET email=?, password=?, role=?, isActive=?, registeredAt=?, lastLogin=?, lockedUntil=?, failedLoginAttempts=?, twoFA_enabled=?, twoFA_secret=?, activationToken=? WHERE id=?',
        [user.email, user.password, user.role, user.isActive ? 1 : 0, user.registeredAt, user.lastLogin, user.lockedUntil, user.failedLoginAttempts, user.twoFA_enabled ? 1 : 0, user.twoFA_secret, user.activationToken, user.id],
        function (err) {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  },
  async deleteById(id) {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM users WHERE id = ?', [id], function (err) {
        if (err) return reject(err);
        resolve();
      });
    });
  },
  async comparePassword(candidatePassword, hash) {
    return bcrypt.compare(candidatePassword, hash);
  },
  async findAll() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM users ORDER BY registeredAt DESC', [], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }
};

module.exports = User; 