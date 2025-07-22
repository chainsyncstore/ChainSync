#!/usr/bin/env node

// Production entry point for ChainSync server
// This file handles the startup logic for the Express server in production

const path = require('path');
const fs = require('fs');

// Check if the compiled server exists
const serverPath = path.join(__dirname, 'dist', 'server', 'index.js');
const fallbackPath = path.join(__dirname, 'server', 'index.js');

console.log('🚀 Starting ChainSync Production Server...');
console.log('Node Environment:', process.env.NODE_ENV || 'production');
console.log('Port:', process.env.PORT || 3000);

if (fs.existsSync(serverPath)) {
  console.log('✅ Loading compiled server from dist/server/index.js');
  require(serverPath);
} else if (fs.existsSync(fallbackPath)) {
  console.log('⚠️  Compiled server not found, loading from server/index.js');
  require(fallbackPath);
} else {
  console.error('❌ No server entry point found!');
  console.error('Checked paths:');
  console.error(' - ' + serverPath);
  console.error(' - ' + fallbackPath);
  process.exit(1);
}