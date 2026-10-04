/**
 * AeroGrid System Telemetry & Catalog Controller
 */

const db = require('../database/store');
const config = require('../config/env');

const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// GET /api/v1/health
const getHealth = catchAsync(async (req, res) => {
  res.status(200).json({
    status: 'success',
    statusCode: 200,
    data: {
      service: config.APP_NAME,
      version: config.APP_VERSION,
      environment: config.NODE_ENV,
      uptimeSeconds: Math.floor(process.uptime()),
      status: 'OPERATIONAL',
      airspaceGateway: 'ONLINE',
    },
    timestamp: new Date().toISOString(),
  });
});

// GET /api/v1/metrics
const getMetrics = catchAsync(async (req, res) => {
  const metrics = db.getMetrics();
  res.status(200).json({
    status: 'success',
    statusCode: 200,
    data: metrics,
    timestamp: new Date().toISOString(),
  });
});

// GET /api/v1/catalog (Machine readable REST endpoint directory)
const getCatalog = catchAsync(async (req, res) => {
  res.status(200).json({
    status: 'success',
    statusCode: 200,
    data: {
      api: config.APP_NAME,
      version: config.APP_VERSION,
      endpoints: [
        { method: 'GET', path: '/drones', description: 'Query drone fleet with optional query filters' },
        { method: 'GET', path: '/drones/:id', description: 'Get specific drone hardware and mission status' },
        { method: 'POST', path: '/drones', description: 'Commission new drone with syntactic & uniqueness checks' },
        { method: 'PUT', path: '/drones/:id/status', description: 'Update drone status via state machine' },
        { method: 'DELETE', path: '/drones/:id', description: 'Decommission drone from fleet' },
        { method: 'GET', path: '/deliveries', description: 'Query delivery missions with optional filters' },
        { method: 'GET', path: '/deliveries/:id', description: 'Get flight mission details and telemetry' },
        { method: 'POST', path: '/deliveries', description: 'Dispatch new flight delivery with dual-layer validation' },
        { method: 'PATCH', path: '/deliveries/:id/state', description: 'Transition delivery state via StateEngine' },
        { method: 'PUT', path: '/deliveries/:id/telemetry', description: 'Stream real-time flight GPS & battery updates' },
        { method: 'DELETE', path: '/deliveries/:id', description: 'Abort and cancel flight delivery mission' },
        { method: 'GET', path: '/api/v1/health', description: 'System health & uptime' },
        { method: 'GET', path: '/api/v1/metrics', description: 'Live fleet telemetry and audit logs' },
        { method: 'POST', path: '/api/v1/system/reset', description: 'Reset datastore to clean seed baseline' },
      ],
    },
    timestamp: new Date().toISOString(),
  });
});

// POST /api/v1/system/reset
const resetSystem = catchAsync(async (req, res) => {
  db.reset();
  res.status(200).json({
    status: 'success',
    statusCode: 200,
    message: 'AeroGrid datastore successfully reset to clean seed state.',
    timestamp: new Date().toISOString(),
  });
});

module.exports = {
  getHealth,
  getMetrics,
  getCatalog,
  resetSystem,
};
