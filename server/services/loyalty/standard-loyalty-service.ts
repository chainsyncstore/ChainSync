/**
 * Standardized Loyalty Service
 * 
 * This implementation follows the standard service pattern and 
 * provides loyalty program management functionality.
 */

import { z } from 'zod';
import { eq, and, desc, sql } from 'drizzle-orm';
import { BaseService, ServiceError, ServiceConfig } from '../base/standard-service';
import { 
  loyaltyMembers, 
  loyaltyPrograms, 
  loyaltyTiers, 
  loyaltyRewards,
  loyaltyTransactions,
  users,
  customers
} from '@shared/db';
import { ErrorCode } from '@shared/types/errors';

// Schema definitions for input validation
const memberCreateSchema = z.object({
  customerId: z.number(),
  storeId: z.number(),
  programId: z.number(),
  loyaltyId: z.string().optional(),
  tierId: z.number().optional(),
  currentPoints: z.string().or(z.number()).default('0'),
  active: z.boolean().default(true),
});

const memberUpdateSchema = z.object({
  customerId: z.number().optional(),
  storeId: z.number().optional(),
  programId: z.number().optional(),
  loyaltyId: z.string().optional(),
  tierId: z.number().optional(),
  currentPoints: z.string().or(z.number()).optional(),
  totalPointsEarned: z.string().or(z.number()).optional(),
  totalPointsRedeemed: z.string().or(z.number()).optional(),
  active: z.boolean().optional(),
});

const programCreateSchema = z.object({
  storeId: z.number(),
  name: z.string().min(1),
  description: z.string().optional(),
  pointsPerAmount: z.string().or(z.number()).default('1'),
  active: z.boolean().default(true),
});

const programUpdateSchema = z.object({
  storeId: z.number().optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  pointsPerAmount: z.string().or(z.number()).optional(),
  active: z.boolean().optional(),
});

const tierCreateSchema = z.object({
  programId: z.number(),
  name: z.string().min(1),
  description: z.string().optional(),
  pointsRequired: z.string().or(z.number()),
  active: z.boolean().default(true),
});

const tierUpdateSchema = z.object({
  programId: z.number().optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  pointsRequired: z.string().or(z.number()).optional(),
  active: z.boolean().optional(),
});

const rewardCreateSchema = z.object({
  programId: z.number(),
  name: z.string().min(1),
  description: z.string().optional(),
  pointsRequired: z.string().or(z.number()),
  active: z.boolean().default(true),
});

const rewardUpdateSchema = z.object({
  programId: z.number().optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  pointsRequired: z.string().or(z.number()).optional(),
  active: z.boolean().optional(),
});

const pointsUpdateSchema = z.object({
  memberId: z.number(),
  points: z.string().or(z.number()),
  transactionId: z.number().optional(),
  type: z.enum(['earn', 'redeem', 'adjust', 'expire']),
  note: z.string().optional(),
  createdBy: z.number(),
});

// Type definitions
export interface LoyaltyMember {
  id: number;
  customerId: number;
  storeId: number;
  programId: number;
  loyaltyId: string;
  tierId: number;
  currentPoints: string;
  totalPointsEarned: string;
  totalPointsRedeemed: string;
  enrollmentDate: Date;
  lastActivity: Date;
  active: boolean;
  createdAt: Date;
}

export interface LoyaltyProgram {
  id: number;
  storeId: number;
  name: string;
  description: string;
  pointsPerAmount: string;
  active: boolean;
  createdAt: Date;
}

export interface LoyaltyTier {
  id: number;
  programId: number;
  name: string;
  description: string;
  pointsRequired: string;
  active: boolean;
  createdAt: Date;
}

export interface LoyaltyReward {
  id: number;
  programId: number;
  name: string;
  description: string;
  pointsRequired: string;
  active: boolean;
  createdAt: Date;
}

export interface LoyaltyTransaction {
  id: number;
  memberId: number;
  transactionId?: number;
  type: string;
  points: string;
  note?: string;
  createdBy: number;
  createdAt: Date;
}

export interface MemberWithDetails extends LoyaltyMember {
  customer: {
    id: number;
    fullName: string;
    email: string;
    phone?: string;
  };
  program: {
    id: number;
    name: string;
  };
  tier: {
    id: number;
    name: string;
  };
}

export interface PointsUpdateParams {
  memberId: number;
  points: string | number;
  transactionId?: number;
  type: 'earn' | 'redeem' | 'adjust' | 'expire';
  note?: string;
  createdBy: number;
}

/**
 * Standardized Loyalty Service implementation
 */
export class LoyaltyService extends BaseService<LoyaltyMember, 
  z.infer<typeof memberCreateSchema>, 
  z.infer<typeof memberUpdateSchema>> {
  
  protected readonly entityName = 'loyalty_member';
  protected readonly tableName = loyaltyMembers;
  protected readonly primaryKeyField = 'id';
  protected readonly createSchema = memberCreateSchema;
  protected readonly updateSchema = memberUpdateSchema;
  
  /**
   * Cache TTLs (in seconds)
   */
  private readonly CACHE_TTL = {
    MEMBER: 3600, // 1 hour
    PROGRAM: 3600, // 1 hour
    TIER: 3600, // 1 hour
    REWARD: 3600, // 1 hour
    TRANSACTION: 1800, // 30 minutes
    LIST: 300, // 5 minutes
  };
  
  constructor(config: ServiceConfig) {
    super(config);
    this.logger.info('LoyaltyService initialized');
  }
  
  /**
   * Get member with customer, program, and tier details
   */
  async getMemberWithDetails(id: number): Promise<MemberWithDetails | null> {
    try {
      const cacheKey = `loyalty:member:details:${id}`;
      
      // Try to get from cache first if available
      if (this.cache) {
        const cached = await this.cache.get(cacheKey);
        if (cached) {
          this.logger.debug(`Cache hit for ${cacheKey}`);
          return cached as MemberWithDetails;
        }
      }
      
      // Fetch from database if not in cache
      const result = await this.executeQuery(
        async (db) => {
          return db.select({
            member: loyaltyMembers,
            customer: {
              id: customers.id,
              fullName: customers.fullName,
              email: customers.email,
              phone: customers.phone,
            },
            program: {
              id: loyaltyPrograms.id,
              name: loyaltyPrograms.name,
            },
            tier: {
              id: loyaltyTiers.id,
              name: loyaltyTiers.name,
            }
          })
          .from(loyaltyMembers)
          .innerJoin(customers, eq(loyaltyMembers.customerId, customers.id))
          .innerJoin(loyaltyPrograms, eq(loyaltyMembers.programId, loyaltyPrograms.id))
          .innerJoin(loyaltyTiers, eq(loyaltyMembers.tierId, loyaltyTiers.id))
          .where(eq(loyaltyMembers.id, id))
          .limit(1);
        },
        'loyalty.getMemberWithDetails'
      );
      
      if (!result.length) {
        return null;
      }
      
      // Transform result to expected format
      const memberWithDetails: MemberWithDetails = {
        ...result[0].member,
        customer: result[0].customer,
        program: result[0].program,
        tier: result[0].tier,
      };
      
      // Cache the result
      if (this.cache) {
        await this.cache.set(cacheKey, memberWithDetails, this.CACHE_TTL.MEMBER);
      }
      
      return memberWithDetails;
    } catch (error) {
      return this.handleError(error, `Error fetching loyalty member with details for ID: ${id}`);
    }
  }
  
  /**
   * Get member by customer ID
   */
  async getMemberByCustomerId(customerId: number, storeId?: number): Promise<LoyaltyMember | null> {
    try {
      const cacheKey = `loyalty:member:customer:${customerId}:${storeId || 'all'}`;
      
      // Try to get from cache first if available
      if (this.cache) {
        const cached = await this.cache.get(cacheKey);
        if (cached) {
          this.logger.debug(`Cache hit for ${cacheKey}`);
          return cached as LoyaltyMember;
        }
      }
      
      // Build query conditions
      const conditions = [eq(loyaltyMembers.customerId, customerId)];
      if (storeId !== undefined) {
        conditions.push(eq(loyaltyMembers.storeId, storeId));
      }
      
      // Fetch from database
      const result = await this.executeQuery(
        async (db) => {
          return db
            .select()
            .from(loyaltyMembers)
            .where(and(...conditions))
            .limit(1);
        },
        'loyalty.getMemberByCustomerId'
      );
      
      const member = result[0] || null;
      
      // Cache the result
      if (member && this.cache) {
        await this.cache.set(cacheKey, member, this.CACHE_TTL.MEMBER);
      }
      
      return member;
    } catch (error) {
      return this.handleError(error, `Error fetching loyalty member by customer ID: ${customerId}`);
    }
  }
  
  /**
   * Get member by loyalty ID
   */
  async getMemberByLoyaltyId(loyaltyId: string): Promise<LoyaltyMember | null> {
    try {
      const cacheKey = `loyalty:member:loyaltyId:${loyaltyId}`;
      
      // Try to get from cache first if available
      if (this.cache) {
        const cached = await this.cache.get(cacheKey);
        if (cached) {
          this.logger.debug(`Cache hit for ${cacheKey}`);
          return cached as LoyaltyMember;
        }
      }
      
      // Fetch from database
      const result = await this.executeQuery(
        async (db) => {
          return db
            .select()
            .from(loyaltyMembers)
            .where(eq(loyaltyMembers.loyaltyId, loyaltyId))
            .limit(1);
        },
        'loyalty.getMemberByLoyaltyId'
      );
      
      const member = result[0] || null;
      
      // Cache the result
      if (member && this.cache) {
        await this.cache.set(cacheKey, member, this.CACHE_TTL.MEMBER);
      }
      
      return member;
    } catch (error) {
      return this.handleError(error, `Error fetching loyalty member by loyalty ID: ${loyaltyId}`);
    }
  }
