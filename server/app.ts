// server/app.ts - Application entry point with integrated security, logging, and monitoring
import path from 'path';

import { RedisStore } from 'connect-redis';
import cors from 'cors';
import express from 'express';
import session from 'express-session';
import { createClient } from 'redis';

// Import logging and error handling
import { dbPool } from './db'; // Or adjust path as needed
import { isAuthenticated, validateSession } from './middleware/auth';
import {
  rateLimitMiddleware,
  authRateLimiter,
  sensitiveOpRateLimiter,
  applyRateLimiters,
} from './middleware/rate-limiter';
import {
  securityHeaders,
  csrfProtection,
  generateCsrfToken,
  validateContentType,
} from './middleware/security';
import { validateBody } from './middleware/validation';
import adminDashboardRoutes from './routes/admin-dashboard';
import healthRoutes from './routes/health';
import monitoringRoutes from './routes/monitoring';
import transactionRoutes from './routes/transactions';
import setupSwagger from './swagger';
import { initRedis, getRedisClient } from '../src/cache/redis';
import { getLogger } from '../src/logging/index';
import { requestLogger, errorLogger } from '../src/logging/middleware';
import { setupLogging, setupGlobalErrorHandlers } from '../src/logging/setup';

// Import security middleware

// Import cache and job queue
import { configureSentry } from '../src/monitoring/sentryIntegration';
import { initializeHealthChecks, initializeTracing } from '../src/monitoring/setup';
import { initializeApp, registerHealthChecks } from '../src/startup';

// Import routes
// Import your actual route files when they're ready
// import authRoutes from './routes/auth';
// import customerRoutes from './routes/customers';

// Import Swagger documentation

// Import monitoring

// Set up global error handlers
setupGlobalErrorHandlers();

// Create Express application
const app = express();

// Configure logging before other middleware
setupLogging(app);

// Get configured logger
const logger = getLogger().child({ component: 'app' }); // Ensure getLogger() returns a pino instance

// Import and register database pool for health checks
registerHealthChecks(dbPool);

// Initialize Redis for caching and session store
const redisClient = initRedis();
let sessionStore: session.Store | undefined; // Explicit type

if (redisClient) {
  sessionStore = new RedisStore({ client: redisClient }) as session.Store;
  logger.info('Using Redis for session storage');
} else {
  logger.warn('Redis not available, using in-memory session store (not suitable for production)');
}

// Security middleware
app.use(securityHeaders);

// CORS configuration
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  })
);

// Apply rate limiting
app.use(rateLimitMiddleware);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session handling
app.use(
  session({
    // Only spread/store if sessionStore is defined
    ...(sessionStore ? { store: sessionStore } : {}),
    secret: process.env.SESSION_SECRET || 'dev-secret-should-be-changed',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax',
    },
  })
);

// Generate CSRF token for all routes that need it
app.use(generateCsrfToken);

// Health check routes (no auth required)
app.use('/api/health', healthRoutes);

// Kubernetes standard health check endpoints (no auth required)
app.use('/healthz', healthRoutes);
app.use('/readyz', healthRoutes);

// Define route-specific middleware for API routes
const apiRoutes = express.Router();

// Apply validation and rate limiting to API routes
apiRoutes.use(validateContentType());
apiRoutes.use(csrfProtection);

// Apply different rate limits to different types of endpoints
apiRoutes.use('/auth', authRateLimiter);
apiRoutes.use(['/transactions', '/loyalty'], sensitiveOpRateLimiter);

// Register API routes
apiRoutes.use('/health', healthRoutes);
apiRoutes.use('/transactions', transactionRoutes);
apiRoutes.use('/monitoring', monitoringRoutes);
apiRoutes.use('/admin/dashboard', adminDashboardRoutes);
// apiRoutes.use('/auth', authRoutes);
// apiRoutes.use('/customers', customerRoutes);

// Apply API routes
app.use('/api/v1', apiRoutes);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const staticPath = path.join(__dirname, '../public');
  app.use(express.static(staticPath));

  // Handle SPA routing - serve index.html for any non-API routes
  app.get('*', (req, res, next) => {
    if (!req.path.startsWith('/api/')) {
      res.sendFile(path.join(staticPath, 'index.html'));
    } else {
      next();
    }
  });
}

// 404 handler
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.warn('Route not found', {
    path: req.path,
    method: req.method,
    ip: req.ip,
  });
  res.status(404).json({
    error: 'Route not found',
    code: 'NOT_FOUND',
  });
});

// Sentry error handler middleware is already configured via configureSentry

// Global error handler - must be the last middleware
app.use(((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Error is already logged by the errorLogger middleware
  // Just send appropriate response to client

  const statusCode = err.status || err.statusCode || 500;
  const errorResponse = {
    error: err.message || 'Internal Server Error',
    code: err.code || 'UNKNOWN_ERROR',
  };

  // Add stack trace in development
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    (errorResponse as any).stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
}) as express.ErrorRequestHandler); // Use correct type

// Initialize application components (caching, job queues, etc.)
if (process.env.NODE_ENV !== 'test') {
  // Initialize Swagger documentation
  setupSwagger(app);

  // Initialize monitoring and Sentry integration
  configureSentry(app);

  // Initialize distributed tracing with OpenTelemetry
  initializeTracing(app);

  // Initialize health checks
  initializeHealthChecks(app, dbPool);

  // Initialize caching, queues, etc.
  initializeApp(app, dbPool).catch(err => {
    logger.error('Failed to initialize application components', err);
    process.exit(1);
  });
}

// If you have test/mocks in this file or related files, ensure they are explicitly typed.
// Example for a mock (if present in tests):
// const mockDbPool: jest.Mocked<Pool> = { query: jest.fn() } as any;

// Remove any unused @ts-expect-error comments in your test files (none present here).

// Example: Ensure dbPool is properly typed and initialized
// If using a specific ORM (e.g., Knex, Prisma), import and use the correct type
// import { dbPool } from './db'; // Should be of type Pool from 'pg' or appropriate ORM type

// When using dbPool in your code, ensure you use the correct API for your ORM/driver.
// For example, if using pg.Pool:
// await dbPool.query('SELECT * FROM users');

// If you migrated from another ORM, update usages accordingly.
// Example: If you previously used db.insert(...) and now should use dbPool.query(...), update all such calls in your codebase.

export { app, dbPool };
export default app;
