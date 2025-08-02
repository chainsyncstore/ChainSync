#!/usr/bin/env node
import { spawn } from 'child_process';

console.log('🚀 Starting ChainSync Application...');

// Start the integrated server
const serverProcess = spawn('npx', ['tsx', 'server/integrated-index.ts'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: '5000',
    NODE_ENV: 'development'
  }
});

serverProcess.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

serverProcess.on('close', (code) => {
  if (code !== 0) {
    console.log(`Server process exited with code ${code}`);
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
