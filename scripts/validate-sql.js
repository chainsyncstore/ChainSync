#!/usr/bin/env node
/**
 * SQL Validation Script
 *
 * This script validates SQL files and SQL usage in TypeScript files
 * to ensure they follow security best practices.
 *
 * It checks for:
 * - SQL injection vulnerabilities (unparameterized variables)
 * - Direct SQL usage without helper functions
 * - Proper error handling in database operations
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');

// Regular expressions for detecting issues
const patterns = {
  unsafeVariableInSql: /sql`[^`]*\${(?!safeToString|sql\.identifier)[^}]*}`/g,
  unsafeQueryExecution: /await\s+db\.execute\([\s\n]*[^,\n]*(?!,\s*\[)[^\)]*\)/g,
  missingErrorHandling: /await\s+db\.[^(]*\([^)]*\)(?!\s*\.(catch|then)|[\s\n]*catch)/g,
  directSqlUsage: /from\s+['"]drizzle-orm['"].*\s+sql(?!Helpers)/g,
};

// Files provided as command-line arguments
const filesToCheck = process.argv.slice(2);

let errorCount = 0;
let warningCount = 0;

function checkFile(filePath) {
  console.log(chalk.blue(`\nChecking ${filePath}...`));

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let fileHasIssues = false;

    // Check for unsafe SQL template literals
    const unsafeVariables = content.match(patterns.unsafeVariableInSql);
    if (unsafeVariables && unsafeVariables.length > 0) {
      console.log(
        chalk.red(`❌ Found ${unsafeVariables.length} potential SQL injection vulnerabilities:`)
      );
      unsafeVariables.forEach(match => {
        console.log(chalk.red(`   ${match.trim()}`));
      });
      console.log(
        chalk.yellow(
          `   Use 'safeToString()' or 'sql.identifier()' for variables in SQL template literals`
        )
      );
      fileHasIssues = true;
      errorCount += unsafeVariables.length;
    }

    // Check for unsafe query execution without parameters
    const unsafeQueries = content.match(patterns.unsafeQueryExecution);
    if (unsafeQueries && unsafeQueries.length > 0) {
      console.log(chalk.red(`❌ Found ${unsafeQueries.length} unparameterized query executions:`));
      unsafeQueries.forEach(match => {
        console.log(chalk.red(`   ${match.trim()}`));
      });
      console.log(
        chalk.yellow(`   Always use parameterized queries with the second parameter array`)
      );
      fileHasIssues = true;
      errorCount += unsafeQueries.length;
    }

    // Check for missing error handling
    const missingHandling = content.match(patterns.missingErrorHandling);
    if (missingHandling && missingHandling.length > 0) {
      console.log(
        chalk.yellow(
          `⚠️ Found ${missingHandling.length} database operations without explicit error handling:`
        )
      );
      missingHandling.forEach(match => {
        console.log(chalk.yellow(`   ${match.trim()}`));
      });
      console.log(
        chalk.yellow(`   Consider using try/catch or .catch() for proper error handling`)
      );
      fileHasIssues = true;
      warningCount += missingHandling.length;
    }

    // Check for direct SQL usage
    const directSql = content.match(patterns.directSqlUsage);
    if (directSql && directSql.length > 0) {
      console.log(chalk.red(`❌ Found ${directSql.length} instances of direct SQL imports:`));
      directSql.forEach(match => {
        console.log(chalk.red(`   ${match.trim()}`));
      });
      console.log(chalk.yellow(`   Use 'sqlHelpers' from server/db/sqlHelpers.ts instead`));
      fileHasIssues = true;
      errorCount += directSql.length;
    }

    if (!fileHasIssues) {
      console.log(chalk.green('✅ No SQL security issues found'));
    }
  } catch (error) {
    console.error(chalk.red(`Error checking file ${filePath}: ${error.message}`));
    errorCount++;
  }
}

// Process each file
filesToCheck.forEach(checkFile);

// Show summary
console.log(chalk.blue('\n==============================='));
console.log(chalk.blue(`SQL Validation Summary: ${filesToCheck.length} files checked`));
console.log(chalk.blue('==============================='));
console.log(chalk.red(`Errors: ${errorCount}`));
console.log(chalk.yellow(`Warnings: ${warningCount}`));

// Exit with error code if errors found
if (errorCount > 0) {
  console.log(chalk.red('\n❌ SQL validation failed. Please fix the issues before committing.'));
  process.exit(1);
} else if (warningCount > 0) {
  console.log(chalk.yellow('\n⚠️ SQL validation passed with warnings. Consider addressing them.'));
  process.exit(0);
} else {
  console.log(chalk.green('\n✅ SQL validation passed successfully!'));
  process.exit(0);
}
