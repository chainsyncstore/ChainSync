#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔄 Starting ChainSync rebuild and deploy process...\n');

try {
  // Step 1: Clean previous builds
  console.log('🧹 Cleaning previous builds...');
  const distPath = path.join(__dirname, '../dist');
  if (fs.existsSync(distPath)) {
    fs.rmSync(distPath, { recursive: true, force: true });
  }
  console.log('✅ Cleaned previous builds\n');

  // Step 2: Install dependencies
  console.log('📦 Installing dependencies...');
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ Dependencies installed\n');

  // Step 3: Build client
  console.log('🏗️  Building client...');
  execSync('npm run build:client', { stdio: 'inherit' });
  console.log('✅ Client built successfully\n');

  // Step 4: Build server
  console.log('🏗️  Building server...');
  execSync('npm run build:server', { stdio: 'inherit' });
  console.log('✅ Server built successfully\n');

  // Step 5: Verify build output
  console.log('🔍 Verifying build output...');
  const clientBuildPath = path.join(__dirname, '../dist/client');
  const serverBuildPath = path.join(__dirname, '../dist/server');
  
  if (!fs.existsSync(path.join(clientBuildPath, 'index.html'))) {
    throw new Error('Client build failed: index.html not found');
  }
  
  if (!fs.existsSync(path.join(serverBuildPath, 'server/index.js'))) {
    throw new Error('Server build failed: server/index.js not found');
  }
  
  console.log('✅ Build verification passed\n');

  // Step 6: Start the application
  console.log('🚀 Starting ChainSync application...');
  console.log('📝 Application will be available at: http://localhost:3000');
  console.log('📝 API will be available at: http://localhost:3000/api/v1');
  console.log('\n🔄 Starting server...\n');
  
  execSync('npm start', { stdio: 'inherit' });

} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  console.error('\n🔧 Troubleshooting tips:');
  console.error('1. Make sure all dependencies are installed: npm install');
  console.error('2. Check if Node.js version is compatible (v18+)');
  console.error('3. Verify environment variables are set correctly');
  console.error('4. Check if database is accessible');
  console.error('5. Ensure all required files exist in the project structure');
  process.exit(1);
} 