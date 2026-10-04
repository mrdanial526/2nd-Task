/**
 * DecodeLabs HTTP Request Logger & Correlation ID Tracer
 */

const crypto = require('crypto');

function requestLogger(req, res, next) {
  const start = Date.now();

  // Assign or propagate unique Request Correlation ID
  const requestId = req.headers['x-request-id'] || `req_${crypto.randomBytes(8).toString('hex')}`;
  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);

  // Response completion hook
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const userRole = req.user ? `${req.user.email} [${req.user.role}]` : 'Anonymous';
    
    // Format timestamp
    const timeStr = new Date().toISOString();
    const logLine = `[${timeStr}] [${requestId}] ${req.method} ${req.originalUrl || req.url} -> ${res.statusCode} (${durationMs}ms) - ${userRole}`;
    
    if (res.statusCode >= 500) {
      console.error(`\x1b[31m${logLine}\x1b[0m`);
    } else if (res.statusCode >= 400) {
      console.warn(`\x1b[33m${logLine}\x1b[0m`);
    } else {
      console.log(`\x1b[32m${logLine}\x1b[0m`);
    }
  });

  next();
}

module.exports = requestLogger;
