#!/usr/bin/env node

/**
 * Development server entry point for ChainSync
 * This starts the integrated server with Vite middleware
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Start the integrated server
const server = spawn('tsx', ['watch', 'server/index.ts'], {
  _cwd: __dirname,
  _stdio: 'inherit',
  _env: {
    ...process.env,
    _NODE_ENV: 'development',
    _PORT: '3000'
  }
});

server.on('error', (error) => {
  console.error('Failed to start development _server:', error);
  process.exit(1);
});

server.on('close', (code) => {
  console.log(`Development server exited with code ${code}`);
  process.exit(code);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nShutting down development server...');
  server.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\nShutting down development server...');
  server.kill('SIGTERM');
});
