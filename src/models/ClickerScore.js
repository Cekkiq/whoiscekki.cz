const db = require('../config/db');

const ClickerScore = {
  async findTop(limit = 10) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM clicker_scores ORDER BY score DESC LIMIT ?', [limit], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  },
  async findByUser(userId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM clicker_scores WHERE user = ?', [userId], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  },
  async create(score) {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO clicker_scores (user, sessionId, score, lastClick) VALUES (?, ?, ?, ?)',
        [score.user || null, score.sessionId, score.score || 0, new Date().toISOString()],
        function (err) {
          if (err) return reject(err);
          db.get('SELECT * FROM clicker_scores WHERE id = ?', [this.lastID], (err, row) => {
            if (err) return reject(err);
            resolve(row);
          });
        }
      );
    });
  },
  async update(score) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE clicker_scores SET score=?, lastClick=? WHERE id=?',
        [score.score, new Date().toISOString(), score.id],
        function (err) {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }
};

module.exports = ClickerScore; 