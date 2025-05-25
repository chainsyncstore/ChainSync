/**
 * SQL Helper Utilities
 * 
 * Utility functions for handling SQL queries, including formatting dates and JSON data
 * for safe inclusion in SQL queries. These helpers address common issues with type
 * conversion and SQL string escaping.
 */
import { toDatabaseFields } from './field-mapping';

/**
 * Format a date value for safe inclusion in SQL queries
 * 
 * @param date The date to format (can be Date object, ISO string, or null/undefined)
 * @returns A SQL-safe string representation of the date or 'NULL'
 */
export function formatDateForSql(date: Date | string | null | undefined): string {
  if (!date) return 'NULL';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return `'${dateObj.toISOString()}'`;
}

/**
 * Format a JSON value for safe inclusion in SQL queries
 * 
 * @param data The data to serialize to JSON (can be any object or null/undefined)
 * @returns A SQL-safe string representation of the JSON data or 'NULL'
 */
export function formatJsonForSql(data: any): string {
  if (!data) return 'NULL';
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
export function buildInsertQuery(
  tableName: string, 
  data: Record<string, any>,
  returnFields: string[] = ['*']
): { query: string, values: any[] } {
  const dbFields = toDatabaseFields(data);
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
export function buildUpdateQuery(
  tableName: string,
  data: Record<string, any>,
  whereCondition: string,
  returnFields: string[] = ['*']
): { query: string, values: any[] } {
  const dbFields = toDatabaseFields(data);
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
export function buildRawInsertQuery(
  tableName: string,
  data: Record<string, string>, // Values should already be formatted as SQL-safe strings
  returnFields: string[] = ['*']
): string {
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
export function buildRawUpdateQuery(
  tableName: string,
  data: Record<string, string>, // Values should already be formatted as SQL-safe strings
  whereCondition: string,
  returnFields: string[] = ['*']
): string {
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
export function prepareSqlValues(data: Record<string, any>): Record<string, string> {
  return Object.entries(data).reduce((acc, [key, value]) => {
    if (value === undefined) return acc;
    
    if (value === null) {
      acc[key] = 'NULL';
    } else if (value instanceof Date) {
      acc[key] = formatDateForSql(value);
    } else if (typeof value === 'boolean') {
      acc[key] = value ? 'TRUE' : 'FALSE';
    } else if (typeof value === 'number') {
      acc[key] = value.toString();
    } else if (typeof value === 'object') {
      acc[key] = formatJsonForSql(value);
    } else {
      // Strings and other types
      acc[key] = `'${String(value).replace(/'/g, "''")}'`;
    }
    
    return acc;
  }, {} as Record<string, string>);
}
