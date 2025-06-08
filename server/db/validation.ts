/**
 * Database Validation Layer
 *
 * This module provides runtime schema validation for database responses
 * using Zod to ensure data integrity and prevent runtime errors.
 */

import { z } from 'zod';

import { validateDbResponse } from './sqlHelpers';
import { getLogger } from '../../src/logging';

const logger = getLogger().child({ component: 'db-validation' });

// Base schemas for common fields
const idSchema = z.number().int().positive();
const createdAtSchema = z.date();
const updatedAtSchema = z.date().nullable();
const isActiveSchema = z.boolean();

// Define schemas for database entities
export const userSchema = z.object({
  id: idSchema,
  name: z.string(),
  email: z.string().email(),
  passwordHash: z.string(),
  role: z.string(),
  isActive: isActiveSchema,
  createdAt: createdAtSchema,
  updatedAt: updatedAtSchema,
});

export const storeSchema = z.object({
  id: idSchema,
  name: z.string(),
  email: z.string().email(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  timezone: z.string(),
  country: z.string().length(2),
  isActive: isActiveSchema,
  createdAt: createdAtSchema,
  updatedAt: updatedAtSchema,
});

export const customerSchema = z.object({
  id: idSchema,
  storeId: idSchema,
  fullName: z.string(),
  email: z.string().email(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  createdAt: createdAtSchema,
  updatedAt: updatedAtSchema,
});

export const productSchema = z.object({
  id: idSchema,
  storeId: idSchema,
  name: z.string(),
  description: z.string().nullable(),
  sku: z.string(),
  price: z.string(), // Decimal as string
  stockQuantity: z.number().int(),
  isActive: isActiveSchema,
  createdAt: createdAtSchema,
  updatedAt: updatedAtSchema,
});

export const orderSchema = z.object({
  id: idSchema,
  storeId: idSchema,
  customerId: idSchema,
  orderNumber: z.string(),
  status: z.string(),
  totalAmount: z.string(), // Decimal as string
  createdAt: createdAtSchema,
  updatedAt: updatedAtSchema,
});

export const orderItemSchema = z.object({
  id: idSchema,
  orderId: idSchema,
  productId: idSchema,
  quantity: z.number().int().positive(),
  unitPrice: z.string(), // Decimal as string
  totalPrice: z.string(), // Decimal as string
  createdAt: createdAtSchema,
});

export const loyaltyProgramSchema = z.object({
  id: idSchema,
  storeId: idSchema,
  name: z.string(),
  description: z.string().nullable(),
  isActive: isActiveSchema,
  createdAt: createdAtSchema,
  updatedAt: updatedAtSchema,
});

export const loyaltyTierSchema = z.object({
  id: idSchema,
  programId: idSchema,
  name: z.string(),
  description: z.string().nullable(),
  pointsRequired: z.string(), // Decimal as string
  multiplier: z.string(), // Decimal as string
  createdAt: createdAtSchema,
  updatedAt: updatedAtSchema,
});

export const loyaltyMemberSchema = z.object({
  id: idSchema,
  programId: idSchema,
  customerId: idSchema,
  tierId: idSchema.nullable(),
  loyaltyId: z.string(),
  points: z.string(), // Decimal as string
  isActive: isActiveSchema,
  enrolledBy: idSchema,
  enrolledAt: createdAtSchema,
  updatedAt: updatedAtSchema,
});

export const loyaltyRewardSchema = z.object({
  id: idSchema,
  programId: idSchema,
  name: z.string(),
  description: z.string().nullable(),
  pointsRequired: z.string(), // Decimal as string
  isActive: isActiveSchema,
  type: z.string(),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: createdAtSchema,
  updatedAt: updatedAtSchema,
});

export const loyaltyTransactionSchema = z.object({
  id: idSchema,
  memberId: idSchema,
  programId: idSchema,
  transactionId: idSchema.nullable(),
  rewardId: idSchema.nullable(),
  type: z.enum(['earn', 'redeem', 'enroll', 'adjust']),
  points: z.string(), // Decimal as string
  notes: z.string().nullable(),
  userId: idSchema,
  createdAt: createdAtSchema,
});

// Types derived from schemas
export type User = z.infer<typeof userSchema>;
export type Store = z.infer<typeof storeSchema>;
export type Customer = z.infer<typeof customerSchema>;
export type Product = z.infer<typeof productSchema>;
export type Order = z.infer<typeof orderSchema>;
export type OrderItem = z.infer<typeof orderItemSchema>;
export type LoyaltyProgram = z.infer<typeof loyaltyProgramSchema>;
export type LoyaltyTier = z.infer<typeof loyaltyTierSchema>;
export type LoyaltyMember = z.infer<typeof loyaltyMemberSchema>;
export type LoyaltyReward = z.infer<typeof loyaltyRewardSchema>;
export type LoyaltyTransaction = z.infer<typeof loyaltyTransactionSchema>;

// Extended schema for loyalty member with additional data
export const loyaltyMemberWithDetailsSchema = z.object({
  member: loyaltyMemberSchema,
  customer: z.object({
    id: idSchema,
    fullName: z.string(),
    email: z.string().email(),
    phone: z.string().nullable(),
  }),
  program: loyaltyProgramSchema,
  tier: loyaltyTierSchema.nullable(),
  statistics: z.object({
    totalPoints: z.string(), // Decimal as string
    recentTransactions: z.array(loyaltyTransactionSchema),
  }),
});

export type LoyaltyMemberWithDetails = z.infer<typeof loyaltyMemberWithDetailsSchema>;

/**
 * Validate database response for a user
 */
export function validateUser(data: unknown): User {
  return validateDbResponse(data, userSchema);
}

/**
 * Validate database response for a store
 */
export function validateStore(data: unknown): Store {
  return validateDbResponse(data, storeSchema);
}

/**
 * Validate database response for a customer
 */
export function validateCustomer(data: unknown): Customer {
  return validateDbResponse(data, customerSchema);
}

/**
 * Validate database response for a product
 */
export function validateProduct(data: unknown): Product {
  return validateDbResponse(data, productSchema);
}

/**
 * Validate database response for an order
 */
export function validateOrder(data: unknown): Order {
  return validateDbResponse(data, orderSchema);
}

/**
 * Validate database response for an order item
 */
export function validateOrderItem(data: unknown): OrderItem {
  return validateDbResponse(data, orderItemSchema);
}

/**
 * Validate database response for a loyalty program
 */
export function validateLoyaltyProgram(data: unknown): LoyaltyProgram {
  return validateDbResponse(data, loyaltyProgramSchema);
}

/**
 * Validate database response for a loyalty tier
 */
export function validateLoyaltyTier(data: unknown): LoyaltyTier {
  return validateDbResponse(data, loyaltyTierSchema);
}

/**
 * Validate database response for a loyalty member
 */
export function validateLoyaltyMember(data: unknown): LoyaltyMember {
  return validateDbResponse(data, loyaltyMemberSchema);
}

/**
 * Validate database response for a loyalty reward
 */
export function validateLoyaltyReward(data: unknown): LoyaltyReward {
  return validateDbResponse(data, loyaltyRewardSchema);
}

/**
 * Validate database response for a loyalty transaction
 */
export function validateLoyaltyTransaction(data: unknown): LoyaltyTransaction {
  return validateDbResponse(data, loyaltyTransactionSchema);
}

/**
 * Validate database response for a loyalty member with details
 */
export function validateLoyaltyMemberWithDetails(data: unknown): LoyaltyMemberWithDetails {
  return validateDbResponse(data, loyaltyMemberWithDetailsSchema);
}

/**
 * Validate an array of database responses
 */
export function validateArray<T>(data: unknown, schema: z.ZodSchema<T>): T[] {
  if (!Array.isArray(data)) {
    throw new Error('Expected array but received ' + typeof data);
  }

  return data.map(item => validateDbResponse(item, schema));
}
