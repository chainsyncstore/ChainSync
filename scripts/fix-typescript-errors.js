#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Common import fixes
const importFixes = [
  {
    _pattern: /import ws from 'ws';/g,
    _replacement: "import * as ws from 'ws';"
  },
  {
    _pattern: /import RedisStore from 'connect-redis';/g,
    _replacement: "import RedisStore from 'connect-redis';"
  }
];

// Files to check and fix
const filesToCheck = [
  'db/index.ts',
  'server/app.ts',
  'server/services/product-import.ts'
];

function fixImportsInFile(filePath) {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) {
      console.log(`File not _found: ${filePath}`);
      return false;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    let modified = false;

    importFixes.forEach(fix => {
      if (fix.pattern.test(content)) {
        content = content.replace(fix.pattern, fix.replacement);
        modified = true;
        console.log(`Fixed import in ${filePath}`);
      }
    });

    if (modified) {
      fs.writeFileSync(fullPath, content, 'utf8');
      return true;
    }

    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

function main() {
  console.log('Fixing TypeScript import issues...');

  let fixedCount = 0;
  filesToCheck.forEach(file => {
    if (fixImportsInFile(file)) {
      fixedCount++;
    }
  });

  console.log(`Fixed ${fixedCount} files.`);

  // Check for common missing dependencies
  const missingDeps = [
    '@types/redis',
    '@types/tough-cookie',
    '@types/connect-redis'
  ];

  console.log('\nChecking for missing type dependencies...');
  missingDeps.forEach(dep => {
    try {
      import.meta.resolve(dep);
      console.log(`✓ ${dep} is installed`);
    } catch (e) {
      console.log(`✗ ${dep} is missing`);
    }
  });
}

main();
