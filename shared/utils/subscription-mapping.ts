/**
 * Subscription Field Mapping Utilities
 *
 * Module-specific mapping functions for the subscription domain.
 * These functions provide type-safe field mapping specifically for subscription-related data.
 */

import type { Subscription } from '@server/services/subscription/types.js'; // Corrected import path

import { toDatabaseFields, fromDatabaseFields } from './field-mapping.js';
import { subscriptionSchema, validateEntity, SchemaValidationError } from '../schema-validation.js';

/**
 * Maps a subscription object from code (camelCase) to database (snake_case)
 *
 * @param subscription The subscription object with camelCase fields
 * @returns The subscription object with snake_case fields for database operations
 */
export function subscriptionToDatabaseFields(
  subscription: Partial<Subscription>
): Record<string, unknown> {
  return toDatabaseFields(subscription);
}

/**
 * Maps a subscription object from database (snake_case) to code (camelCase)
 *
 * @param dbSubscription The subscription object with snake_case fields from database
 * @returns The subscription object with camelCase fields for code usage
 */
export function subscriptionFromDatabaseFields<T extends Record<string, unknown>>(
  dbSubscription: T
): Partial<Subscription> {
  const camelCaseObject = fromDatabaseFields(dbSubscription);
  try {
    // Validate the structure against the partial subscription schema
    // validateEntity will parse and return the typed object or throw SchemaValidationError
    return validateEntity(
      subscriptionSchema.partial(),
      camelCaseObject,
      'database subscription object'
    );
  } catch (error) {
    // Log detailed error information for debugging
    console.error(
      'Field mapping issue: Mapped object from database does not conform to Partial<Subscription> structure.',
      {
        originalDatabaseRecord: dbSubscription,
        mappedCamelCaseObject: camelCaseObject,
        validationErrorDetails:
          error instanceof SchemaValidationError
            ? error.toJSON()
            : error instanceof Error
              ? { message: error.message, stack: error.stack }
              : { message: String(error) },
      }
    );
    // Re-throw to ensure the calling code is aware of the data integrity problem.
    // Depending on application requirements, one might return a default or empty object,
    // but re-throwing is generally safer to prevent propagation of invalid data.
    if (error instanceof Error) throw error; // Re-throw original error if it's an Error instance
    throw new Error(
      `Failed to map subscription from database due to validation error: ${String(error)}`
    );
  }
}

/**
 * Maps an array of subscription objects from database to code format
 *
 * @param dbSubscriptions Array of subscription objects from database
 * @returns Array of subscription objects formatted for code usage
 */
export function mapSubscriptionArray<T extends Record<string, unknown>>(
  dbSubscriptions: T[]
): Partial<Subscription>[] {
  return dbSubscriptions.map(subscription => subscriptionFromDatabaseFields(subscription));
}

/**
 * Creates a subscription filter with properly formatted database field names
 *
 * @param filter Filter criteria in camelCase
 * @returns Filter criteria with snake_case field names for database queries
 */
export function createSubscriptionDbFilter(filter: Partial<Subscription>): Record<string, unknown> {
  return toDatabaseFields(filter);
}
