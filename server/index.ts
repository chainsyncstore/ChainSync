import express, { type Request, Response, NextFunction, Application } from "express";
import { createRequestHandler, createErrorHandler, isMiddlewareFunction } from "./middleware/handler";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupSecureServer, enforceHttpsForPaymentRoutes } from "./config/https";
import { enforceHttpsForDialogflowRoutes, verifyDialogflowConfig } from "./config/dialogflow-security";
import { logNgrokInstructions } from "./config/ngrok";
import { setupSecurity } from "../middleware/security";
import { logger } from "./services/logger";
import { env } from "./config/env";
import { ServiceError } from "./services/base/base-service";
import { applyRateLimiters } from "./middleware/rate-limiter";
import { applyCORS } from "./middleware/cors";
// initializeDatabase is handled by dbManager in ../db
import { initializeGlobals } from "@shared/db/types";
import { globalErrorHandler } from "../server/utils/handleError";
import { performanceMonitoring, memoryMonitoring } from "./middleware/performance-monitoring";
import { initializeMonitoring } from "../monitoring/opentelemetry";
import { runMigrations } from "../db/migrations";
import { dbManager } from "../db";

const app = express();

// Initialize performance monitoring
initializeMonitoring();

// Initialize global database references
initializeGlobals();

// Initialize database connection (now handled by importing dbManager/db from ../db)
// await initializeDatabase(); // This call is removed

// Setup security middleware
setupSecurity(app);

// Apply middleware
const corsMiddleware = createRequestHandler((req: any, res: Response, next: NextFunction) => { // req as any
  applyCORS(req, res, next);
});

// Apply rate limiters directly to the app
applyRateLimiters(app as Application); // Cast app to Application for type safety

if (isMiddlewareFunction(corsMiddleware)) { 
  app.use(corsMiddleware);
}

// Enforce HTTPS for secure routes in production
const paymentRoutesMiddleware = createRequestHandler((req: any, res: Response, next: NextFunction) => { // req as any
  enforceHttpsForPaymentRoutes(req, res, next);
});
const dialogflowRoutesMiddleware = createRequestHandler((req: any, res: Response, next: NextFunction) => { // req as any
  enforceHttpsForDialogflowRoutes(req, res, next);
});

if (isMiddlewareFunction(paymentRoutesMiddleware) && isMiddlewareFunction(dialogflowRoutesMiddleware)) {
  app.use(paymentRoutesMiddleware);
  app.use(dialogflowRoutesMiddleware);
}

// Fallback logging for server startup errors
process.on('uncaughtException', (err) => {
  // eslint-disable-next-line no-console
  console.error('Server failed to start:', err);
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled promise rejection:', err);
  process.exit(1);
});

// Parse request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add performance monitoring middleware
app.use(performanceMonitoring() as any);
app.use(memoryMonitoring() as any);

// Error handling middleware
const errorMiddleware = createErrorHandler((err: any, req: any, res: Response, next: NextFunction) => { // req as any
  logger.error(err.message, { stack: err.stack });

  if (err instanceof Error) {
    res.status(500).json({
      success: false,
      error: {
        message: err.message,
        details: err.stack
      }
    });
    return;
  }

  next(err);
});

// Register error middleware as the last app.use
app.use(errorMiddleware);

if (isMiddlewareFunction(errorMiddleware)) {
  app.use(errorMiddleware);
}

// Fallback error handler
const fallbackMiddleware = createErrorHandler((err: any, req: any, res: Response, next: NextFunction) => { // req as any
  logger.error('Unknown error:', err);
  res.status(500).json({
    success: false,
    error: {
      message: 'Internal server error',
      details: 'An unexpected error occurred'
    }
  });
});

if (isMiddlewareFunction(fallbackMiddleware)) {
  app.use(fallbackMiddleware);
}

// Register routes
registerRoutes(app);

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Database health check endpoint
app.get('/api/health/db', async (req, res) => {
  try {
    const stats = await dbManager.getPoolStats();
    res.json({ status: 'ok', dbStats: stats });
  } catch (error: unknown) {
    logger.error('Database health check failed', { error });
    res.status(500).json({ status: 'error', message: 'Database health check failed' });
  }
});

// Run database migrations
async function initialize() {
  try {
    // Run database migrations
    logger.info('Running database migrations');
    const migrationResult = await runMigrations();
    if (migrationResult.success) {
      logger.info('Database migrations completed successfully');
    } else {
      logger.error('Database migrations failed', { error: migrationResult.error });
    }
    
    // Verify Dialogflow configuration on startup
    const dialogflowConfigured = verifyDialogflowConfig();
    if (dialogflowConfigured) {
      log("Dialogflow configuration verified successfully");
    } else {
      log("Warning: Dialogflow not properly configured, will use fallback responses");
    }
    
    // Create an HTTP or HTTPS server first
    const { setupSecureServer } = await import('./config/https');
    const httpServer = setupSecureServer(app);
    
    // Use the HTTP server with routes and Socket.io
    await registerRoutes(app); // Removed unused ioServer assignment

    // Apply global error handler as the final middleware
    app.use(globalErrorHandler);

    // Set up static file serving or Vite middleware based on environment
    if (process.env.NODE_ENV === 'production') {
      serveStatic(app);
    } else {
      await setupVite(app, httpServer);
      // In development mode, show ngrok instructions for webhook testing
      logNgrokInstructions();
    }

    // ALWAYS serve the app on port 5000
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = process.env.PORT || 5000;
    const host = '0.0.0.0';

    httpServer.listen(Number(port), host, () => {
      const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
      log(`Server running in ${process.env.NODE_ENV || 'development'} mode`);
      log(`Listening on ${protocol}://${host}:${port}`);
    });
  } catch (error: unknown) {
    logger.error('Server initialization failed', { error });
    process.exit(1);
  }
}

// Initialize the application
initialize();

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await dbManager.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await dbManager.shutdown();
  process.exit(0);
});

export default app;
