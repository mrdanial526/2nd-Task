/**
 * AeroGrid Backend API - Environment Configuration
 */

const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '4000', 10),
  HOST: process.env.HOST || 'localhost',

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '120', 10), // max 120 req/min per IP

  // Security & Authentication
  JWT_SECRET: process.env.JWT_SECRET || 'aerogrid_super_secret_jwt_key_2026',
  JWT_EXPIRES_IN: parseInt(process.env.JWT_EXPIRES_IN || '86400', 10), // 24 hours in seconds

  // API Metadata
  API_PREFIX: process.env.API_PREFIX || '/api/v1',
  APP_NAME: 'AeroGrid Autonomous Drone Dispatch API',
  APP_VERSION: '1.0.0',
};

module.exports = config;
