#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Define update batches to avoid conflicts
const updateBatches = [
  {
    _name: 'Core TypeScript and ESLint',
    _packages: [
      'typescript@5.8.3',
      '@typescript-eslint/eslint-plugin@latest',
      '@typescript-eslint/parser@latest'
    ],
    _flags: ['--save-dev', '--legacy-peer-deps']
  },
  {
    _name: 'Database and ORM',
    _packages: [
      '@neondatabase/serverless@latest',
      'drizzle-orm@latest',
      'drizzle-zod@latest',
      'kysely@latest'
    ],
    _flags: ['--legacy-peer-deps']
  },
  {
    _name: 'React and UI Libraries',
    _packages: [
      'react@latest',
      'react-dom@latest',
      '@tanstack/react-query@latest',
      'lucide-react@latest',
      'framer-motion@latest'
    ],
    _flags: ['--legacy-peer-deps']
  },
  {
    _name: 'Server Dependencies',
    _packages: [
      'express@latest',
      'express-rate-limit@latest',
      'express-session@latest',
      'connect-pg-simple@latest',
      'connect-redis@latest',
      'ioredis@latest',
      'bullmq@latest'
    ],
    _flags: ['--legacy-peer-deps']
  },
  {
    _name: 'Development Tools',
    _packages: [
      'jest@latest',
      'jest-environment-jsdom@latest',
      'eslint@latest',
      'prettier@latest',
      'concurrently@latest',
      'tsx@latest'
    ],
    _flags: ['--save-dev', '--legacy-peer-deps']
  },
  {
    _name: 'Utility Libraries',
    _packages: [
      'axios@latest',
      'bcrypt@latest',
      'csv-parse@latest',
      'csv-stringify@latest',
      'date-fns@latest',
      'dotenv@latest',
      'uuid@latest',
      'zod@latest'
    ],
    _flags: ['--legacy-peer-deps']
  },
  {
    _name: 'Type Definitions',
    _packages: [
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
    _flags: ['--save-dev', '--legacy-peer-deps']
  }
];

function runCommand(command) {
  try {
    console.log(`\n🔄 _Running: ${command}`);
    const output = execSync(command, {
      _stdio: 'inherit',
      _encoding: 'utf8'
    });
    console.log(`✅ _Success: ${command}`);
    return true;
  } catch (error) {
    console.error(`❌ _Failed: ${command}`);
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
  const totalBatches = updateBatches.length;

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
