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

const app = express();

// Inicializace headadmina
const initHeadAdmin = require('./utils/initHeadAdmin');
initHeadAdmin();
initDb();

// Set EJS as view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(helmet());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP
});
app.use(limiter);

// Session
app.use(
  session({
    secret: config.jwtSecret,
    resave: false,
    saveUninitialized: false,
    store: new SQLiteStore({ db: './data/sessions.db' }),
    cookie: { secure: false, httpOnly: true },
  })
);

// Zpřístupním userId do všech EJS šablon
app.use((req, res, next) => {
  res.locals.userId = req.session.userId;
  next();
});

// Přidat middleware pro načtení role uživatele
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

// Basic route
app.get('/', (req, res) => {
  res.render('index', { title: 'Welcome to WhoisCekki.cz' });
});

app.use('/Account', accountRoutes);
app.use('/AdminPanel', adminPanelRoutes);
app.use('/FileAccess', fileAccessRoutes);
app.use('/Clicker', clickerRoutes);

// Start server
app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
}); 