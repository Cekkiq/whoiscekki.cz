const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const dbPath = process.env.SQLITE_PATH || path.join(__dirname, '../../data/app.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('SQLite connection error:', err.message);
    process.exit(1);
  } else {
    console.log('SQLite connected:', dbPath);
  }
});

module.exports = db; 