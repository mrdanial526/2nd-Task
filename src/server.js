/**
 * AeroGrid Autonomous Drone Dispatch & Telemetry API
 * 
 * Server Entrypoint & Architectural Pipeline:
 * - CORS & Security Headers
 * - Request Correlation ID (X-Request-Id)
 * - Sliding-Window Rate Limiting
 * - Dual-Layer Gatekeeper Validation (Zod Syntactic + Semantic Business Rules)
 * - Deterministic State Machine Engine
 * - Semantic HTTP Status Codes (200, 201, 204, 400, 404, 409, 422, 500)
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const config = require('./config/env');
const apiRoutes = require('./routes/index');
const droneRoutes = require('./routes/droneRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');
const requestLogger = require('./middleware/logger');
const rateLimiter = require('./middleware/rateLimiter');
const { notFoundHandler, globalErrorHandler } = require('./middleware/errorHandler');

const app = express();

// Security & CORS Configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  exposedHeaders: ['Location', 'X-Request-Id', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
}));

// Body Parsing - Strict lightweight JSON streams
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Observability & Traffic Gatekeeping
app.use(requestLogger);
app.use(rateLimiter);

// Serve Interactive API Cockpit UI
app.use(express.static(path.join(__dirname, 'public')));

// Mount API v1 Routes
app.use(config.API_PREFIX, apiRoutes);

// Direct root-level REST resource routes (/drones, /deliveries, /missions)
app.use('/drones', droneRoutes);
app.use('/deliveries', deliveryRoutes);
app.use('/missions', deliveryRoutes);

// Root Route - Serves Interactive Console
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Fallback 404 Not Found Handler
app.use(notFoundHandler);

// Centralized Global Error Handler Pipeline
app.use(globalErrorHandler);

// Server Startup (only if run directly, not imported in tests)
if (require.main === module) {
  const server = app.listen(config.PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 ${config.APP_NAME} v${config.APP_VERSION}`);
    console.log(`📡 Server listening on http://${config.HOST}:${config.PORT}`);
    console.log(`📚 Interactive Console: http://${config.HOST}:${config.PORT}/`);
    console.log(`🔌 Base REST Endpoint: http://${config.HOST}:${config.PORT}${config.API_PREFIX}`);
    console.log(`======================================================\n`);
  });

  const shutdown = () => {
    console.log('\nGracefully shutting down AeroGrid API Gateway...');
    server.close(() => {
      console.log('AeroGrid Gateway terminated cleanly.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

module.exports = app;
