#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Define update batches to avoid conflicts
const updateBatches = [
  {
    name: 'Core TypeScript and ESLint',
    packages: [
      'typescript@5.8.3',
      '@typescript-eslint/eslint-plugin@latest',
      '@typescript-eslint/parser@latest'
    ],
    flags: ['--save-dev', '--legacy-peer-deps']
  },
  {
    name: 'Database and ORM',
    packages: [
      '@neondatabase/serverless@latest',
      'drizzle-orm@latest',
      'drizzle-zod@latest',
      'kysely@latest'
    ],
    flags: ['--legacy-peer-deps']
  },
  {
    name: 'React and UI Libraries',
    packages: [
      'react@latest',
      'react-dom@latest',
      '@tanstack/react-query@latest',
      'lucide-react@latest',
      'framer-motion@latest'
    ],
    flags: ['--legacy-peer-deps']
  },
  {
    name: 'Server Dependencies',
    packages: [
      'express@latest',
      'express-rate-limit@latest',
      'express-session@latest',
      'connect-pg-simple@latest',
      'connect-redis@latest',
      'ioredis@latest',
      'bullmq@latest'
    ],
    flags: ['--legacy-peer-deps']
  },
  {
    name: 'Development Tools',
    packages: [
      'jest@latest',
      'jest-environment-jsdom@latest',
      'eslint@latest',
      'prettier@latest',
      'concurrently@latest',
      'tsx@latest'
    ],
    flags: ['--save-dev', '--legacy-peer-deps']
  },
  {
    name: 'Utility Libraries',
    packages: [
      'axios@latest',
      'bcrypt@latest',
      'csv-parse@latest',
      'csv-stringify@latest',
      'date-fns@latest',
      'dotenv@latest',
      'uuid@latest',
      'zod@latest'
    ],
    flags: ['--legacy-peer-deps']
  },
  {
    name: 'Type Definitions',
    packages: [
      '@types/node@latest',
      '@types/express@latest',
      '@types/bcrypt@latest',
      '@types/cors@latest',
      '@types/compression@latest',
      '@types/express-session@latest',
      '@types/jest@latest',
      '@types/multer@latest',
      '@types/nodemailer@latest',
      '@types/pg@latest',
      '@types/react@latest',
      '@types/react-dom@latest',
      '@types/supertest@latest',
      '@types/swagger-jsdoc@latest',
      '@types/swagger-ui-express@latest',
      '@types/ws@latest'
    ],
    flags: ['--save-dev', '--legacy-peer-deps']
  }
];

function runCommand(command) {
  try {
    console.log(`\n🔄 Running: ${command}`);
    const output = execSync(command, { 
      stdio: 'inherit',
      encoding: 'utf8'
    });
    console.log(`✅ Success: ${command}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed: ${command}`);
    console.error(`Error: ${error.message}`);
    return false;
  }
}

function updateBatch(batch) {
  console.log(`\n📦 Updating ${batch.name}...`);
  
  const packages = batch.packages.join(' ');
  const flags = batch.flags.join(' ');
  const command = `npm install ${packages} ${flags}`;
  
  return runCommand(command);
}

function main() {
  console.log('🚀 Starting systematic dependency updates...');
  
  // First, clean npm cache
  console.log('\n🧹 Cleaning npm cache...');
  runCommand('npm cache clean --force');
  
  // Update each batch
  let successCount = 0;
  let totalBatches = updateBatches.length;
  
  for (const batch of updateBatches) {
    if (updateBatch(batch)) {
      successCount++;
    } else {
      console.log(`⚠️  Skipping remaining packages in ${batch.name} due to error`);
    }
  }
  
  // Final audit
  console.log('\n🔍 Running security audit...');
  runCommand('npm audit --audit-level=high');
  
  // Show outdated packages
  console.log('\n📊 Checking for remaining outdated packages...');
  runCommand('npm outdated');
  
  console.log(`\n✅ Update complete! ${successCount}/${totalBatches} batches successful`);
}

main(); 