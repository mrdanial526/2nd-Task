/**
 * AeroGrid API v1 Central Route Aggregator
 */

const express = require('express');
const router = express.Router();

const droneRoutes = require('./droneRoutes');
const deliveryRoutes = require('./deliveryRoutes');
const telemetryRoutes = require('./telemetryRoutes');

router.use('/drones', droneRoutes);
router.use('/deliveries', deliveryRoutes);
router.use('/missions', deliveryRoutes); // Alias for compatibility
router.use('/', telemetryRoutes);

module.exports = router;
