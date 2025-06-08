#!/usr/bin/env node
/**
 * Database Access Pattern Validator
 *
 * This script checks TypeScript files to ensure they follow
 * the standardized database access patterns defined in our
 * architecture.
 *
 * It checks for:
 * - Proper use of SQL helpers
 * - Type safety in database operations
 * - Consistent error handling
 * - Schema validation for database responses
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

// Regular expressions for detecting issues
const patterns = {
  // Direct SQL query without using helpers
  directSqlQuery: /sql`[^`]+`(?!\s*as\s*const)/g,

  // Missing type parameter in database operations
  missingTypeParameter: /(?:findById|findMany|insertOne|updateById|deleteById)\s*\([^<)]*\)/g,

  // Missing validation for database responses
  missingValidation:
    /const\s+\w+\s*=\s*await\s+(?:findById|findMany|insertOne|updateById)\s*[^;]+;(?!\s*(?:validate|z\.[^.]+\.parse|validateAndLog))/g,

  // Not using withDbTryCatch for error handling
  missingTryCatch:
    /async\s+\w+\s*\([^)]*\)\s*{[^}]*(?:db|database)\.[^}]*}(?!\s*\/\/\s*Error\s+handled\s+in\s+calling\s+function)/gi,

  // Type casting with "as" instead of proper validation
  unsafeTypeCasting:
    /as\s+(?!const|unknown|any|number|string|boolean|void|never|readonly|Parameters|ReturnType)/g,
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

    // Skip test files
    if (filePath.includes('.test.') || filePath.includes('.spec.')) {
      console.log(chalk.gray('Skipping test file'));
      return;
    }

    // Check for direct SQL queries
    const directQueries = content.match(patterns.directSqlQuery);
    if (directQueries && directQueries.length > 0) {
      console.log(chalk.red(`❌ Found ${directQueries.length} direct SQL queries:`));
      directQueries.forEach(match => {
        console.log(chalk.red(`   ${match.trim().substring(0, 80)}...`));
      });
      console.log(chalk.yellow(`   Use SQL helpers from 'server/db/sqlHelpers.ts' instead`));
      fileHasIssues = true;
      errorCount += directQueries.length;
    }

    // Check for missing type parameters
    const missingTypes = content.match(patterns.missingTypeParameter);
    if (missingTypes && missingTypes.length > 0) {
      console.log(
        chalk.red(`❌ Found ${missingTypes.length} database operations missing type parameters:`)
      );
      missingTypes.forEach(match => {
        console.log(chalk.red(`   ${match.trim()}`));
      });
      console.log(chalk.yellow(`   Add proper type parameters to ensure type safety`));
      fileHasIssues = true;
      errorCount += missingTypes.length;
    }

    // Check for missing validation
    const missingValidations = content.match(patterns.missingValidation);
    if (missingValidations && missingValidations.length > 0) {
      console.log(
        chalk.yellow(
          `⚠️ Found ${missingValidations.length} database operations without validation:`
        )
      );
      missingValidations.forEach(match => {
        console.log(chalk.yellow(`   ${match.trim().substring(0, 80)}...`));
      });
      console.log(chalk.yellow(`   Validate database responses with Zod for runtime type safety`));
      fileHasIssues = true;
      warningCount += missingValidations.length;
    }

    // Check for missing try-catch
    const missingTryCatches = content.match(patterns.missingTryCatch);
    if (missingTryCatches && missingTryCatches.length > 0) {
      console.log(
        chalk.yellow(
          `⚠️ Found ${missingTryCatches.length} functions that might be missing error handling:`
        )
      );
      missingTryCatches.forEach(match => {
        // Display just the function signature for brevity
        const signature = match.split('{')[0].trim();
        console.log(chalk.yellow(`   ${signature}...`));
      });
      console.log(chalk.yellow(`   Use 'withDbTryCatch' for consistent error handling`));
      fileHasIssues = true;
      warningCount += missingTryCatches.length;
    }

    // Check for unsafe type casting
    const unsafeCasts = content.match(patterns.unsafeTypeCasting);
    if (unsafeCasts && unsafeCasts.length > 0) {
      console.log(chalk.red(`❌ Found ${unsafeCasts.length} potentially unsafe type casts:`));
      unsafeCasts.forEach(match => {
        console.log(chalk.red(`   ${match.trim()}`));
      });
      console.log(chalk.yellow(`   Use Zod validation instead of type casting with 'as'`));
      fileHasIssues = true;
      errorCount += unsafeCasts.length;
    }

    if (!fileHasIssues) {
      console.log(chalk.green('✅ No database pattern issues found'));
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
console.log(chalk.blue(`Database Pattern Check Summary: ${filesToCheck.length} files checked`));
console.log(chalk.blue('==============================='));
console.log(chalk.red(`Errors: ${errorCount}`));
console.log(chalk.yellow(`Warnings: ${warningCount}`));

// Exit with error code if errors found
if (errorCount > 0) {
  console.log(
    chalk.red('\n❌ Database pattern validation failed. Please fix the issues before committing.')
  );
  process.exit(1);
} else if (warningCount > 0) {
  console.log(
    chalk.yellow('\n⚠️ Database pattern validation passed with warnings. Consider addressing them.')
  );
  process.exit(0);
} else {
  console.log(chalk.green('\n✅ Database pattern validation passed successfully!'));
  process.exit(0);
}
