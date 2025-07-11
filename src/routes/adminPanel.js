const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const requireAdmin = require('../middleware/requireAdmin');

router.use(requireAdmin);

router.get('/', adminController.dashboard);
router.post('/Invites', adminController.createInvite);
router.post('/Invites/send', adminController.sendInviteEmail);
router.post('/Invites/:token/delete', adminController.deleteInvite);
router.post('/Users/:id/activate', adminController.activateUser);
router.post('/Users/:id/deactivate', adminController.deactivateUser);
router.post('/Users/:id/delete', adminController.deleteUser);
router.post('/Users/:id/role', adminController.changeRole);
router.post('/Users/:id/impersonate', adminController.impersonateUser);

module.exports = router; 