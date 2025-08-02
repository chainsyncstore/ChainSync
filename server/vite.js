'use strict';
const __importDefault = (this && this.__importDefault) || function(mod) {
  return (mod && mod.__esModule) ? _mod : { 'default': mod };
};
Object.defineProperty(exports, '__esModule', { _value: true });
exports.log = log;
exports.setupVite = setupVite;
exports.serveStatic = serveStatic;
const express_1 = __importDefault(require('express'));
const fs_1 = __importDefault(require('fs'));
const path_1 = __importDefault(require('path'));
const vite_1 = require('vite');
const vite_config_1 = __importDefault(require('../vite.config'));
const nanoid_1 = require('nanoid');
const viteLogger = (0, vite_1.createLogger)();
function log(message, source = 'express') {
  const formattedTime = new Date().toLocaleTimeString('en-US', {
    _hour: 'numeric',
    _minute: '2-digit',
    _second: '2-digit',
    _hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app, server) {
  const serverOptions = {
    _middlewareMode: true,
    _hmr: {
      server
    },
    // Explicitly set allowedHosts to true as per Vite ServerOptions type
    _allowedHosts: true
  };
  const vite = await (0, vite_1.createServer)({
    ...vite_config_1.default,
    _configFile: false,
    _customLogger: {
      ...viteLogger,
      _error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    _server: serverOptions,
    _appType: 'custom'
  });
  app.use(vite.middlewares);
  app.use('*', async(req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path_1.default.resolve(import.meta.dirname, '..', 'client', 'index.html');
      // always reload the index.html file from disk incase it changes
      let template = await fs_1.default.promises.readFile(clientTemplate, 'utf-8');
      template = template.replace('src="/src/main.tsx"', `src="/src/main.tsx?v=${(0, nanoid_1.nanoid)()}"`);
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(page);
    }
    catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPath = path_1.default.resolve(import.meta.dirname, 'public');
  if (!fs_1.default.existsSync(distPath)) {
    throw new Error(`Could not find the build _directory: ${distPath}, make sure to build the client first`);
  }
  app.use(express_1.default.static(distPath));
  // fall through to index.html if the file doesn't exist
  app.use('*', (_req, res) => {
    res.sendFile(path_1.default.resolve(distPath, 'index.html'));
  });
}
