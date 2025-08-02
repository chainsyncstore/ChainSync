// Mock implementations of security middleware used in production code.
const securityHeaders = (req, res, next) => next();
const csrfProtection = (req, res, next) => next();
const generateCsrfToken = (req, res, next) => {
  req.csrfToken = () => 'mock-token';
  next();
};
const validateContentType = (req, res, next) => next();

module.exports = {
  securityHeaders,
  csrfProtection,
  generateCsrfToken,
  validateContentType
};
