'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.getDatabase = getDatabase;
exports.initializeDatabase = initializeDatabase;
const serverless_1 = require('@neondatabase/serverless');
const env_1 = require('./config/env');
const logger_1 = require('./services/logger');
let db;
async function getDatabase() {
  if (!db) {
    try {
      db = await (0, serverless_1.neon)(env_1.env.DATABASE_URL);
      logger_1.logger.info('Database connection established');
    }
    catch (error) {
      logger_1.logger.error('Failed to connect to database:', error);
      throw new Error('Database connection failed');
    }
  }
  return db;
}
// Ensure the database is initialized when the server starts
async function initializeDatabase() {
  try {
    if (!env_1.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set');
    }
    db = await (0, serverless_1.neon)(env_1.env.DATABASE_URL);
    logger_1.logger.info('Database connection established');
    // Test the connection
    const result = await db.sql `SELECT 1`;
    if (result.rows[0]?.one !== 1) {
      throw new Error('Database connection test failed');
    }
  }
  catch (error) {
    logger_1.logger.error('Failed to initialize database:', error);
    throw error;
  }
}
exports.default = db;
