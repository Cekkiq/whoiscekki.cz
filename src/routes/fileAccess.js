const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const requireLogin = require('../middleware/requireLogin');

router.use(requireLogin);

router.get('/', fileController.dashboard);
router.post('/upload', fileController.uploadMiddleware, fileController.uploadFile);
router.get('/download/:id', fileController.downloadFile);
router.post('/delete/:id', fileController.deleteFile);
router.post('/share/:id', fileController.shareFile);
router.get('/public/:token', fileController.publicLink);
router.post('/public/:token', fileController.publicLink);
router.post('/unshare/:id', fileController.unshareFile);

module.exports = router; 