"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDateForSql = formatDateForSql;
exports.formatJsonForSql = formatJsonForSql;
exports.buildInsertQuery = buildInsertQuery;
exports.buildUpdateQuery = buildUpdateQuery;
exports.buildRawInsertQuery = buildRawInsertQuery;
exports.buildRawUpdateQuery = buildRawUpdateQuery;
exports.prepareSqlValues = prepareSqlValues;
/**
 * SQL Helper Utilities
 *
 * Utility functions for handling SQL queries, including formatting dates and JSON data
 * for safe inclusion in SQL queries. These helpers address common issues with type
 * conversion and SQL string escaping.
 */
const field_mapping_1 = require("./field-mapping");
/**
 * Format a date value for safe inclusion in SQL queries
 *
 * @param date The date to format (can be Date object, ISO string, or null/undefined)
 * @returns A SQL-safe string representation of the date or 'NULL'
 */
function formatDateForSql(date) {
    if (!date)
        return 'NULL';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return `'${dateObj.toISOString()}'`;
}
/**
 * Format a JSON value for safe inclusion in SQL queries
 *
 * @param data The data to serialize to JSON (can be any object or null/undefined)
 * @returns A SQL-safe string representation of the JSON data or 'NULL'
 */
function formatJsonForSql(data) {
    if (!data)
        return 'NULL';
    // Escape single quotes to prevent SQL injection
    return `'${JSON.stringify(data).replace(/'/g, "''")}'`;
}
/**
 * Build an INSERT SQL query with proper field mapping
 *
 * @param tableName The name of the table to insert into
 * @param data The data object with camelCase keys
 * @param returnFields Array of fields to return (defaults to all fields)
 * @returns Object containing the query string and parameter values
 */
function buildInsertQuery(tableName, data, returnFields = ['*']) {
    const dbFields = (0, field_mapping_1.toDatabaseFields)(data);
    const fields = Object.keys(dbFields);
    const placeholders = fields.map((_, i) => `$${i + 1}`);
    const values = Object.values(dbFields);
    return {
        query: `
      INSERT INTO ${tableName} (${fields.join(', ')})
      VALUES (${placeholders.join(', ')})
      ${returnFields.length ? `RETURNING ${returnFields.join(', ')}` : ''}
    `,
        values
    };
}
/**
 * Build an UPDATE SQL query with proper field mapping
 *
 * @param tableName The name of the table to update
 * @param data The data object with camelCase keys
 * @param whereCondition The WHERE clause condition (without the "WHERE" keyword)
 * @param returnFields Array of fields to return (defaults to all fields)
 * @returns Object containing the query string and parameter values
 */
function buildUpdateQuery(tableName, data, whereCondition, returnFields = ['*']) {
    const dbFields = (0, field_mapping_1.toDatabaseFields)(data);
    const fields = Object.keys(dbFields);
    const values = Object.values(dbFields);
    // Create SET clauses like "field1 = $1, field2 = $2"
    const setClauses = fields.map((field, index) => `${field} = $${index + 1}`);
    return {
        query: `
      UPDATE ${tableName}
      SET ${setClauses.join(', ')}
      WHERE ${whereCondition}
      ${returnFields.length ? `RETURNING ${returnFields.join(', ')}` : ''}
    `,
        values
    };
}
/**
 * Build a raw SQL INSERT query using string interpolation (for cases where parameterized queries cause TypeScript errors)
 * NOTE: This is less secure than parameterized queries but resolves certain TypeScript issues
 *
 * @param tableName The name of the table to insert into
 * @param data The data object with values already formatted for SQL
 * @param returnFields Array of fields to return (defaults to all fields)
 * @returns The complete SQL query string
 */
function buildRawInsertQuery(tableName, data, // Values should already be formatted as SQL-safe strings
returnFields = ['*']) {
    const fields = Object.keys(data);
    const values = Object.values(data);
    return `
    INSERT INTO ${tableName} (${fields.join(', ')})
    VALUES (${values.join(', ')})
    ${returnFields.length ? `RETURNING ${returnFields.join(', ')}` : ''}
  `;
}
/**
 * Build a raw SQL UPDATE query using string interpolation (for cases where parameterized queries cause TypeScript errors)
 * NOTE: This is less secure than parameterized queries but resolves certain TypeScript issues
 *
 * @param tableName The name of the table to update
 * @param data The data object with values already formatted for SQL
 * @param whereCondition The WHERE clause condition (without the "WHERE" keyword)
 * @param returnFields Array of fields to return (defaults to all fields)
 * @returns The complete SQL query string
 */
function buildRawUpdateQuery(tableName, data, // Values should already be formatted as SQL-safe strings
whereCondition, returnFields = ['*']) {
    const setClauses = Object.entries(data).map(([field, value]) => `${field} = ${value}`);
    return `
    UPDATE ${tableName}
    SET ${setClauses.join(', ')}
    WHERE ${whereCondition}
    ${returnFields.length ? `RETURNING ${returnFields.join(', ')}` : ''}
  `;
}
/**
 * Prepare an object for raw SQL queries by converting values to SQL-safe strings
 *
 * @param data The source data object
 * @returns A new object with values formatted as SQL-safe strings
 */
function prepareSqlValues(data) {
    return Object.entries(data).reduce((acc, [key, value]) => {
        if (value === undefined)
            return acc;
        if (value === null) {
            acc[key] = 'NULL';
        }
        else if (value instanceof Date) {
            acc[key] = formatDateForSql(value);
        }
        else if (typeof value === 'boolean') {
            acc[key] = value ? 'TRUE' : 'FALSE';
        }
        else if (typeof value === 'number') {
            acc[key] = value.toString();
        }
        else if (typeof value === 'object') {
            acc[key] = formatJsonForSql(value);
        }
        else {
            // Strings and other types
            acc[key] = `'${String(value).replace(/'/g, "''")}'`;
        }
        return acc;
    }, {});
}
