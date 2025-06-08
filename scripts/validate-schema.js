#!/usr/bin/env node
/**
 * Schema Validation Script
 *
 * This script validates the database schema against best practices
 * and checks for common schema design issues.
 *
 * It ensures:
 * - All tables have primary keys
 * - All foreign keys have indexes
 * - Naming conventions are followed
 * - Required fields have NOT NULL constraints
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const ts = require('typescript');

// Schema validation rules
const schemaRules = {
  // Table must have a primary key
  hasPrimaryKey: table => {
    return (
      table.includes('.primaryKey') ||
      table.includes('id: integer') ||
      table.includes('id: varchar') ||
      table.includes('id: uuid')
    );
  },

  // Foreign keys should have indexes
  foreignKeysIndexed: (table, tableName) => {
    const foreignKeys = table.match(/(\w+)Id:.*references:/g) || [];

    if (foreignKeys.length === 0) {
      return { pass: true, issues: [] };
    }

    const issues = [];
    const indexDefinitions = table.match(/\.index\([^)]+\)/g) || [];

    foreignKeys.forEach(fk => {
      const fieldName = fk.split(':')[0].trim();
      const hasIndex = indexDefinitions.some(idx => idx.includes(fieldName));

      if (!hasIndex) {
        issues.push(`Foreign key '${fieldName}' in table '${tableName}' should have an index`);
      }
    });

    return { pass: issues.length === 0, issues };
  },

  // Check naming conventions
  followsNamingConventions: (table, tableName) => {
    const issues = [];

    // Table names should be plural
    if (!tableName.endsWith('s') && !tableName.endsWith('data') && !tableName.endsWith('history')) {
      issues.push(`Table name '${tableName}' should be plural`);
    }

    // Column names should be camelCase
    const columnDefs = table.match(/(\w+):\s*\w+/g) || [];
    columnDefs.forEach(col => {
      const colName = col.split(':')[0].trim();
      if (colName.includes('_') || (colName[0] === colName[0].toUpperCase() && colName !== 'ID')) {
        issues.push(`Column '${colName}' in table '${tableName}' should be camelCase`);
      }
    });

    return { pass: issues.length === 0, issues };
  },

  // Required fields should have NOT NULL
  requiredFieldsNotNull: table => {
    const issues = [];
    const columnDefs = table.match(/(\w+):\s*\w+[^,]*/g) || [];

    columnDefs.forEach(col => {
      if (!col.includes('nullable') && !col.includes('primaryKey') && !col.includes('default:')) {
        const colName = col.split(':')[0].trim();
        issues.push(`Column '${colName}' might need 'nullable()' or a default value`);
      }
    });

    return { pass: issues.length === 0, issues };
  },
};

// Main validation function
function validateSchema(schemaFilePath) {
  console.log(chalk.blue(`\nValidating schema file: ${schemaFilePath}`));

  try {
    const schemaContent = fs.readFileSync(schemaFilePath, 'utf8');
    const tableDefinitions = extractTableDefinitions(schemaContent);

    let totalIssues = 0;

    Object.entries(tableDefinitions).forEach(([tableName, tableDefinition]) => {
      console.log(chalk.cyan(`\nChecking table: ${tableName}`));

      // Check primary key
      if (!schemaRules.hasPrimaryKey(tableDefinition)) {
        console.log(chalk.red(`❌ Missing primary key in table '${tableName}'`));
        totalIssues++;
      }

      // Check foreign key indexes
      const fkResult = schemaRules.foreignKeysIndexed(tableDefinition, tableName);
      if (!fkResult.pass) {
        fkResult.issues.forEach(issue => {
          console.log(chalk.yellow(`⚠️ ${issue}`));
          totalIssues++;
        });
      }

      // Check naming conventions
      const namingResult = schemaRules.followsNamingConventions(tableDefinition, tableName);
      if (!namingResult.pass) {
        namingResult.issues.forEach(issue => {
          console.log(chalk.yellow(`⚠️ ${issue}`));
          totalIssues++;
        });
      }

      // Check required fields
      const requiredResult = schemaRules.requiredFieldsNotNull(tableDefinition);
      if (!requiredResult.pass) {
        requiredResult.issues.forEach(issue => {
          console.log(chalk.yellow(`⚠️ ${issue}`));
          totalIssues++;
        });
      }
    });

    if (totalIssues === 0) {
      console.log(chalk.green('\n✅ Schema validation passed successfully!'));
      return 0;
    } else {
      console.log(chalk.yellow(`\n⚠️ Schema validation found ${totalIssues} potential issues.`));
      return 1;
    }
  } catch (error) {
    console.error(chalk.red(`Error validating schema: ${error.message}`));
    return 2;
  }
}

// Helper function to extract table definitions
function extractTableDefinitions(schemaContent) {
  const tableDefinitions = {};

  // Basic regex approach - this could be enhanced with actual TypeScript parsing
  const tableRegex = /export\s+const\s+(\w+)\s*=\s*pgTable\(\s*["'](\w+)["'],\s*{([^}]+)}\s*\)/g;
  let match;

  while ((match = tableRegex.exec(schemaContent)) !== null) {
    const varName = match[1];
    const tableName = match[2];
    const tableBody = match[3];

    tableDefinitions[tableName] = tableBody;
  }

  return tableDefinitions;
}

// Main execution
const schemaFilePath = process.argv[2] || path.join(process.cwd(), 'server', 'db', 'schema.ts');

if (!fs.existsSync(schemaFilePath)) {
  console.error(chalk.red(`Schema file not found: ${schemaFilePath}`));
  process.exit(1);
}

const exitCode = validateSchema(schemaFilePath);
process.exit(exitCode);
