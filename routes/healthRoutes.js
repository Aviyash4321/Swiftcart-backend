const express = require('express');
const { getHealth, getVersion } = require('../controllers/healthController');

const router = express.Router();

router.get('/health', getHealth);
router.get('/version', getVersion);

module.exports = router;
