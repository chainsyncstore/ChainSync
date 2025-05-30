/**
 * Loyalty Service Validation Schemas
 * 
 * This file defines all validation schemas for the loyalty service
 */

import { z } from 'zod';
import { CommonSchemas, SchemaUtils } from '../../utils/zod-helpers';

/**
 * Loyalty Program Schemas
 */
export const programCreateSchema = z.object({
  storeId: z.number().int().positive({ message: 'Store ID must be a positive integer' }),
  name: CommonSchemas.nonEmptyString,
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const programUpdateSchema = programCreateSchema.partial();

/**
 * Loyalty Tier Schemas
 */
export const tierCreateSchema = z.object({
  programId: z.number().int().positive({ message: 'Program ID must be a positive integer' }),
  name: CommonSchemas.nonEmptyString,
  description: z.string().optional(),
  pointsRequired: z.string().or(z.number())
    .transform(val => String(val)),
  multiplier: z.string().or(z.number())
    .transform(val => String(val)),
});

export const tierUpdateSchema = tierCreateSchema.partial();

/**
 * Loyalty Reward Schemas
 */
export const rewardCreateSchema = z.object({
  programId: z.number().int().positive({ message: 'Program ID must be a positive integer' }),
  name: CommonSchemas.nonEmptyString,
  description: z.string().optional(),
  pointsRequired: z.string().or(z.number())
    .transform(val => String(val)),
  isActive: z.boolean().default(true),
  type: z.enum(['discount', 'free_item', 'service', 'gift', 'other']),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const rewardUpdateSchema = rewardCreateSchema.partial();

/**
 * Loyalty Member Schemas
 */
export const memberCreateSchema = z.object({
  programId: z.number().int().positive({ message: 'Program ID must be a positive integer' }),
  customerId: z.number().int().positive({ message: 'Customer ID must be a positive integer' }),
  loyaltyId: z.string().min(3).max(50),
  points: z.string().or(z.number())
    .transform(val => String(val))
    .default('0'),
  tierId: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().default(true),
  enrolledBy: z.number().int().positive(),
});

export const memberUpdateSchema = memberCreateSchema.partial();

/**
 * Points Update Schema
 */
export const pointsUpdateSchema = z.object({
  memberId: z.number().int().positive({ message: 'Member ID must be a positive integer' }),
  points: z.string().or(z.number())
    .transform(val => String(val)),
  type: z.enum(['earn', 'redeem', 'adjust']),
  transactionId: z.number().int().positive().optional().nullable(),
  rewardId: z.number().int().positive().optional().nullable(),
  notes: z.string().optional(),
  userId: z.number().int().positive(),
});

/**
 * Loyalty Transaction Schemas
 */
export const transactionCreateSchema = z.object({
  memberId: z.number().int().positive({ message: 'Member ID must be a positive integer' }),
  programId: z.number().int().positive({ message: 'Program ID must be a positive integer' }),
  transactionId: z.number().int().positive().optional().nullable(),
  rewardId: z.number().int().positive().optional().nullable(),
  type: z.enum(['earn', 'redeem', 'enroll', 'adjust']),
  points: z.string().or(z.number())
    .transform(val => String(val)),
  userId: z.number().int().positive(),
  notes: z.string().optional(),
});

/**
 * Reward Redemption Schema
 */
export const redeemRewardSchema = z.object({
  memberId: z.number().int().positive({ message: 'Member ID must be a positive integer' }),
  rewardId: z.number().int().positive({ message: 'Reward ID must be a positive integer' }),
  transactionId: z.number().int().positive().optional(),
  userId: z.number().int().positive(),
  notes: z.string().optional(),
});

/**
 * Member Listing Schema
 */
export const memberListingSchema = z.object({
  programId: z.number().int().positive().optional(),
  customerId: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  query: z.string().optional(),
  ...CommonSchemas.pagination,
});

/**
 * Types for service usage
 */
export type ProgramCreate = z.infer<typeof programCreateSchema>;
export type ProgramUpdate = z.infer<typeof programUpdateSchema>;
export type TierCreate = z.infer<typeof tierCreateSchema>;
export type TierUpdate = z.infer<typeof tierUpdateSchema>;
export type RewardCreate = z.infer<typeof rewardCreateSchema>;
export type RewardUpdate = z.infer<typeof rewardUpdateSchema>;
export type MemberCreate = z.infer<typeof memberCreateSchema>;
export type MemberUpdate = z.infer<typeof memberUpdateSchema>;
export type PointsUpdate = z.infer<typeof pointsUpdateSchema>;
export type TransactionCreate = z.infer<typeof transactionCreateSchema>;
export type RedeemReward = z.infer<typeof redeemRewardSchema>;
export type MemberListing = z.infer<typeof memberListingSchema>;
