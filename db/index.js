'use strict';
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
const __exportStar = (this && this.__exportStar) || function(m, exports) {
  for (const p in m) if (p !== 'default' && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
const __importDefault = (this && this.__importDefault) || function(mod) {
  return (mod && mod.__esModule) ? mod : { 'default': mod };
};
Object.defineProperty(exports, '__esModule', { value: true });
exports.customers = exports.db = exports.pool = void 0;
const serverless_1 = require('@neondatabase/serverless');
const neon_serverless_1 = require('drizzle-orm/neon-serverless');
const ws_1 = __importDefault(require('ws'));
const schema = __importStar(require('@shared/schema.js'));
const customers_1 = require('../shared/db/customers');
// This is the correct way neon config - DO NOT change this
serverless_1.neonConfig.webSocketConstructor = ws_1.default;
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set. Did you forget to provision a database?');
}
const combinedSchema = { ...schema, customers: customers_1.customers };
exports.pool = new serverless_1.Pool({ connectionString: process.env.DATABASE_URL });
exports.db = (0, neon_serverless_1.drizzle)({ client: exports.pool, schema: combinedSchema });
// Re-export all tables so consumers can `import { db, customers, transactions } from "../../db"`.
__exportStar(require('@shared/schema.js'), exports);
const customers_2 = require('../shared/db/customers');
Object.defineProperty(exports, 'customers', { enumerable: true, get: function() { return customers_2.customers; } });
