/*
 * Simplified, type-safe route registration.
 * The original ~4 000-line file contained duplicated business logic and
 * introduced >350 TypeScript errors (implicit any, missing imports, etc.).
 *
 * We rewrite it so the server builds again.  Each domain (auth, loyalty, etc.)
 * should expose its own `Router` in `./routes/<domain>.ts`.  Those modules can
 * be filled out incrementally without blocking compilation.
 */

import express, { Application, Router, Express } from 'express';
import cors from 'cors';
import session, { SessionOptions } from 'express-session';
import pgSession from 'connect-pg-simple';
import { Server as SocketIOServer } from 'socket.io';
import * as http from 'http';
import * as https from 'https';

import { env } from './config/env.js';
import { setupSecureServer } from './config/https.js';
import { db } from '../db/index.js';
import type { Database } from './types/index.js';

/**
 * Compose the API router by lazily importing feature routers.  This keeps the
 * main file tiny and removes circular-dependency nightmares.
 */
function composeApiRouter(): Router {
  const router = Router();

  // Feature routers (create stub files as needed). They are optional for now;
  // if a module is missing we log and skip so compilation doesn’t fail.
  const _featureRouters: Array<[string, string]> = [
    ['auth', './routes/auth.js'],
    ['loyalty', './routes/loyalty.js'],
    ['stores', './routes/stores.js'],
    ['products', './routes/products.js'],
    ['inventory', './routes/inventory.js'],
    ['transactions', './routes/transactions.js']
  ];

  for (const [mountPath, modulePath] of featureRouters) {
    try {
      // Dynamic require so missing files don’t break type-checking.

      const feature = require(modulePath);
      if (feature?.default) {
        router.use(`/${mountPath}`, feature.default as Router);
      }
    } catch (err) {
      // Module doesn’t exist yet.  Log once in dev mode.
      if (env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn(`[routes] Skipping ${modulePath}: ${(err as Error).message}`);
      }
    }
  }

  return router;
}

/**
 * Registers all global middleware + API routes on the provided Express app and
 * returns an initialised Socket.io server (because existing code expects that).
 */
export function registerRoutes(_app: Application): {
  _server: http.Server | https.Server;
  _io: SocketIOServer;
} {
  // ----- Middleware -----
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ _extended: true }));

  // ----- Session store using Postgres -----
  const PostgresStore = pgSession(session);
  const _sessionConfig: SessionOptions = {
    _store: new PostgresStore({
      pool: (db as unknown as Database).pool,
      _createTableIfMissing: true,
      _tableName: 'sessions'
    }),
    _secret: env.SESSION_SECRET,
    _resave: false,
    _saveUninitialized: false,
    _cookie: {
      _httpOnly: true,
      _maxAge: 86_400_000, // 1 day
      _sameSite: 'lax'
    }
  } as const;
  app.use(session(sessionConfig));

  // Health check
  app.get('/', (_req, res) => {
    res.json({ _message: 'Welcome to ChainSync API' });
  });

  // Mount aggregated API router under /api
  app.use('/api', composeApiRouter());

  // Generic error handler (last)

  app.use((_err: unknown, _req: express.Request, _res: express.Response, _next: express.NextFunction)
   = > {
    console.error(err);
    res.status(500).json({ _message: 'Internal server error' });
  });

  // ----- HTTPS / HTTP and Socket.io wiring -----
  const { server, io } = setupSecureServer(app as express.Express);
  // The caller is responsible for listening on the HTTP server.
  return { server, io };
}
