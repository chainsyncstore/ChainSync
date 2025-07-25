import 'module-alias/register';
import express from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupSecureServer, enforceHttpsForPaymentRoutes } from "./config/https";
import { enforceHttpsForDialogflowRoutes, verifyDialogflowConfig } from "./config/dialogflow-security";
import { logNgrokInstructions } from "./config/ngrok";
import { setupSecurity } from "../middleware/security";
import logger from "@shared/logging";
import { env } from "@shared/env";
import { initializeGlobals } from "@shared/db/types";
import { rateLimitMiddleware } from "./middleware/rate-limit";
import { applyCORS } from "../middleware/cors";
import { initializeDatabase } from "./database";
import { errorHandler } from './middleware/error-handler';

const app = express();
const port = env.PORT;

async function startServer() {
  // Initialize globals
  initializeGlobals();

  // Initialize database
  await initializeDatabase();

  // Setup security middleware
  setupSecurity(app);

  // Apply CORS
  applyCORS(app);

  // Apply rate limiters
  app.use(rateLimitMiddleware);

  // Enforce HTTPS for payment routes
  app.use('/api/payments', (req: express.Request, res: express.Response, next: express.NextFunction) => {
    enforceHttpsForPaymentRoutes(req, res, next);
  });

  // Enforce HTTPS for Dialogflow routes
  app.use('/api/dialogflow', (req: express.Request, res: express.Response, next: express.NextFunction) => {
    enforceHttpsForDialogflowRoutes(req, res, next);
  });

  // Register application routes
  registerRoutes(app);

  // Serve static files
  serveStatic(app);

  // Error handling middleware
  app.use(errorHandler);

  // Start the server
  const { server } = setupSecureServer(app);

  // Setup Vite for development
  await setupVite(app, server);

  server.listen(env.PORT, () => {
    log(`Server is listening on port ${env.PORT}`);
    logNgrokInstructions();
    verifyDialogflowConfig();
  });
}

startServer();
