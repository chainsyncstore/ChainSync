#!/usr/bin/env node

/**
 * TypeScript Error Fixer
 * 
 * This script helps identify and fix common TypeScript errors in the codebase.
 * It looks for patterns like:
 * - Usage of `any` type
 * - Untyped catch blocks
 * - Missing type imports
 * - Improper error handling
 * 
 * Usage:
 *   node fix-typescript-errors.js [--autofix] [--path=<directory>]
 * 
 * Options:
 *   --autofix    Automatically fix common issues
 *   --path       Path to scan (default: src, server, shared)
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import readline from 'readline';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const autofix = args.includes('--autofix');
let targetPath = './';

args.forEach(arg => {
  if (arg.startsWith('--path=')) {
    targetPath = arg.substring(7);
  }
});

// Common TypeScript error patterns
const errorPatterns = [
  {
    name: 'Explicit any',
    pattern: /: any(?![a-zA-Z])/g,
    replacement: ': unknown',
    fixable: true,
    message: 'Replace "any" with "unknown" for better type safety'
  },
  {
    name: 'Untyped catch clause',
    pattern: /catch\s*\(\s*([a-zA-Z0-9_]+)\s*\)\s*{/g,
    replacement: (match, p1) => `catch (${p1}: unknown) {`,
    fixable: true,
    message: 'Add explicit "unknown" type to catch clause parameter'
  },
  {
    name: 'Missing error handling',
    pattern: /throw error;/g,
    replacement: `throw error instanceof AppError ? error : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });`,
    fixable: true,
    message: 'Improve error handling by using AppError'
  },
  {
    name: 'Untyped function parameter',
    pattern: /function\s+([a-zA-Z0-9_]+)\s*\(\s*([a-zA-Z0-9_]+)\s*\)\s*{/g,
    replacement: null, // Can't auto-fix without knowing the proper type
    fixable: false,
    message: 'Add explicit type to function parameter'
  },
  {
    name: 'Missing type imports',
    pattern: /import\s+{([^}]*)}\s+from\s+['"]([^'"]+)['"]/g,
    replacement: null, // Can't auto-fix without knowing which imports should be type-only
    fixable: false,
    message: 'Consider using type-only imports for types'
  }
];

// Database-specific patterns
const databasePatterns = [
  {
    name: 'Direct SQL value interpolation',
    pattern: /sql`.*\${(?!.*safeToString\()(?!.*sql\.identifier\()(?!this\.safeToString\()/g,
    replacement: null, // Can't auto-fix without context
    fixable: false,
    message: 'Use safeToString for string values in SQL templates'
  }
];

// Collect all TypeScript files
function collectTypeScriptFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !file.startsWith('node_modules') && !file.startsWith('dist')) {
      collectTypeScriptFiles(filePath, fileList);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Scan a file for TypeScript errors
function scanFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const errors = [];
    
    // Check for common error patterns
    errorPatterns.forEach(pattern => {
      const matches = content.match(pattern.pattern);
      if (matches) {
        errors.push({
          type: pattern.name,
          count: matches.length,
          fixable: pattern.fixable,
          message: pattern.message,
          pattern: pattern
        });
      }
    });
    
    // Check for database-specific patterns in database-related files
    if (filePath.includes('db') || filePath.includes('database')) {
      databasePatterns.forEach(pattern => {
        const matches = content.match(pattern.pattern);
        if (matches) {
          errors.push({
            type: pattern.name,
            count: matches.length,
            fixable: pattern.fixable,
            message: pattern.message,
            pattern: pattern
          });
        }
      });
    }
    
    return { filePath, errors, content };
  } catch (error) {
    console.error(`Error scanning ${filePath}:`, error.message);
    return { filePath, errors: [], content: '' };
  }
}

// Fix TypeScript errors in a file
function fixFile(filePath, content, errors) {
  let updatedContent = content;
  
  errors.forEach(error => {
    if (error.fixable && error.pattern.replacement) {
      if (typeof error.pattern.replacement === 'string') {
        updatedContent = updatedContent.replace(error.pattern.pattern, error.pattern.replacement);
      } else if (typeof error.pattern.replacement === 'function') {
        updatedContent = updatedContent.replace(error.pattern.pattern, error.pattern.replacement);
      }
    }
  });
  
  if (updatedContent !== content) {
    fs.writeFileSync(filePath, updatedContent, 'utf8');
    return true;
  }
  
  return false;
}

// Generate a report of TypeScript errors
function generateReport(results) {
  const totalFiles = results.length;
  const filesWithErrors = results.filter(result => result.errors.length > 0).length;
  const totalErrors = results.reduce((sum, result) => sum + result.errors.length, 0);
  const fixableErrors = results.reduce((sum, result) => {
    return sum + result.errors.filter(error => error.fixable).length;
  }, 0);
  
  console.log('\n=== TypeScript Error Report ===');
  console.log(`Total files scanned: ${totalFiles}`);
  console.log(`Files with errors: ${filesWithErrors}`);
  console.log(`Total errors found: ${totalErrors}`);
  console.log(`Automatically fixable errors: ${fixableErrors}`);
  
  // Group errors by type
  const errorsByType = {};
  results.forEach(result => {
    result.errors.forEach(error => {
      if (!errorsByType[error.type]) {
        errorsByType[error.type] = { count: 0, fixable: 0 };
      }
      errorsByType[error.type].count += error.count;
      if (error.fixable) {
        errorsByType[error.type].fixable += error.count;
      }
    });
  });
  
  console.log('\nErrors by type:');
  Object.entries(errorsByType).forEach(([type, counts]) => {
    console.log(`  ${type}: ${counts.count} (${counts.fixable} fixable)`);
  });
  
  // Show files with the most errors
  const filesSorted = [...results]
    .filter(result => result.errors.length > 0)
    .sort((a, b) => 
      b.errors.reduce((sum, e) => sum + e.count, 0) - 
      a.errors.reduce((sum, e) => sum + e.count, 0)
    );
  
  console.log('\nTop files with errors:');
  filesSorted.slice(0, 10).forEach(result => {
    const errorCount = result.errors.reduce((sum, e) => sum + e.count, 0);
    console.log(`  ${result.filePath}: ${errorCount} errors`);
  });
}

// Interactive mode to fix errors
async function interactiveMode(results) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const filesWithFixableErrors = results.filter(result => 
    result.errors.some(error => error.fixable)
  );
  
  if (filesWithFixableErrors.length === 0) {
    console.log('No automatically fixable errors found.');
    rl.close();
    return;
  }
  
  console.log(`\nFound ${filesWithFixableErrors.length} files with automatically fixable errors.`);
  
  for (const result of filesWithFixableErrors) {
    const fixableErrors = result.errors.filter(error => error.fixable);
    if (fixableErrors.length === 0) continue;
    
    console.log(`\nFile: ${result.filePath}`);
    console.log('Fixable errors:');
    fixableErrors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error.type}: ${error.message} (${error.count} occurrences)`);
    });
    
    const answer = await new Promise(resolve => {
      rl.question('Fix these errors? (y/n/all): ', resolve);
    });
    
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'all') {
      const fixed = fixFile(result.filePath, result.content, fixableErrors);
      console.log(fixed ? 'Fixed!' : 'No changes made.');
      
      if (answer.toLowerCase() === 'all') {
        // Fix all remaining files
        for (const remainingResult of filesWithFixableErrors.slice(filesWithFixableErrors.indexOf(result) + 1)) {
          const remainingFixableErrors = remainingResult.errors.filter(error => error.fixable);
          if (remainingFixableErrors.length === 0) continue;
          
          const fixed = fixFile(remainingResult.filePath, remainingResult.content, remainingFixableErrors);
          console.log(`${remainingResult.filePath}: ${fixed ? 'Fixed!' : 'No changes made.'}`);
        }
        break;
      }
    }
  }
  
  rl.close();
}

// Main function
async function main() {
  console.log('Scanning for TypeScript errors...');
  
  try {
    const directories = ['./server', './shared', './src'].filter(dir => 
      fs.existsSync(path.resolve(targetPath, dir))
    );
    
    if (directories.length === 0) {
      directories.push(targetPath);
    }
    
    let allFiles = [];
    directories.forEach(dir => {
      const fullPath = path.resolve(targetPath, dir);
      allFiles = allFiles.concat(collectTypeScriptFiles(fullPath));
    });
    
    console.log(`Found ${allFiles.length} TypeScript files to scan.`);
    
    const results = [];
    for (const file of allFiles) {
      process.stdout.write(`Scanning ${file}...`);
      const result = scanFile(file);
      
      if (result.errors.length > 0) {
        process.stdout.write(` Found ${result.errors.length} issues.\n`);
      } else {
        process.stdout.write(` OK\n`);
      }
      
      results.push(result);
    }
    
    generateReport(results);
    
    if (autofix) {
      console.log('\nAutomatically fixing errors...');
      let fixedCount = 0;
      
      results.forEach(result => {
        const fixableErrors = result.errors.filter(error => error.fixable);
        if (fixableErrors.length > 0) {
          const fixed = fixFile(result.filePath, result.content, fixableErrors);
          if (fixed) fixedCount++;
        }
      });
      
      console.log(`Fixed errors in ${fixedCount} files.`);
    } else {
      await interactiveMode(results);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
