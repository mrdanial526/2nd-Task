/**
 * DecodeLabs Stateless Sliding-Window Rate Limiter
 */

const config = require('../config/env');

const ipHits = new Map();

// Periodic cleanup of expired rate limit windows
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of ipHits.entries()) {
    if (now - entry.startTime > config.RATE_LIMIT_WINDOW_MS) {
      ipHits.delete(key);
    }
  }
}, 30000);

function rateLimiter(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-client';
  const now = Date.now();

  let entry = ipHits.get(ip);
  if (!entry || now - entry.startTime > config.RATE_LIMIT_WINDOW_MS) {
    entry = {
      startTime: now,
      count: 1
    };
    ipHits.set(ip, entry);
  } else {
    entry.count++;
  }

  const remaining = Math.max(0, config.RATE_LIMIT_MAX_REQUESTS - entry.count);
  const resetSeconds = Math.ceil((entry.startTime + config.RATE_LIMIT_WINDOW_MS - now) / 1000);

  res.setHeader('X-RateLimit-Limit', config.RATE_LIMIT_MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', resetSeconds);

  if (entry.count > config.RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({
      status: 'error',
      statusCode: 429,
      code: 'RATE_LIMIT_EXCEEDED',
      message: `Too many requests from IP. Please retry after ${resetSeconds} seconds.`,
      retryAfterSeconds: resetSeconds,
      timestamp: new Date().toISOString()
    });
  }

  next();
}

module.exports = rateLimiter;
