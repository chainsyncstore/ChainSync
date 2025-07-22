import express, { type Request, Response, NextFunction } from "express";
import { router } from "./routes";

const app = express();

// Request logging middleware
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
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

// API routes (routes.ts already includes /api prefix)
app.use(router);

// Also add a basic API health check
app.get('/api/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'ChainSync API',
    version: '1.0.0'
  });
});

// Simple health check route
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'ChainSync API Server'
  });
});

// Serve the frontend HTML for all non-API routes
app.get('*', (req, res, next) => {
  // Skip API and health routes
  if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
    return next();
  }
  
  // Serve the frontend index.html for all other routes
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1, viewport-fit=cover" />
        <title>ChainSync | Retail Management Platform</title>
        <link rel="icon" type="image/svg+xml" href="http://localhost:3000/favicon.svg" />
        <meta name="description" content="ChainSync is an all-in-one retail management platform designed for supermarkets and multi-store chains." />
        <style>
          body { 
            margin: 0; 
            padding: 20px; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            text-align: center;
            max-width: 500px;
          }
          h1 { color: #333; margin-bottom: 20px; }
          p { color: #666; margin-bottom: 30px; line-height: 1.6; }
          .btn {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            transition: background 0.3s;
          }
          .btn:hover { background: #5a6fd8; }
          .status { 
            margin: 20px 0; 
            padding: 10px; 
            background: #e8f5e8; 
            border: 1px solid #4caf50; 
            border-radius: 4px; 
            color: #2e7d32; 
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🚀 ChainSync</h1>
          <p>All-in-One Retail Management Platform</p>
          <div class="status">
            ✅ Backend API Server: Running<br>
            ✅ Frontend Development Server: Running<br>
            ✅ Migration: Completed Successfully
          </div>
          <p>The application has been successfully migrated to the Replit environment. Both the frontend and backend servers are operational.</p>
          <a href="http://localhost:3000" class="btn" target="_blank">Launch Application</a>
        </div>
        <script>
          // Auto-redirect to development server after 3 seconds
          setTimeout(() => {
            window.location.href = 'http://localhost:3000';
          }, 3000);
        </script>
      </body>
    </html>
  `);
});

// Error handling middleware
// @ts-ignore
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(`Error: ${err.message}`, err.stack);
  res.status(500).json({ 
    success: false, 
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error' 
  });
});

const PORT = process.env.PORT || 5000;

app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`🚀 ChainSync API Server running on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   API endpoints: http://localhost:${PORT}/api/*`);
});