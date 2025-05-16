import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupSecureServer, enforceHttpsForPaymentRoutes } from "./config/https";
import { logNgrokInstructions } from "./config/ngrok";

const app = express();

// Enforce HTTPS for payment routes in production
app.use(enforceHttpsForPaymentRoutes);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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
  // Use secure server configuration instead of plain HTTP server
  const server = await registerRoutes(app);

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
    await setupVite(app, server);
    // In development mode, show ngrok instructions for webhook testing
    logNgrokInstructions();
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = process.env.PORT || 5000;
  const host = '0.0.0.0';

  server.listen({
    port,
    host,
    reusePort: true,
  }, () => {
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    log(`Server running in ${process.env.NODE_ENV || 'development'} mode`);
    log(`Listening on ${protocol}://${host}:${port}`);
  });
})();