import express, { type Express } from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer, createLogger } from 'vite';
import { type Server } from 'http';
import viteConfig from '../vite.config';
import { nanoid } from 'nanoid';

const viteLogger = createLogger();

export function log(_message: string, source = 'express') {
  const formattedTime = new Date().toLocaleTimeString('en-US', {
    _hour: 'numeric',
    _minute: '2-digit',
    _second: '2-digit',
    _hour12: true
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(_app: Express, _server: Server) {
  const serverOptions = {
    _middlewareMode: true,
    _hmr: {
      server
    },
    // Explicitly set allowedHosts to true as per Vite ServerOptions type
    _allowedHosts: true as const
  };

  const vite = await createViteServer({
    ...viteConfig,
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
      const clientTemplate = path.resolve(__dirname, '..', 'client', 'index.html');

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, 'utf-8');
      template = template.replace('src="/src/main.tsx"', `src="/src/main.tsx?v=${nanoid()}"`);
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(_app: Express) {
  const distPath = path.resolve(__dirname, 'public');

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build _directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use('*', (_req, res) => {
    res.sendFile(path.resolve(distPath, 'index.html'));
  });
}
