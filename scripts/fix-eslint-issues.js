#!/usr/bin/env node

/**
 * ESLint Issues Fixer
 * 
 * This script helps identify and fix common ESLint issues in the codebase.
 * It focuses on:
 * - Unused variables (no-unused-vars)
 * - Import ordering issues
 * - React Hook dependencies
 * - Field mapping issues (camelCase <-> snake_case)
 * 
 * Usage:
 *   node fix-eslint-issues.js [--fix] [--target=<category>]
 * 
 * Options:
 *   --fix                 Apply automated fixes
 *   --target=<category>   Target specific issue category (unused-vars, imports, hooks, all)
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const autofix = args.includes('--fix');
let target = 'all';

args.forEach(arg => {
  if (arg.startsWith('--target=')) {
    target = arg.substring(9);
  }
});

// Define ESLint commands for different issue categories
const eslintCommands = {
  'unused-vars': 'eslint . --ext .ts,.tsx --rule "no-unused-vars: error" --quiet',
  'imports': 'eslint . --ext .ts,.tsx --rule "import/no-duplicates: error" --rule "import/order: error" --quiet',
  'hooks': 'eslint ./client/src --ext .tsx --rule "react-hooks/rules-of-hooks: error" --rule "react-hooks/exhaustive-deps: error" --quiet',
  'all': 'eslint . --ext .ts,.tsx,.js,.jsx --quiet'
};

// Define patterns for field mapping issues (camelCase <-> snake_case)
const fieldMappingPatterns = [
  {
    category: 'subscriptions',
    files: [/subscriptions?\.ts/, /subscription.*service\.ts/],
    camelToSnakePattern: /(?<!\w)([a-z][a-zA-Z0-9]*)([A-Z][a-zA-Z0-9]*)/g,
    snakeToCamelPattern: /([a-z0-9]+)_([a-z])/g,
    missingMappingPattern: /\b(camelToSnake|snakeToCamel)\b/,
  },
  {
    category: 'loyalty',
    files: [/loyalty.*\.ts/],
    camelToSnakePattern: /(?<!\w)([a-z][a-zA-Z0-9]*)([A-Z][a-zA-Z0-9]*)/g,
    snakeToCamelPattern: /([a-z0-9]+)_([a-z])/g,
    missingMappingPattern: /\b(camelToSnake|snakeToCamel)\b/,
  },
  {
    category: 'inventory',
    files: [/inventory.*\.ts/],
    camelToSnakePattern: /(?<!\w)([a-z][a-zA-Z0-9]*)([A-Z][a-zA-Z0-9]*)/g,
    snakeToCamelPattern: /([a-z0-9]+)_([a-z])/g,
    missingMappingPattern: /\b(camelToSnake|snakeToCamel)\b/,
  }
];

// Function to scan for field mapping issues
function scanForFieldMappingIssues(directoryPath) {
  console.log(`\nScanning for field mapping issues in ${directoryPath}...`);
  
  const results = {
    totalFiles: 0,
    filesWithIssues: 0,
    issuesByCategory: {}
  };
  
  // Initialize issues by category
  fieldMappingPatterns.forEach(pattern => {
    results.issuesByCategory[pattern.category] = {
      total: 0,
      files: []
    };
  });
  
  function scanDirectory(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('node_modules') && !entry.name.startsWith('dist')) {
        scanDirectory(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        results.totalFiles++;
        
        // Check if this file matches any of our patterns
        for (const pattern of fieldMappingPatterns) {
          if (pattern.files.some(regex => regex.test(entry.name))) {
            const content = fs.readFileSync(fullPath, 'utf8');
            
            // Check for snake_case fields
            const hasSnakeCase = /_[a-z]/.test(content);
            
            // Check for camelCase fields
            const hasCamelCase = /[a-z][A-Z]/.test(content);
            
            // Check if the mapping functions are missing
            const hasMappingFunctions = pattern.missingMappingPattern.test(content);
            
            if ((hasSnakeCase || hasCamelCase) && !hasMappingFunctions) {
              results.filesWithIssues++;
              results.issuesByCategory[pattern.category].total++;
              results.issuesByCategory[pattern.category].files.push({
                path: fullPath,
                hasSnakeCase,
                hasCamelCase
              });
            }
          }
        }
      }
    }
  }
  
  scanDirectory(directoryPath);
  return results;
}

// Function to fix ESLint issues using the ESLint CLI
function fixEslintIssues(category) {
  const command = eslintCommands[category] || eslintCommands.all;
  const fixCommand = `${command} --fix`;
  
  console.log(`\nRunning: ${fixCommand}`);
  try {
    const output = execSync(fixCommand, { encoding: 'utf8', cwd: process.cwd() });
    console.log(output || 'No issues to fix.');
    return true;
  } catch (error) {
    console.error('Error running ESLint fix:', error.message);
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.error(error.stderr);
    return false;
  }
}

// Function to generate helper functions for field mapping
function generateFieldMappingFunctions() {
  return `
/**
 * Converts camelCase string to snake_case
 */
export function camelToSnake(input: string): string {
  return input.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
}

/**
 * Converts snake_case string to camelCase
 */
export function snakeToCamel(input: string): string {
  return input.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
}

/**
 * Map object keys from camelCase to snake_case
 */
export function mapKeysToSnakeCase<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = camelToSnake(key);
    result[snakeKey] = value;
  }
  
  return result;
}

/**
 * Map object keys from snake_case to camelCase
 */
export function mapKeysToCamelCase<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = snakeToCamel(key);
    result[camelKey] = value;
  }
  
  return result;
}
`;
}

// Main function
async function main() {
  console.log('ESLint Issues Fixer');
  console.log(`Target: ${target}`);
  console.log(`Auto-fix: ${autofix ? 'Yes' : 'No'}`);
  
  // Check for ESLint issues
  if (target === 'all' || target === 'unused-vars' || target === 'imports' || target === 'hooks') {
    const categoryToCheck = target === 'all' ? 'all' : target;
    const command = eslintCommands[categoryToCheck];
    
    console.log(`\nChecking for ${categoryToCheck} issues...`);
    try {
      execSync(command, { encoding: 'utf8', cwd: process.cwd(), stdio: 'inherit' });
      console.log('No issues found!');
    } catch (error) {
      console.log('Issues found. See above for details.');
      
      if (autofix) {
        console.log('\nAttempting to automatically fix issues...');
        fixEslintIssues(categoryToCheck);
      }
    }
  }
  
  // Check for field mapping issues
  if (target === 'all' || target === 'field-mapping') {
    // Scan server and shared directories for field mapping issues
    const serverResults = scanForFieldMappingIssues(path.join(process.cwd(), 'server'));
    const sharedResults = scanForFieldMappingIssues(path.join(process.cwd(), 'shared'));
    
    const totalIssues = serverResults.filesWithIssues + sharedResults.filesWithIssues;
    
    console.log('\nField Mapping Issues Summary:');
    console.log(`Total files scanned: ${serverResults.totalFiles + sharedResults.totalFiles}`);
    console.log(`Files with issues: ${totalIssues}`);
    
    if (totalIssues > 0) {
      console.log('\nIssues by category:');
      
      // Combine results
      const combinedCategories = {};
      
      for (const category in serverResults.issuesByCategory) {
        combinedCategories[category] = {
          total: serverResults.issuesByCategory[category].total + 
                 (sharedResults.issuesByCategory[category]?.total || 0),
          files: [
            ...serverResults.issuesByCategory[category].files,
            ...(sharedResults.issuesByCategory[category]?.files || [])
          ]
        };
      }
      
      for (const category in combinedCategories) {
        if (combinedCategories[category].total > 0) {
          console.log(`  ${category}: ${combinedCategories[category].total} files`);
          
          combinedCategories[category].files.forEach(file => {
            console.log(`    ${file.path}`);
          });
          
          if (autofix) {
            console.log(`\nCreating field mapping utilities for ${category}...`);
            
            // Generate a utilities file for field mapping if it doesn't exist
            const utilsDir = path.join(process.cwd(), 'shared', 'utils');
            if (!fs.existsSync(utilsDir)) {
              fs.mkdirSync(utilsDir, { recursive: true });
            }
            
            const utilsFilePath = path.join(utilsDir, `${category}-field-mapping.ts`);
            if (!fs.existsSync(utilsFilePath)) {
              fs.writeFileSync(utilsFilePath, generateFieldMappingFunctions(), 'utf8');
              console.log(`Created: ${utilsFilePath}`);
            } else {
              console.log(`File already exists: ${utilsFilePath}`);
            }
          }
        }
      }
    }
  }
  
  // Check for SQL injection vulnerabilities
  if (target === 'all' || target === 'sql') {
    console.log('\nChecking for SQL injection vulnerabilities...');
    try {
      execSync('node scripts/sql-security-check.js', { 
        encoding: 'utf8', 
        cwd: process.cwd(), 
        stdio: 'inherit' 
      });
    } catch (error) {
      console.log('Issues found with SQL patterns. See above for details.');
    }
  }
  
  // Check for Drizzle ORM pattern issues
  if (target === 'all' || target === 'drizzle') {
    console.log('\nChecking for Drizzle ORM pattern issues...');
    try {
      execSync('node scripts/check-drizzle-patterns.js', { 
        encoding: 'utf8', 
        cwd: process.cwd(), 
        stdio: 'inherit' 
      });
    } catch (error) {
      console.log('Issues found with Drizzle ORM patterns. See above for details.');
    }
  }
}

// Run the script
main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
