/**
 * @module rateLimiter
 * @description Express rate limiting middleware.
 * Limits each IP to 100 requests per 15-minute window.
 */

const rateLimit = require('express-rate-limit');

/**
 * Rate limiter middleware — 100 requests per 15 minutes per IP.
 * Returns a 429 response with a JSON error when limit is exceeded.
 */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again in a few minutes.'
  }
});

module.exports = limiter;
