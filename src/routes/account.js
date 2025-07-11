const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const requireLogin = require('../middleware/requireLogin');

// Public routes
router.get('/Register', authController.getRegister);
router.post('/Register', authController.register);
router.get('/Activate/:token', authController.activate);
router.get('/Login', authController.getLogin);
router.post('/Login', authController.login);

// Protected account management and 2FA routes
router.use(['/Manage', '/Manage/Profile', '/Manage/Email', '/Manage/Password', '/Manage/TwoFA', '/Manage/Data', '/2fa/setup', '/2fa/verify'], requireLogin);

// Manage subpages
router.get('/Manage', (req, res) => res.redirect('/Account/Manage/Profile'));
router.get('/Manage/Profile', authController.getManageProfile);
router.get('/Manage/Email', authController.getManageEmail);
router.get('/Manage/Password', authController.getManagePassword);
router.get('/Manage/TwoFA', authController.getManageTwoFA);
router.get('/Manage/Data', authController.getManageData);

router.post('/Manage', authController.updateAccount);

router.get('/2fa/setup', authController.setup2FA);
router.post('/2fa/verify', authController.verify2FA);

// 2FA login verify (should be accessible for login flow)
router.get('/2fa/verify-login', authController.get2FAVerify);
router.post('/2fa/verify-login', authController.verify2FALogin);

router.get('/Logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/Account/Login');
  });
});

module.exports = router; 