import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { router } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
const server = createServer(app);

// Request logging middleware
app.use((req, _res, next) => {
  log(`${req.method} ${req.url}`, 'req');
  next();
});

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS middleware
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (_req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// API routes
app.use(router);

// Error handling middleware
// @ts-ignore
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  log(`Error: ${err.message}`, 'error');
  res.status(500).json({ 
    success: false, 
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error' 
  });
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    await setupVite(app, server);
  }

  server.listen(Number(PORT), "0.0.0.0", () => {
    log(`Server running on port ${PORT}`);
  });
}

startServer().catch((error) => {
  log(`Failed to start server: ${error}`, 'error');
  process.exit(1);
});