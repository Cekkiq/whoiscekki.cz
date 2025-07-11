const express = require('express');
const router = express.Router();
const clickerController = require('../controllers/clickerController');

router.get('/', clickerController.getGame);
router.post('/click', clickerController.click);

module.exports = router; 