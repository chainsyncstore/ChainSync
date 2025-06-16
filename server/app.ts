// server/app.ts - Application entry point with integrated security, logging, and monitoring
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { Pool } from 'pg';
// import { createClient } from 'redis'; // Unused
import { RedisStore } from 'connect-redis';
import path from 'path';

// Import logging and error handling
import { setupLogging, setupGlobalErrorHandlers } from '../src/logging/setup';
import { getLogger } from '../src/logging';
// import { requestLogger, errorLogger } from '../src/logging/middleware'; // Unused

// Import security middleware
import { securityHeaders, csrfProtection, generateCsrfToken, validateContentType } from './middleware/security';
import { rateLimitMiddleware, authRateLimiter, sensitiveOpRateLimiter } from './middleware/rate-limit';
import { validateSession } from './middleware/auth'; // isAuthenticated removed
// import { validateBody } from './middleware/validation'; // Unused

// Import cache and job queue
import { initRedis } from '../src/cache/redis'; // getRedisClient removed
import { initializeApp, registerHealthChecks } from '../src/startup';

// Import routes
import healthRoutes, { setDbPool } from './routes/health';
import transactionRoutes from './routes/transactions';
import monitoringRoutes from './routes/monitoring';
import adminDashboardRoutes from './routes/admin-dashboard';
// Import your actual route files when they're ready
// import authRoutes from './routes/auth';
// import customerRoutes from './routes/customers';

// Import Swagger documentation
import setupSwagger from './swagger';

// Import monitoring
import { configureSentry } from '../src/monitoring/sentryIntegration';
import { initializeHealthChecks, initializeTracing } from '../src/monitoring/setup';

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

// Initialize Redis for caching and session store
const redisClient = initRedis();
let sessionStore: RedisStore | undefined;

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

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session handling
app.use(session({
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
app.use((err: Error & { status?: number; statusCode?: number; code?: string }, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Error is already logged by the errorLogger middleware
  // Just send appropriate response to client
  
  const statusCode = err.status || err.statusCode || 500;
  const errorResponse = {
    error: err.message || 'Internal Server Error',
    code: err.code || 'UNKNOWN_ERROR'
  };
  
  // Add stack trace in development
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    (errorResponse as { stack?: string }).stack = err.stack;
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
  initializeTracing(app);
  
  // Initialize health checks
  initializeHealthChecks(app, dbPool);
  
  // Initialize caching, queues, etc.
  initializeApp(app, dbPool).catch(err => {
    logger.error('Failed to initialize application components', err);
    process.exit(1);
  });
}

export { app, dbPool };
export default app;
