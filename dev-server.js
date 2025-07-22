#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';

console.log('🚀 Starting ChainSync Development Server...');

// Start the integrated server that serves both frontend and backend
const serverProcess = spawn('npx', ['tsx', 'server/index.ts'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: { 
    ...process.env, 
    PORT: '5000',
    NODE_ENV: 'development'
  }
});

console.log('Server starting on port 5000...');

serverProcess.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

serverProcess.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
  if (code !== 0) {
    process.exit(code);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down ChainSync...');
  serverProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  serverProcess.kill('SIGTERM');
});