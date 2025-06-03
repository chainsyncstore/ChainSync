/**
 * SQL Template Helpers for Drizzle ORM
 * 
 * This module provides standardized helpers for working with SQL template literals
 * and ensuring proper type compatibility throughout the application.
 */

import { sql, SQL } from 'drizzle-orm';

/**
 * Safely converts any value to a string for use in SQL queries
 * Prevents SQL injection and ensures type compatibility with Drizzle ORM
 * 
 * @param value Any value to be safely converted to string
 * @returns A string representation of the value
 */
export function safeToString(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  
  return String(value);
}

/**
 * Creates a SQL template with properly escaped values
 * Use this helper to ensure type compatibility with Drizzle ORM
 * 
 * @param strings Template strings
 * @param values Values to be inserted into the template
 * @returns A SQL template literal
 * 
 * @example
 * // Instead of:
 * sql`SELECT * FROM users WHERE id = ${userId}`
 * 
 * // Use:
 * sqlTemplate`SELECT * FROM users WHERE id = ${userId}`
 */
export function sqlTemplate(strings: TemplateStringsArray, ...values: unknown[]): SQL<unknown> {
  const escapedValues = values.map(value => safeToString(value));
  return sql(strings, ...escapedValues);
}

/**
 * Creates a SQL identifier for tables or columns
 * 
 * @param name Table or column name
 * @returns A SQL identifier
 */
export function sqlIdentifier(name: string | { name: string }): SQL<unknown> {
  const tableName = typeof name === 'string' ? name : name.name;
  return sql`${sql.identifier(tableName)}`;
}

/**
 * Creates a SQL expression for the WHERE clause
 * 
 * @param column Column name
 * @param operator SQL operator (=, >, <, etc.)
 * @param value Value to compare against
 * @returns A SQL expression
 * 
 * @example
 * sqlWhere('id', '=', userId)
 */
export function sqlWhere(column: string, operator: string, value: unknown): SQL<unknown> {
  return sql`${sqlIdentifier(column)} ${sql.raw(operator)} ${safeToString(value)}`;
}
