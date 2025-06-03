/**
 * Loyalty Field Mapping Utilities
 * 
 * Module-specific mapping functions for the loyalty domain.
 * These functions provide type-safe field mapping specifically for loyalty-related data.
 */

import { toDatabaseFields, fromDatabaseFields } from './field-mapping';

// Define interfaces for loyalty-related entities
interface LoyaltyMember {
  id: number;
  customerId: number; // Changed from userId
  programId: number; // This might need review depending on how programs are linked
  loyaltyId: string; // Changed from membershipId
  points: number;
  tierId: number; // Changed from tier (string) to tierId (number)
  status: 'active' | 'inactive' | 'suspended';
  joinDate: Date;
  expiryDate?: Date;
  metadata?: Record<string, unknown>;
}

interface LoyaltyProgram {
  id: number;
  name: string;
  description?: string;
  pointsPerCurrency: number;
  currencyPerPoint: number;
  tiers: string[];
  rules?: Record<string, unknown>;
  storeId?: number;
  isActive: boolean;
  startDate: Date;
  endDate?: Date;
}

interface LoyaltyTransaction {
  id: number;
  memberId: number;
  points: number;
  type: 'earn' | 'redeem' | 'expire' | 'adjust';
  source: string;
  reference?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Maps a loyalty member object from code (camelCase) to database (snake_case)
 * 
 * @param member The loyalty member object with camelCase fields
 * @returns The loyalty member object with snake_case fields for database operations
 */
export function loyaltyMemberToDatabaseFields(member: Partial<LoyaltyMember>): Record<string, unknown> {
  return toDatabaseFields(member);
}

/**
 * Maps a loyalty member object from database (snake_case) to code (camelCase)
 * 
 * @param dbMember The loyalty member object with snake_case fields from database
 * @returns The loyalty member object with camelCase fields for code usage
 */
export function loyaltyMemberFromDatabaseFields<T extends Record<string, unknown>>(dbMember: T): Partial<LoyaltyMember> {
  return fromDatabaseFields(dbMember) as Partial<LoyaltyMember>;
}

/**
 * Maps a loyalty program object from code (camelCase) to database (snake_case)
 * 
 * @param program The loyalty program object with camelCase fields
 * @returns The loyalty program object with snake_case fields for database operations
 */
export function loyaltyProgramToDatabaseFields(program: Partial<LoyaltyProgram>): Record<string, unknown> {
  return toDatabaseFields(program);
}

/**
 * Maps a loyalty program object from database (snake_case) to code (camelCase)
 * 
 * @param dbProgram The loyalty program object with snake_case fields from database
 * @returns The loyalty program object with camelCase fields for code usage
 */
export function loyaltyProgramFromDatabaseFields<T extends Record<string, unknown>>(dbProgram: T): Partial<LoyaltyProgram> {
  return fromDatabaseFields(dbProgram) as Partial<LoyaltyProgram>;
}

/**
 * Maps a loyalty transaction object from code (camelCase) to database (snake_case)
 * 
 * @param transaction The loyalty transaction object with camelCase fields
 * @returns The loyalty transaction object with snake_case fields for database operations
 */
export function loyaltyTransactionToDatabaseFields(transaction: Partial<LoyaltyTransaction>): Record<string, unknown> {
  return toDatabaseFields(transaction);
}

/**
 * Maps a loyalty transaction object from database (snake_case) to code (camelCase)
 * 
 * @param dbTransaction The loyalty transaction object with snake_case fields from database
 * @returns The loyalty transaction object with camelCase fields for code usage
 */
export function loyaltyTransactionFromDatabaseFields<T extends Record<string, unknown>>(dbTransaction: T): Partial<LoyaltyTransaction> {
  return fromDatabaseFields(dbTransaction) as Partial<LoyaltyTransaction>;
}

/**
 * Maps an array of loyalty objects from database to code format
 * 
 * @param dbItems Array of loyalty objects from database
 * @param mapFn The mapping function to use
 * @returns Array of loyalty objects formatted for code usage
 */
export function mapLoyaltyArray<T extends Record<string, unknown>, R>(
  dbItems: T[], 
  mapFn: (item: T) => R
): R[] {
  return dbItems.map(mapFn);
}

/**
 * Creates a loyalty filter with properly formatted database field names
 * 
 * @param filter Filter criteria in camelCase
 * @returns Filter criteria with snake_case field names for database queries
 */
export function createLoyaltyDbFilter<T>(filter: Partial<T>): Record<string, unknown> {
  return toDatabaseFields(filter);
}
