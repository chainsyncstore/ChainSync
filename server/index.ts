import express, { type Request, Response, NextFunction } from "express"; // Application removed
import { createRequestHandler, createErrorHandler, isMiddlewareFunction } from "./middleware/handler";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupSecureServer, enforceHttpsForPaymentRoutes } from "./config/https";
import { enforceHttpsForDialogflowRoutes, verifyDialogflowConfig } from "./config/dialogflow-security";
import { logNgrokInstructions } from "./config/ngrok";
import { setupSecurity } from "../middleware/security";
import { logger } from "./services/logger";
import * as Sentry from '@sentry/node';
import { env } from "@shared/env";
// import { env } from "./config/env"; // Unused
// import { ServiceError } from "./services/base/base-service"; // Unused
import { applyRateLimiters } from "./middleware/rate-limiter";
import { applyCORS } from "./middleware/cors";
import { initializeDatabase } from "./database";
import { initializeGlobals } from "@shared/db/types";

const app = express();

// --- Sentry Monitoring ---
Sentry.init({
  dsn: env.SENTRY_DSN,
  environment: env.NODE_ENV,
  tracesSampleRate: 1.0,
  integrations: [
    Sentry.httpIntegration(),
    Sentry.expressIntegration(),
  ],
});


// Initialize global database references
initializeGlobals();

// Initialize database connection
await initializeDatabase();

// Setup security middleware
setupSecurity(app);

// Apply middleware
const corsMiddleware = createRequestHandler((req, res, next) => {
  applyCORS(req, res, next);
});
const rateLimiterMiddleware = createRequestHandler(applyRateLimiters.applyRateLimiters);

if (isMiddlewareFunction(corsMiddleware) && isMiddlewareFunction(rateLimiterMiddleware)) {
  app.use(corsMiddleware);
  app.use(rateLimiterMiddleware);
}

// Enforce HTTPS for secure routes in production
const paymentRoutesMiddleware = createRequestHandler((req, res, next) => {
  enforceHttpsForPaymentRoutes(req, res, next);
});
const dialogflowRoutesMiddleware = createRequestHandler((req, res, next) => {
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

// Error handling middleware
const errorMiddleware = createErrorHandler((err, req, res, next) => {
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
const fallbackMiddleware = createErrorHandler((err: any, req: Request, res: Response, next: NextFunction) => {
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
// Register routes first
registerRoutes(app);
// Install Sentry error handler (new API)
Sentry.setupExpressErrorHandler(app);

// Add error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error(err.message, { stack: err.stack });

  if (err instanceof Error) {
    return res.status(500).json({
      success: false,
      error: {
        message: err.message,
        details: err.stack
      }
    });
  }

  res.status(500).json({
    success: false,
    error: {
      message: 'An unexpected error occurred'
    }
  });
});

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

(async () => {
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
  await registerRoutes(app); // ioServer removed

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Server error:", err);
    res.status(status).json({ message });
    // Don't throw the error after handling it - this causes unhandled promise rejections
  });

  // Set up static file serving or Vite middleware based on environment
  if (process.env.NODE_ENV === 'production') {
    serveStatic(app);
  } else {
    await setupVite(app, httpServer.server);
    // In development mode, show ngrok instructions for webhook testing
    logNgrokInstructions();
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = process.env.PORT || 5000;
  const host = '0.0.0.0';

  httpServer.server.listen(Number(port), host, () => {
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    log(`Server running in ${process.env.NODE_ENV || 'development'} mode`);
    log(`Listening on ${protocol}://${host}:${port}`);
  });
})();

export default app;
