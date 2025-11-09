const db = require('../config/db');

class SpecialCode {
  static createTable() {
    return new Promise((resolve, reject) => {
      const sql = `
        CREATE TABLE IF NOT EXISTS special_codes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT UNIQUE NOT NULL,
          gb_amount REAL NOT NULL,
          max_uses INTEGER DEFAULT 1,
          use_count INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by INTEGER,
          FOREIGN KEY (created_by) REFERENCES users(id)
        )`;
      
      db.run(sql, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  static create({ code, gbAmount, maxUses = 1, createdBy }) {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO special_codes (code, gb_amount, max_uses, created_by) VALUES (?, ?, ?, ?)',
        [code, gbAmount, maxUses, createdBy],
        function(err) {
          if (err) return reject(err);
          resolve(this.lastID);
        }
      );
    });
  }

  static findByCode(code) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM special_codes WHERE code = ?', [code], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  }

  static getAll() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT sc.*, u.email as creator 
         FROM special_codes sc 
         LEFT JOIN users u ON sc.created_by = u.id 
         ORDER BY sc.created_at DESC`,
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
  }

  static incrementUseCount(codeId) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE special_codes SET use_count = use_count + 1 WHERE id = ?',
        [codeId],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  static delete(id) {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM special_codes WHERE id = ?', [id], function(err) {
        if (err) return reject(err);
        resolve(this.changes > 0);
      });
    });
  }
}

module.exports = SpecialCode;
