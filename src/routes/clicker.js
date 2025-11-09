const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const clickerController = require('../controllers/clickerController');
const requireLogin = require('../middleware/requireLogin');

// Autoclicker detection
const clickLimiter = rateLimit({
  windowMs: 1000, // 1 second window
  max: 15, // 15 clicks per second is humanly impossible
  message: { 
    error: 'Autoclicker detected! Please use manual clicking.',
    retryAfter: 5
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.session.userId || req.ip,
  skip: (req) => {
    // Only apply rate limiting if clicking faster than humanly possible
    if (!req.rateLimit) return true;
    return req.rateLimit.current < 15; // Allow up to 15 clicks per second
  }
});

// Upgrade limiter - more permissive
const upgradeLimiter = rateLimit({
  windowMs: 5 * 1000, // 5 seconds
  max: 20, // limit to 20 upgrades per 5 seconds
  message: { error: 'Too many upgrades, please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.session.userId || req.ip
});

router.use(requireLogin);
router.get('/', clickerController.getGame);
router.post('/click', clickLimiter, clickerController.click);
router.post('/upgrade', upgradeLimiter, clickerController.upgrade);

module.exports = router;