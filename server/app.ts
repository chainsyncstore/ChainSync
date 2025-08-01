// server/app.ts - Application entry point with integrated security, logging, and monitoring
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { Pool } from 'pg';
// import { createClient } from 'redis'; // Unused
import RedisStore from 'connect-redis';
import path from 'path';
import fs from 'fs';

// Import logging and error handling
import { setupLogging, setupGlobalErrorHandlers } from '../src/logging/setup.js';
import { getLogger } from '../src/logging/index.js';
import { requestLogger, errorLogger } from '../src/logging/middleware.js';

// Import security middleware
import { 
  securityHeaders, 
  csrfProtection, 
  generateCsrfToken, 
  validateContentType,
  accountLockoutMiddleware,
  requireMFA,
  securityEventLogger
} from './middleware/security.js';
import { 
  rateLimitMiddleware, 
  authRateLimiter, 
  sensitiveOpRateLimiter,
  paymentRateLimiter,
  uploadRateLimiter,
  adminRateLimiter
} from './middleware/rate-limit.js';
import { isAuthenticated, validateSession } from './middleware/auth.js';
import { validateBody, sanitizeInput } from './middleware/validation.js';

// Import cache and job queue
import { initRedis, getRedisClient } from '../src/cache/redis.js';
import { initializeApp, registerHealthChecks } from '../src/startup.js';

// Import routes
import healthRoutes, { setDbPool } from './routes/health.js';
import transactionRoutes from './routes/transactions.js';
import monitoringRoutes from './routes/monitoring.js';
import adminDashboardRoutes from './routes/admin-dashboard.js';
import dashboardRoutes from './routes/dashboard.js';
import storesRoutes from './routes/stores.js';
import securityRoutes, { initializeSecurityRoutes } from './routes/security.js';
// Import your actual route files when they're ready
// import authRoutes from './routes/auth';
// import customerRoutes from './routes/customers';

// Import Swagger documentation
import setupSwagger from './swagger.js';

// Import monitoring
import { configureSentry } from '../src/monitoring/sentryIntegration.js';
import { initializeHealthChecks, initializeTracing } from './monitoring/setup.js';

// Set up global error handlers
setupGlobalErrorHandlers();

// Create Express application
const app = express();

// Configure logging before other middleware
setupLogging(app);

// Get configured logger
const logger = getLogger().child({ component: 'app' });

// Database connection pool
const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: parseInt(process.env.DB_POOL_SIZE || '10', 10),
  idleTimeoutMillis: 30000
});

// Monitor database connection
dbPool.on('error', (err) => {
  logger.error('Unexpected database error', err);
});

// Register database with health checks
registerHealthChecks(dbPool);

// Set database pool for health routes
setDbPool(dbPool);

// Initialize security routes
initializeSecurityRoutes(dbPool);

// Initialize Redis for caching and session store
const redisClient = initRedis();
let sessionStore: any;

if (redisClient) {
  sessionStore = new RedisStore({ client: redisClient });
  logger.info('Using Redis for session storage');
} else {
  logger.warn('Redis not available, using in-memory session store (not suitable for production)');
}

// Security middleware
app.use(securityHeaders);

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));

// Apply rate limiting
app.use(rateLimitMiddleware);

// Apply input sanitization
app.use(sanitizeInput);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session handling
app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || (() => {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET is required in production');
    }
    console.warn('⚠️  Using development session secret. Set SESSION_SECRET for production.');
    return 'dev-secret-change-in-production';
  })(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: parseInt(process.env.SESSION_COOKIE_MAX_AGE || '86400000'), // 24 hours
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
  }
}));

// Generate CSRF token for all routes that need it
app.use(generateCsrfToken as any);

// Health check routes (no auth required)
app.use('/api/health', healthRoutes);

// Kubernetes standard health check endpoints (no auth required)
app.use('/healthz', healthRoutes);
app.use('/readyz', healthRoutes);

// Define route-specific middleware for API routes
const apiRoutes = express.Router();

// Apply validation and rate limiting to API routes
apiRoutes.use(validateContentType() as any);
apiRoutes.use(csrfProtection as any);

// Apply different rate limits to different types of endpoints
apiRoutes.use('/auth', authRateLimiter);
apiRoutes.use(['/transactions', '/loyalty'], sensitiveOpRateLimiter);
apiRoutes.use('/payment', paymentRateLimiter);
apiRoutes.use('/upload', uploadRateLimiter);
apiRoutes.use('/admin', adminRateLimiter);

// Register API routes
apiRoutes.use('/health', healthRoutes);
apiRoutes.use('/transactions', transactionRoutes);
apiRoutes.use('/monitoring', monitoringRoutes);
apiRoutes.use('/admin/dashboard', adminDashboardRoutes);
apiRoutes.use('/dashboard', dashboardRoutes);
apiRoutes.use('/stores', storesRoutes);
apiRoutes.use('/security', securityRoutes);
// apiRoutes.use('/auth', authRoutes);
// apiRoutes.use('/customers', customerRoutes);

// Apply API routes
app.use('/api/v1', apiRoutes);

// Serve static files (both development and production)
// Try multiple possible build output directories
const possiblePaths = [
  path.join(__dirname, '../../client'), // Development build
  path.join(__dirname, '../../dist/client'), // Production build
  path.join(__dirname, '../dist/client'), // Alternative production build
  path.join(__dirname, '../client'), // Server running from dist/server
];

let staticPath = null;
for (const testPath of possiblePaths) {
  if (fs.existsSync(path.join(testPath, 'index.html'))) {
    staticPath = testPath;
    break;
  }
}

if (!staticPath) {
  console.error('Could not find client build files. Tried paths:', possiblePaths);
  process.exit(1);
}

console.log('Serving static files from:', staticPath);

// Serve static files with proper MIME types
app.use(express.static(staticPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (filePath.endsWith('.mjs')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    } else if (filePath.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json');
    } else if (filePath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html');
    } else if (filePath.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml');
    } else if (filePath.endsWith('.ico')) {
      res.setHeader('Content-Type', 'image/x-icon');
    } else if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    }
  }
}));

// Handle SPA routing - serve index.html for any non-API routes
app.get('*', (req, res, next) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(staticPath, 'index.html'));
  } else {
    next();
  }
});

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
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Error is already logged by the errorLogger middleware
  // Just send appropriate response to client
  
  const statusCode = err.status || err.statusCode || 500;
  const errorResponse = {
    error: err.message || 'Internal Server Error',
    code: err.code || 'UNKNOWN_ERROR'
  };
  
  // Add stack trace in development
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    (errorResponse as any).stack = err.stack;
  }
  
  res.status(statusCode).json(errorResponse);
});

// Initialize application components (caching, job queues, etc.)
if (process.env.NODE_ENV !== 'test') {
  // Initialize Swagger documentation
  setupSwagger(app);
  
  // Initialize monitoring and Sentry integration
  configureSentry(app);
  
  // Initialize distributed tracing with OpenTelemetry
  initializeTracing();
  
  // Initialize health checks
  initializeHealthChecks(app);
  
  // Initialize caching, queues, etc.
  initializeApp(app, dbPool).catch(err => {
    logger.error('Failed to initialize application components', err);
    process.exit(1);
  });
}

export { app, dbPool };
export default app;
