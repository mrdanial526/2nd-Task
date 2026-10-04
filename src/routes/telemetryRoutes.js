/**
 * AeroGrid Telemetry & System Routes
 */

const express = require('express');
const router = express.Router();

const {
  getHealth,
  getMetrics,
  getCatalog,
  resetSystem,
} = require('../controllers/telemetryController');

router.get('/health', getHealth);
router.get('/metrics', getMetrics);
router.get('/catalog', getCatalog);
router.post('/system/reset', resetSystem);

module.exports = router;
