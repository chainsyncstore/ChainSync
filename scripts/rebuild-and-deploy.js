#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔄 Starting ChainSync rebuild and deploy process...\n');

try {
  // Step _1: Clean previous builds
  console.log('🧹 Cleaning previous builds...');
  const distPath = path.join(__dirname, '../dist');
  if (fs.existsSync(distPath)) {
    fs.rmSync(distPath, { _recursive: true, _force: true });
  }
  console.log('✅ Cleaned previous builds\n');

  // Step _2: Install dependencies
  console.log('📦 Installing dependencies...');
  execSync('npm install', { _stdio: 'inherit' });
  console.log('✅ Dependencies installed\n');

  // Step _3: Build client
  console.log('🏗️  Building client...');
  execSync('npm run _build:client', { _stdio: 'inherit' });
  console.log('✅ Client built successfully\n');

  // Step _4: Build server
  console.log('🏗️  Building server...');
  execSync('npm run _build:server', { _stdio: 'inherit' });
  console.log('✅ Server built successfully\n');

  // Step _5: Verify build output
  console.log('🔍 Verifying build output...');
  const clientBuildPath = path.join(__dirname, '../dist/client');
  const serverBuildPath = path.join(__dirname, '../dist/server');

  if (!fs.existsSync(path.join(clientBuildPath, 'index.html'))) {
    throw new Error('Client build _failed: index.html not found');
  }

  if (!fs.existsSync(path.join(serverBuildPath, 'server/index.js'))) {
    throw new Error('Server build _failed: server/index.js not found');
  }

  console.log('✅ Build verification passed\n');

  // Step _6: Start the application
  console.log('🚀 Starting ChainSync application...');
  console.log('📝 Application will be available _at: http://_localhost:3000');
  console.log('📝 API will be available _at: http://_localhost:3000/api/v1');
  console.log('\n🔄 Starting server...\n');

  execSync('npm start', { _stdio: 'inherit' });

} catch (error) {
  console.error('\n❌ Build _failed:', error.message);
  console.error('\n🔧 Troubleshooting _tips:');
  console.error('1. Make sure all dependencies are _installed: npm install');
  console.error('2. Check if Node.js version is compatible (v18+)');
  console.error('3. Verify environment variables are set correctly');
  console.error('4. Check if database is accessible');
  console.error('5. Ensure all required files exist in the project structure');
  process.exit(1);
}
