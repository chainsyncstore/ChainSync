#!/usr/bin/env node

/**
 * SQL Security Check
 *
 * This script checks SQL files for potential security issues:
 * - Prevents direct string concatenation in SQL queries
 * - Flags sensitive data patterns
 * - Ensures parameterized queries
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get file paths from command line arguments
const filePaths = process.argv.slice(2);

// Patterns to detect potential SQL injection vulnerabilities
const dangerousPatterns = [
  // String concatenation in SQL
  { pattern: /'\s*\+\s*|"\s*\+\s*/, message: 'String concatenation in SQL query' },
  // Common SQL injection attack patterns
  { pattern: /;\s*DROP\s+TABLE/i, message: 'Potentially dangerous DROP TABLE pattern' },
  { pattern: /;\s*DELETE\s+FROM/i, message: 'Potentially dangerous DELETE pattern' },
  { pattern: /;\s*UPDATE\s+.*\s*SET/i, message: 'Potentially dangerous UPDATE pattern' },
  // Direct use of user input
  {
    pattern: /req\.(body|params|query).*\$\{/i,
    message: 'Direct use of request parameters in SQL query',
  },
];

// Patterns to ensure proper parameterized queries with Drizzle
const bestPracticePatterns = [
  // Check for use of sql template tag
  { pattern: /sql`/, present: true, message: 'Missing sql template tag from drizzle-orm' },
  // Ensure using safeToString for string values
  {
    pattern: /safeToString/,
    present: true,
    message: 'Missing safeToString helper for string values',
  },
];

let exitCode = 0;

// Process each file
filePaths.forEach(filePath => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileIssues = [];

    // Check for dangerous patterns
    dangerousPatterns.forEach(({ pattern, message }) => {
      if (pattern.test(content)) {
        fileIssues.push(`⚠️ ${message}`);
        exitCode = 1;
      }
    });

    // Check for best practices
    bestPracticePatterns.forEach(({ pattern, present, message }) => {
      const matches = pattern.test(content);
      if (present && !matches) {
        fileIssues.push(`⚠️ ${message}`);
        exitCode = 1;
      }
    });

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
  console.log('✅ SQL security check passed');
} else {
  console.log('\n❌ SQL security check failed. Please fix the issues above.');
}

process.exit(exitCode);
