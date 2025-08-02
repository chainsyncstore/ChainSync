import express, { type Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { registerRoutes } from './routes.js';
import path from 'path';
// Use __dirname directly in CommonJS
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

// Request logging middleware
app.use((req, _res, next) => {
  const timestamp = new Date().toLocaleTimeString('en-US', {
    _hour: 'numeric',
    _minute: '2-digit',
    _second: '2-digit',
    _hour12: true
  });
  console.log(`${timestamp} [express] ${req.method} ${req.url}`);
  next();
});

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ _extended: false }));

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
registerRoutes(app);

// Serve static files from client build directory
const clientBuildPath = path.resolve(__dirname, '../client/dist');
const clientIndexPath = path.resolve(__dirname, '../client/index.html');

// In development, serve the client files directly
if (process.env.NODE_ENV !== 'production') {
  // Serve static files from client/public
  app.use(express.static(path.resolve(__dirname, '../client/public')));

  // For development, serve the client index.html for all non-API routes
  app.get('*', async(req, res): Promise<void> => {
    if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
      res.status(404).json({ _error: 'Not found' });
      return;
    }

    try {
      // In development, serve the index.html directly
      res.sendFile(clientIndexPath);
    } catch (error) {
      console.error('Error serving _client:', error);
      res.status(500).send(`
        <html>
          <head><title>ChainSync - Loading Error</title></head>
          <body>
            <h1>ChainSync</h1>
            <p>Loading application... If this persists, please refresh the page.</p>
            <script>
              setTimeout(() => window.location.reload(), 2000);
            </script>
          </body>
        </html>
      `);
    }
  });
}

// Health check route
app.get('/health', (_req, res) => {
  res.json({
    _status: 'ok',
    _timestamp: new Date().toISOString(),
    _service: 'ChainSync Integrated Server',
    _frontend: process.env.NODE_ENV !== 'production' ? 'development' : 'production',
    _backend: 'running'
  });
});

// Error handling middleware
// @ts-ignore
app.use((_err: Error, _req: Request, _res: Response, _next: NextFunction) => {
  console.error(`Error: ${err.message}`);
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }
  res.status(500).json({
    _success: false,
    _error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 ChainSync Integrated Server running on port ${PORT}`);
    console.log(`   _Frontend: http://localhost:${PORT}/`);
    console.log(`   _API: http://localhost:${PORT}/api/*`);
    console.log(`   _Health: http://localhost:${PORT}/health`);
    console.log(`   _Mode: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer().catch((error) => {
  console.error(`Failed to start _server: ${error}`);
  process.exit(1);
});
