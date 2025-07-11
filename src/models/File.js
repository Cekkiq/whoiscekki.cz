const db = require('../config/db');

const File = {
  async findByOwner(ownerId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM files WHERE owner = ?', [ownerId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  },
  async create(file) {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO files (owner, originalName, filePath, size, uploadedAt, shared_publicToken, shared_expiresAt, shared_password) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [file.owner, file.originalName, file.filePath, file.size, new Date().toISOString(), file.shared_publicToken || null, file.shared_expiresAt || null, file.shared_password || null],
        function (err) {
          if (err) return reject(err);
          db.get('SELECT * FROM files WHERE id = ?', [this.lastID], (err, row) => {
            if (err) return reject(err);
            resolve(row);
          });
        }
      );
    });
  },
  async findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM files WHERE id = ?', [id], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  },
  async deleteById(id) {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM files WHERE id = ?', [id], function (err) {
        if (err) return reject(err);
        resolve();
      });
    });
  },
  async update(file) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE files SET shared_publicToken=?, shared_expiresAt=?, shared_password=? WHERE id=?',
        [file.shared_publicToken || null, file.shared_expiresAt || null, file.shared_password || null, file.id],
        function (err) {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  },
  async findByPublicToken(token) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM files WHERE shared_publicToken = ?', [token], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  }
};

module.exports = File; 