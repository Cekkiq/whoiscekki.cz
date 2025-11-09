const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const requireLogin = require('../middleware/requireLogin');

router.get('/public/:token', fileController.publicLink);
router.post('/public/:token', fileController.publicLink);

router.use(requireLogin);

router.get('/', fileController.dashboard);
router.post('/upload', fileController.uploadMiddleware, fileController.uploadFile);
router.post('/upload/init', fileController.initChunkUpload);
router.post('/upload/chunk', fileController.uploadChunkMiddleware, fileController.receiveChunk);
router.post('/upload/complete', fileController.completeChunkUpload);
router.get('/download/:id', fileController.downloadFile);
router.post('/delete/:id', fileController.deleteFile);
router.post('/share/:id', fileController.shareFile);
router.post('/unshare/:id', fileController.unshareFile);
router.get('/ManagePlan', fileController.managePlan);
router.post('/upgrade-plan', fileController.upgradePlan);
router.post('/redeem', fileController.redeemCode);
router.post('/delete-batch', fileController.deleteBatch);
router.post('/download-zip', fileController.downloadZip);

module.exports = router;