'use strict';
const __importDefault = (this && this.__importDefault) || function(mod) {
  return (mod && mod.__esModule) ? mod : { 'default': mod };
};
Object.defineProperty(exports, '__esModule', { value: true });
const express_1 = __importDefault(require('express'));
const http_1 = require('http');
const routes_js_1 = require('./routes.js');
const path_1 = __importDefault(require('path'));
const url_1 = require('url');
const __filename = (0, url_1.fileURLToPath)(import.meta.url);
const __dirname = path_1.default.dirname(__filename);
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
// Request logging middleware
app.use((req, _res, next) => {
  const timestamp = new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  console.log(`${timestamp} [express] ${req.method} ${req.url}`);
  next();
});
// Basic middleware
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: false }));
// CORS middleware
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (_req.method === 'OPTIONS') {
    res.sendStatus(200);
  }
  else {
    next();
  }
});
// API routes
(0, routes_js_1.registerRoutes)(app);
// Serve static files from client build directory
const clientBuildPath = path_1.default.resolve(__dirname, '../client/dist');
const clientIndexPath = path_1.default.resolve(__dirname, '../client/index.html');
// In development, serve the client files directly
if (process.env.NODE_ENV !== 'production') {
  // Serve static files from client/public
  app.use(express_1.default.static(path_1.default.resolve(__dirname, '../client/public')));
  // For development, serve the client index.html for all non-API routes
  app.get('*', async(req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
      return res.status(404).json({ error: 'Not found' });
    }
    try {
      // In development, serve the index.html directly
      res.sendFile(clientIndexPath);
    }
    catch (error) {
      console.error('Error serving client:', error);
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
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ChainSync Integrated Server',
    frontend: process.env.NODE_ENV !== 'production' ? 'development' : 'production',
    backend: 'running'
  });
});
// Error handling middleware
// @ts-ignore
app.use((err, _req, res, _next) => {
  console.error(`Error: ${err.message}`);
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});
const PORT = process.env.PORT || 5000;
async function startServer() {
  server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 ChainSync Integrated Server running on port ${PORT}`);
    console.log(`   Frontend: http://localhost:${PORT}/`);
    console.log(`   API: http://localhost:${PORT}/api/*`);
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log(`   Mode: ${process.env.NODE_ENV || 'development'}`);
  });
}
startServer().catch((error) => {
  console.error(`Failed to start server: ${error}`);
  process.exit(1);
});
