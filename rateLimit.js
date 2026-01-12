/**
 * Rate Limiting Middleware for Headless-web
 * Implements per-IP and per-session rate limiting
 */

/**
 * In-memory storage for rate limiting
 * In production, consider using Redis or similar
 */
const ipRequestCounts = new Map();
const sessionCounts = new Map();

/**
 * Configuration
 */
const config = {
  windowMs: 60 * 1000, // 1 minute window
  maxRequestsPerIP: 60, // 60 requests per minute per IP
  maxSessionsPerIP: 10, // Maximum 10 sessions per IP
  cleanupIntervalMs: 5 * 60 * 1000 // Cleanup every 5 minutes
};

/**
 * Get client IP address from request
 * SECURITY NOTE: X-Forwarded-For and X-Real-IP headers can be spoofed.
 * In production, ensure your load balancer/reverse proxy is trusted and
 * properly configured to strip/overwrite these headers to prevent IP spoofing.
 * Consider using a middleware like 'express-rate-limit' with a trusted proxy configuration.
 */
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    'unknown';
}

/**
 * Clean up old entries
 */
function cleanup() {
  const now = Date.now();

  // Clean IP request counts
  for (const [ip, data] of ipRequestCounts.entries()) {
    if (now - data.resetTime > config.windowMs) {
      ipRequestCounts.delete(ip);
    }
  }

  // Clean session counts
  for (const [ip, data] of sessionCounts.entries()) {
    if (now - data.resetTime > config.windowMs) {
      sessionCounts.delete(ip);
    }
  }
}

// Start cleanup interval
setInterval(cleanup, config.cleanupIntervalMs);

/**
 * Rate limiting middleware for general requests
 */
function rateLimitMiddleware(req, res, next) {
  const ip = getClientIP(req);
  const now = Date.now();

  // Get or create IP data
  let ipData = ipRequestCounts.get(ip);

  if (!ipData || now - ipData.resetTime > config.windowMs) {
    // New window
    ipData = {
      count: 0,
      resetTime: now
    };
    ipRequestCounts.set(ip, ipData);
  }

  // Increment request count
  ipData.count++;

  // Check if limit exceeded
  if (ipData.count > config.maxRequestsPerIP) {
    const resetIn = Math.ceil((config.windowMs - (now - ipData.resetTime)) / 1000);

    return res.status(429).json({
      error: 'Too many requests',
      message: `Rate limit exceeded. Please try again in ${resetIn} seconds.`,
      retryAfter: resetIn
    });
  }

  // Set rate limit headers
  res.setHeader('X-RateLimit-Limit', config.maxRequestsPerIP);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, config.maxRequestsPerIP - ipData.count));
  res.setHeader('X-RateLimit-Reset', new Date(ipData.resetTime + config.windowMs).toISOString());

  // Store for later use in response middleware
  res.locals.rateLimit = {
    limit: config.maxRequestsPerIP,
    remaining: Math.max(0, config.maxRequestsPerIP - ipData.count),
    reset: new Date(ipData.resetTime + config.windowMs).toISOString()
  };

  next();
}

/**
 * Session creation rate limiting
 */
function sessionRateLimitMiddleware(req, res, next) {
  const ip = getClientIP(req);
  const now = Date.now();

  // Get or create session count data
  let sessionData = sessionCounts.get(ip);

  if (!sessionData || now - sessionData.resetTime > config.windowMs) {
    // New window
    sessionData = {
      count: 0,
      resetTime: now
    };
    sessionCounts.set(ip, sessionData);
  }

  // Increment session count
  sessionData.count++;

  // Check if limit exceeded
  if (sessionData.count > config.maxSessionsPerIP) {
    const resetIn = Math.ceil((config.windowMs - (now - sessionData.resetTime)) / 1000);

    return res.status(429).json({
      error: 'Too many sessions',
      message: `Session creation limit exceeded. Please try again in ${resetIn} seconds.`,
      retryAfter: resetIn
    });
  }

  next();
}

/**
 * Get current rate limit status for an IP
 */
function getRateLimitStatus(ip) {
  const now = Date.now();
  const ipData = ipRequestCounts.get(ip);
  const sessionData = sessionCounts.get(ip);

  return {
    requests: {
      count: ipData ? ipData.count : 0,
      limit: config.maxRequestsPerIP,
      remaining: ipData ? Math.max(0, config.maxRequestsPerIP - ipData.count) : config.maxRequestsPerIP,
      resetTime: ipData ? new Date(ipData.resetTime + config.windowMs).toISOString() : null
    },
    sessions: {
      count: sessionData ? sessionData.count : 0,
      limit: config.maxSessionsPerIP,
      remaining: sessionData ? Math.max(0, config.maxSessionsPerIP - sessionData.count) : config.maxSessionsPerIP,
      resetTime: sessionData ? new Date(sessionData.resetTime + config.windowMs).toISOString() : null
    }
  };
}

module.exports = {
  rateLimitMiddleware,
  sessionRateLimitMiddleware,
  getRateLimitStatus,
  getClientIP,
  config
};
