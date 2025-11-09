const express = require('express');
const router = express.Router();
const passport = require('passport');
const User = require('../models/User');

// Google OAuth routes
router.get('/google',
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    prompt: 'select_account' // Forces account selection
  })
);

router.get('/google/callback', 
  passport.authenticate('google', { 
    failureRedirect: '/login',
    failureFlash: true
  }),
  (req, res) => {
    // Successful authentication, redirect home
    res.redirect('/');
  }
);

// GitHub OAuth routes
router.get('/github',
  passport.authenticate('github', { 
    scope: ['user:email']
  })
);

router.get('/github/callback',
  passport.authenticate('github', { 
    failureRedirect: '/login',
    failureFlash: true
  }),
  (req, res) => {
    // Successful authentication, redirect home
    res.redirect('/');
  }
);

// Logout route
router.get('/logout', (req, res) => {
  req.logout(function(err) {
    if (err) { return next(err); }
    req.flash('success_msg', 'You are logged out');
    res.redirect('/login');
  });
});

// Check if user is authenticated
router.get('/check', (req, res) => {
  if (req.isAuthenticated()) {
    return res.json({ 
      isAuthenticated: true, 
      user: {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role
      }
    });
  }
  res.json({ isAuthenticated: false });
});

module.exports = router;
