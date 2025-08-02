// tests/__mocks__/rate-limit.js
// Simple noop rate-limit middleware stubs for Jest. The real implementation
// uses express-rate-limit; for tests we just call next() immediately so routes
// under test are not blocked.

const passThrough = (_req, _res, next) => {
  if (typeof next === 'function') next();
};

module.exports = {
  rateLimitMiddleware: passThrough,
  authRateLimiter: passThrough,
  sensitiveOpRateLimiter: passThrough
};
