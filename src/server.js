const express = require('express');
const path = require('path');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const config = require('./config');
const accountRoutes = require('./routes/account');
const adminPanelRoutes = require('./routes/adminPanel');
const fileAccessRoutes = require('./routes/fileAccess');
const clickerRoutes = require('./routes/clicker');
const initDb = require('./utils/initDb');
const User = require('./models/User');
const flash = require('connect-flash');

const app = express();

initDb();

const initHeadAdmin = require('./utils/initHeadAdmin');
initHeadAdmin();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(flash());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": [
          "'self'",
          "https://cdn.basecoat.it",
          "cdn.jsdelivr.net",
          "'unsafe-inline'",
          "https://www.highperformanceformat.com",
          "https://*.highperformanceformat.com"
        ],
        "style-src": [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.basecoat.it",
          "cdn.jsdelivr.net"
        ],
        "connect-src": [
          "'self'",
          "https://cdn.basecoat.it",
          "cdn.jsdelivr.net",
          "https://www.highperformanceformat.com"
        ],
        "img-src": [
          "'self'",
          "data:",
          "https://cdn.basecoat.it",
          "https://www.highperformanceformat.com"
        ],
        "frame-src": ["'self'", "https://www.highperformanceformat.com"]
      }
    }
  })
);

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use((req, res, next) => {
  if (req.path && (
    req.path.startsWith('/FileAccess/upload') || 
    req.path.startsWith('/Clicker')
  )) return next();
  return limiter(req, res, next);
});

app.use(
  session({
    secret: config.jwtSecret,
    resave: false,
    saveUninitialized: false,
    store: new SQLiteStore({ db: './data/sessions.db' }),
    cookie: { secure: false, httpOnly: true },
  })
);

app.use((req, res, next) => {
  res.locals.userId = req.session.userId;
  next();
});
app.use(async (req, res, next) => {
  if (req.session && req.session.userId) {
    try {
      const user = await User.findById(req.session.userId);
      res.locals.userRole = user ? user.role : undefined;
    } catch (e) {
      res.locals.userRole = undefined;
    }
  } else {
    res.locals.userRole = undefined;
  }
  next();
});

const db = require('./config/db');
app.use((req, res, next) => {
  if (req.session && req.session.userId) {
    db.get('SELECT score FROM clicker_scores WHERE user=?', [req.session.userId], (err, row) => {
      res.locals.coins = row ? Number(row.score) : 0;
      next();
    });
  } else {
    res.locals.coins = 0;
    next();
  }
});

app.get('/', (req, res) => {
  res.render('index', { title: 'whoiscekki.cz | home' });
});

app.use('/Account', accountRoutes);
app.use('/AdminPanel', adminPanelRoutes);
app.use('/FileAccess', fileAccessRoutes);
app.use('/Clicker', clickerRoutes);

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});