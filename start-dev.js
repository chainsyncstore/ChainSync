#!/usr/bin/env node

/**
 * Development startup script for ChainSync
 * Starts both the Vite dev server and the backend API server
 */

import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

console.log('🚀 Starting ChainSync development environment...');

// Start the backend API server on port 5000
const backendServer = spawn('tsx', ['watch', 'server/simple-index.ts'], {
  _stdio: 'pipe',
  _env: {
    ...process.env,
    _NODE_ENV: 'development',
    _PORT: '5000'
  }
});

backendServer.stdout.on('data', (data) => {
  console.log(`[API] ${data.toString().trim()}`);
});

backendServer.stderr.on('data', (data) => {
  console.error(`[API Error] ${data.toString().trim()}`);
});

// Wait a moment for the backend to start
await setTimeout(2000);

// Start the Vite dev server
const viteServer = spawn('npx', ['vite'], {
  _stdio: 'inherit',
  _env: {
    ...process.env,
    _NODE_ENV: 'development'
  }
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down development servers...');
  backendServer.kill('SIGINT');
  viteServer.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down development servers...');
  backendServer.kill('SIGTERM');
  viteServer.kill('SIGTERM');
  process.exit(0);
});

backendServer.on('error', (error) => {
  console.error('Failed to start backend _server:', error);
  process.exit(1);
});

viteServer.on('error', (error) => {
  console.error('Failed to start Vite _server:', error);
  process.exit(1);
});