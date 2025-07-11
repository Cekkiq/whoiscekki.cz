const db = require('../config/db');

const InviteToken = {
  async findOne({ token, used }) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM invite_tokens WHERE token = ? AND used = ?', [token, used ? 1 : 0], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  },
  async create({ token, usedBy }) {
    return new Promise((resolve, reject) => {
      db.run('INSERT INTO invite_tokens (token, createdAt, used, usedBy) VALUES (?, ?, 0, ?)', [token, new Date().toISOString(), usedBy || null], function (err) {
        if (err) return reject(err);
        db.get('SELECT * FROM invite_tokens WHERE id = ?', [this.lastID], (err, row) => {
          if (err) return reject(err);
          resolve(row);
        });
      });
    });
  },
  async markUsed(token, userId) {
    return new Promise((resolve, reject) => {
      db.run('UPDATE invite_tokens SET used = 1, usedBy = ? WHERE token = ?', [userId, token], function (err) {
        if (err) return reject(err);
        resolve();
      });
    });
  },
  async findAll() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM invite_tokens ORDER BY createdAt DESC', [], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  },
  async deleteByToken(token) {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM invite_tokens WHERE token = ?', [token], function (err) {
        if (err) return reject(err);
        resolve();
      });
    });
  }
};

module.exports = InviteToken; 