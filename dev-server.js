#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Starting ChainSync Development Server...');

// Kill existing processes
try {
  spawn('pkill', ['-f', 'vite'], { stdio: 'ignore' });
  spawn('pkill', ['-f', 'tsx.*server'], { stdio: 'ignore' });
  await new Promise(resolve => setTimeout(resolve, 1000));
} catch (e) {
  // Ignore cleanup errors
}

// Start the integrated server
const serverProcess = spawn('tsx', ['server/index.ts'], {
  cwd: __dirname,
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