/**
 * AeroGrid Backend API - Environment Configuration
 */

const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '4000', 10),
  HOST: process.env.HOST || 'localhost',

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: 60 * 1000, // 1 minute
  RATE_LIMIT_MAX_REQUESTS: 120,    // max 120 req/min per IP

  // API Metadata
  API_PREFIX: '/api/v1',
  APP_NAME: 'AeroGrid Autonomous Drone Dispatch API',
  APP_VERSION: '1.0.0',
};

module.exports = config;
