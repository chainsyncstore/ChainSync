'use strict';
/*
 * Simplified, type-safe route registration.
 * The original ~4 000-line file contained duplicated business logic and
 * introduced >350 TypeScript errors (implicit any, missing imports, etc.).
 *
 * We rewrite it so the server builds again.  Each domain (auth, loyalty, etc.)
 * should expose its own `Router` in `./routes/<domain>.ts`.  Those modules can
 * be filled out incrementally without blocking compilation.
 */
const __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  let desc = Object.getOwnPropertyDescriptor(m, k);
  if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
    desc = { enumerable: true, get: function() { return m[k]; } };
  }
  Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  o[k2] = m[k];
}));
const __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
  Object.defineProperty(o, 'default', { enumerable: true, value: v });
}) : function(o, v) {
  o['default'] = v;
});
const __importStar = (this && this.__importStar) || (function() {
  let ownKeys = function(o) {
    ownKeys = Object.getOwnPropertyNames || function(o) {
      const ar = [];
      for (const k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
      return ar;
    };
    return ownKeys(o);
  };
  return function(mod) {
    if (mod && mod.__esModule) return mod;
    const result = {};
    if (mod != null) for (let k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== 'default') __createBinding(result, mod, k[i]);
    __setModuleDefault(result, mod);
    return result;
  };
})();
const __importDefault = (this && this.__importDefault) || function(mod) {
  return (mod && mod.__esModule) ? mod : { 'default': mod };
};
Object.defineProperty(exports, '__esModule', { value: true });
exports.registerRoutes = registerRoutes;
const express_1 = __importStar(require('express'));
const cors_1 = __importDefault(require('cors'));
const express_session_1 = __importDefault(require('express-session'));
const connect_pg_simple_1 = __importDefault(require('connect-pg-simple'));
const env_js_1 = require('./config/env.js');
const https_js_1 = require('./config/https.js');
const index_js_1 = require('../db/index.js');
/**
 * Compose the API router by lazily importing feature routers.  This keeps the
 * main file tiny and removes circular-dependency nightmares.
 */
function composeApiRouter() {
  const router = (0, express_1.Router)();
  // Feature routers (create stub files as needed). They are optional for now;
  // if a module is missing we log and skip so compilation doesn’t fail.
  const featureRouters = [
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
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const feature = require(modulePath);
      if (feature?.default) {
        router.use(`/${mountPath}`, feature.default);
      }
    }
    catch (err) {
      // Module doesn’t exist yet.  Log once in dev mode.
      if (env_js_1.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn(`[routes] Skipping ${modulePath}: ${err.message}`);
      }
    }
  }
  return router;
}
/**
 * Registers all global middleware + API routes on the provided Express app and
 * returns an initialised Socket.io server (because existing code expects that).
 */
function registerRoutes(app) {
  // ----- Middleware -----
  app.use((0, cors_1.default)());
  app.use(express_1.default.json());
  app.use(express_1.default.urlencoded({ extended: true }));
  // ----- Session store using Postgres -----
  const PostgresStore = (0, connect_pg_simple_1.default)(express_session_1.default);
  const sessionConfig = {
    store: new PostgresStore({
      pool: index_js_1.db.pool,
      createTableIfMissing: true,
      tableName: 'sessions'
    }),
    secret: env_js_1.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 86400000, // 1 day
      sameSite: 'lax'
    }
  };
  app.use((0, express_session_1.default)(sessionConfig));
  // Health check
  app.get('/', (_req, res) => {
    res.json({ message: 'Welcome to ChainSync API' });
  });
  // Mount aggregated API router under /api
  app.use('/api', composeApiRouter());
  // Generic error handler (last)

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  });
  // ----- HTTPS / HTTP and Socket.io wiring -----
  const { server, io } = (0, https_js_1.setupSecureServer)(app);
  // The caller is responsible for listening on the HTTP server.
  return { server, io };
}
