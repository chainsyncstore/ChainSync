#!/usr/bin/env node

/**
 * Drizzle ORM Pattern Check
 * 
 * This script checks for common issues with Drizzle ORM usage based on
 * the patterns established in the ChainSync project:
 * - Ensures proper field mapping between camelCase and snake_case
 * - Validates SQL template literals usage
 * - Checks for safeToString helper usage with SQL parameters
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get file paths from command line arguments
const filePaths = process.argv.slice(2);

// Patterns to check in Drizzle ORM files
const drizzlePatterns = [
  // Check direct value insertion without safeToString
  { 
    pattern: /sql`.*\${(?!.*safeToString\()(?!.*sql\.identifier\()(?!this\.safeToString\()/,
    message: 'Direct value insertion in SQL template without safeToString'
  },
  
  // Check field mapping between camelCase and snake_case
  {
    pattern: /camelToSnake|snakeToCamel/,
    present: true,
    message: 'Missing field mapping between camelCase and snake_case'
  },
  
  // Check for proper error handling with Drizzle
  {
    pattern: /(catch.*\(error)(?!.*: unknown)/,
    message: 'Untyped error catching - use "error: unknown" for better type safety'
  },
  
  // Check for proper transaction handling
  {
    pattern: /beginTransaction|tx\(/,
    context: /try\s*{[\s\S]*?}\s*catch\s*\(.*\)\s*{[\s\S]*?}/,
    message: 'Transaction without proper try/catch error handling'
  }
];

let exitCode = 0;

// Process each file
filePaths.forEach(filePath => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileIssues = [];

    // Check for Drizzle ORM patterns
    drizzlePatterns.forEach(({ pattern, present, message, context }) => {
      const matches = pattern.test(content);
      
      if (present && !matches) {
        // Should be present but isn't
        fileIssues.push(`⚠️ ${message}`);
        exitCode = 1;
      } else if (!present && matches) {
        // Should not be present but is
        if (!context || !context.test(content)) {
          fileIssues.push(`⚠️ ${message}`);
          exitCode = 1;
        }
      }
    });

    // Check specifically for field mapping patterns in subscription module
    if (filePath.includes('subscription')) {
      if (!/camelToSnake\(.*\)/.test(content) && content.includes('snake_case')) {
        fileIssues.push(`⚠️ Missing camelToSnake for field mapping in subscription module`);
        exitCode = 1;
      }
    }

    // Report issues for this file
    if (fileIssues.length > 0) {
      console.log(`\n${path.relative(process.cwd(), filePath)}:`);
      fileIssues.forEach(issue => console.log(`  ${issue}`));
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    exitCode = 1;
  }
});

if (exitCode === 0) {
  console.log('✅ Drizzle ORM pattern check passed');
} else {
  console.log('\n❌ Drizzle ORM pattern check failed. Please fix the issues above.');
}

process.exit(exitCode);
