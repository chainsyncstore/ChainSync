// Mock implementations of security middleware used in production code.
export const securityHeaders = (req, res, next) => next();
export const csrfProtection = (req, res, next) => next();
export const generateCsrfToken = (req, res, next) => {
  req.csrfToken = () => 'mock-token';
  next();
};
export const validateContentType = (req, res, next) => next();
