#!/usr/bin/env node

// Simple startup script to load the ES module app
const { spawn } = require('child_process');

// Use node with --experimental-modules flag to run the ES module
const child = spawn('node', ['--experimental-modules', 'dist/server/server/app.js'], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' }
});

child.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code);
}); 