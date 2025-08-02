'use strict';
const __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  let desc = Object.getOwnPropertyDescriptor(m, k);
  if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
    desc = { enumerable: true, get: function() { return m[k]; } };
  }
  Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  o[k2] = m[k];
}));
const __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
  Object.defineProperty(o, 'default', { enumerable: true, value: v });
}) : function(o, v) {
  o['default'] = v;
});
const __importStar = (this && this.__importStar) || (function() {
  let ownKeys = function(o) {
    ownKeys = Object.getOwnPropertyNames || function(o) {
      const ar = [];
      for (const k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
      return ar;
    };
    return ownKeys(o);
  };
  return function(mod) {
    if (mod && mod.__esModule) return mod;
    const result = {};
    if (mod != null) for (let k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== 'default') __createBinding(result, mod, k[i]);
    __setModuleDefault(result, mod);
    return result;
  };
})();
const __importDefault = (this && this.__importDefault) || function(mod) {
  return (mod && mod.__esModule) ? mod : { 'default': mod };
};
Object.defineProperty(exports, '__esModule', { value: true });
exports.dbPool = exports.app = void 0;
// server/app.ts - Application entry point with integrated security, logging, and monitoring
const express_1 = __importDefault(require('express'));
const cors_1 = __importDefault(require('cors'));
const express_session_1 = __importDefault(require('express-session'));
const pg_1 = require('pg');
// import { createClient } from 'redis'; // Unused
const connect_redis_1 = require('connect-redis');
const path_1 = __importDefault(require('path'));
// Import logging and error handling
const setup_js_1 = require('../src/logging/setup.js');
const index_js_1 = require('../src/logging/index.js');
// Import security middleware
const security_js_1 = require('./middleware/security.js');
const rate_limit_js_1 = require('./middleware/rate-limit.js');
// Import cache and job queue
const redis_js_1 = require('../src/cache/redis.js');
const startup_js_1 = require('../src/startup.js');
// Import routes
const health_js_1 = __importStar(require('./routes/health.js'));
const transactions_js_1 = __importDefault(require('./routes/transactions.js'));
const monitoring_js_1 = __importDefault(require('./routes/monitoring.js'));
const admin_dashboard_js_1 = __importDefault(require('./routes/admin-dashboard.js'));
// Import your actual route files when they're ready
// import authRoutes from './routes/auth';
// import customerRoutes from './routes/customers';
// Import Swagger documentation
const swagger_js_1 = __importDefault(require('./swagger.js'));
// Import monitoring
const sentryIntegration_js_1 = require('../src/monitoring/sentryIntegration.js');
const setup_js_2 = require('../src/monitoring/setup.js');
// Set up global error handlers
(0, setup_js_1.setupGlobalErrorHandlers)();
// Create Express application
const app = (0, express_1.default)();
exports.app = app;
// Configure logging before other middleware
(0, setup_js_1.setupLogging)(app);
// Get configured logger
const logger = (0, index_js_1.getLogger)().child({ component: 'app' });
// Database connection pool
const dbPool = new pg_1.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: parseInt(process.env.DB_POOL_SIZE || '10', 10),
  idleTimeoutMillis: 30000
});
exports.dbPool = dbPool;
// Monitor database connection
dbPool.on('error', (err) => {
  logger.error('Unexpected database error', err);
});
// Register database with health checks
(0, startup_js_1.registerHealthChecks)(dbPool);
// Set database pool for health routes
(0, health_js_1.setDbPool)(dbPool);
// Initialize Redis for caching and session store
const redisClient = (0, redis_js_1.initRedis)();
let sessionStore;
if (redisClient) {
  sessionStore = new connect_redis_1.RedisStore({ client: redisClient });
  logger.info('Using Redis for session storage');
}
else {
  logger.warn('Redis not available, using in-memory session store (not suitable for production)');
}
// Security middleware
app.use(security_js_1.securityHeaders);
// CORS configuration
app.use((0, cors_1.default)({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));
// Apply rate limiting
app.use(rate_limit_js_1.rateLimitMiddleware);
// Body parsing middleware
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Session handling
app.use((0, express_session_1.default)({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'dev-secret-should-be-changed',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax'
  }
}));
// Generate CSRF token for all routes that need it
app.use(security_js_1.generateCsrfToken);
// Health check routes (no auth required)
app.use('/api/health', health_js_1.default);
// Kubernetes standard health check endpoints (no auth required)
app.use('/healthz', health_js_1.default);
app.use('/readyz', health_js_1.default);
// Define route-specific middleware for API routes
const apiRoutes = express_1.default.Router();
// Apply validation and rate limiting to API routes
apiRoutes.use((0, security_js_1.validateContentType)());
apiRoutes.use(security_js_1.csrfProtection);
// Apply different rate limits to different types of endpoints
apiRoutes.use('/auth', rate_limit_js_1.authRateLimiter);
apiRoutes.use(['/transactions', '/loyalty'], rate_limit_js_1.sensitiveOpRateLimiter);
// Register API routes
apiRoutes.use('/health', health_js_1.default);
apiRoutes.use('/transactions', transactions_js_1.default);
apiRoutes.use('/monitoring', monitoring_js_1.default);
apiRoutes.use('/admin/dashboard', admin_dashboard_js_1.default);
// apiRoutes.use('/auth', authRoutes);
// apiRoutes.use('/customers', customerRoutes);
// Apply API routes
app.use('/api/v1', apiRoutes);
// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const staticPath = path_1.default.join(__dirname, '../public');
  app.use(express_1.default.static(staticPath));
  // Handle SPA routing - serve index.html for any non-API routes
  app.get('*', (req, res, next) => {
    if (!req.path.startsWith('/api/')) {
      res.sendFile(path_1.default.join(staticPath, 'index.html'));
    }
    else {
      next();
    }
  });
}
// 404 handler
app.use((req, res, next) => {
  logger.warn('Route not found', {
    path: req.path,
    method: req.method,
    ip: req.ip
  });
  res.status(404).json({
    error: 'Route not found',
    code: 'NOT_FOUND'
  });
});
// Sentry error handler middleware is already configured via configureSentry
// Global error handler - must be the last middleware
app.use((err, req, res, next) => {
  // Error is already logged by the errorLogger middleware
  // Just send appropriate response to client
  const statusCode = err.status || err.statusCode || 500;
  const errorResponse = {
    error: err.message || 'Internal Server Error',
    code: err.code || 'UNKNOWN_ERROR'
  };
    // Add stack trace in development
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    errorResponse.stack = err.stack;
  }
  res.status(statusCode).json(errorResponse);
});
// Initialize application components (caching, job queues, etc.)
if (process.env.NODE_ENV !== 'test') {
  // Initialize Swagger documentation
  (0, swagger_js_1.default)(app);
  // Initialize monitoring and Sentry integration
  (0, sentryIntegration_js_1.configureSentry)(app);
  // Initialize distributed tracing with OpenTelemetry
  (0, setup_js_2.initializeTracing)(app);
  // Initialize health checks
  (0, setup_js_2.initializeHealthChecks)(app, dbPool);
  // Initialize caching, queues, etc.
  (0, startup_js_1.initializeApp)(app, dbPool).catch(err => {
    logger.error('Failed to initialize application components', err);
    process.exit(1);
  });
}
exports.default = app;
