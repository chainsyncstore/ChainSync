/**
 * Type-level utilities for converting between different case styles
 */
type CamelToSnake<S extends string> = S extends `${infer T}${infer U}`
  ? T extends Capitalize<T>
    ? `_${Lowercase<T>}${CamelToSnake<U>}`
    : `${T}${CamelToSnake<U>}`
  : S;

type SnakeToCamel<S extends string> = S extends `${infer T}_${infer U}`
  ? `${T}${Capitalize<SnakeToCamel<U>>}`
  : S;

/**
 * Field Mapping Utilities
 *
 * Utility functions for mapping between camelCase (code) and snake_case (database) fields.
 * These functions help resolve TypeScript errors related to field naming mismatches.
 */

/**
 * Converts object keys from camelCase to snake_case for database operations
 *
 * @param data The data object with camelCase keys
 * @returns A new object with snake_case keys
 */
export function toDatabaseFields<T extends Record<string, unknown>>(data: T): Record<string, unknown> {
  if (!data) return {};

  return Object.entries(data).reduce(
    (acc, [key, value]) => {
      const dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      acc[dbKey] = value;
      return acc;
    },
    {} as Record<string, any>
  );
}

/**
 * Converts object keys from snake_case to camelCase for code operations
 *
 * @param data The data object with snake_case keys
 * @returns A new object with camelCase keys
 */
export function fromDatabaseFields<T extends Record<string, unknown>>(data: T): Record<string, unknown> {
  if (!data) return {};

  return Object.entries(data).reduce(
    (acc, [key, value]) => {
      const codeKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      acc[codeKey] = value;
      return acc;
    },
    {} as Record<string, any>
  );
}

/**
 * Creates a new object with only the specified fields
 *
 * @param data The source data object
 * @param fields Array of field names to include
 * @returns A new object with only the specified fields
 */
export function pickFields<T extends Record<string, unknown>, K extends keyof T>(
  data: T,
  fields: K[]
): Pick<T, K> {
  if (!data) return {} as Pick<T, K>;

  return fields.reduce(
    (acc, field) => {
      if (Object.prototype.hasOwnProperty.call(data, field)) {
        acc[field] = data[field];
      }
      return acc;
    },
    {} as Pick<T, K>
  );
}

/**
 * Helper to check if a field exists in an object
 *
 * @param obj The data object
 * @param field The field name to check
 * @returns True if the field exists and is not undefined
 */
export function hasField<T extends Record<string, unknown>>(obj: T, field: keyof T): boolean {
  if (obj == null) return false;
  return obj[field] !== undefined;
}
