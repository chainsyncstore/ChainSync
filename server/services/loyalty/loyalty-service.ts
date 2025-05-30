/**
 * Standardized Loyalty Service Implementation
 * 
 * This implementation follows the standard service pattern defined in Phase 2
 * of the service standardization project.
 */

import { z } from 'zod';
import { eq, and, sql, desc } from 'drizzle-orm';
import { BaseService, ServiceError, ServiceConfig, ListResponse, withDbTryCatch } from '../base/standard-service';
import { 
  loyaltyMembers, 
  loyaltyPrograms, 
  loyaltyTiers, 
  loyaltyRewards,
  loyaltyTransactions,
  customers
} from '../../../shared/schema';
import { ErrorCode } from '../../../shared/types/errors';
import { RedisClientType } from 'redis';
import { validateDbResult, validateServiceData } from '../../utils/validation';
import { 
  programCreateSchema, 
  programUpdateSchema,
  tierCreateSchema,
  tierUpdateSchema,
  rewardCreateSchema,
  rewardUpdateSchema,
  memberCreateSchema,
  memberUpdateSchema,
  pointsUpdateSchema,
  transactionCreateSchema,
  redeemRewardSchema,
  memberListingSchema,
  ProgramCreate,
  ProgramUpdate,
  PointsUpdate
} from './schemas';

// Type definitions
export interface LoyaltyProgram {
  id: number;
  storeId: number;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface LoyaltyTier {
  id: number;
  programId: number;
  name: string;
  description: string | null;
  pointsRequired: string;
  multiplier: string;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface LoyaltyMember {
  id: number;
  programId: number;
  customerId: number;
  tierId: number | null;
  loyaltyId: string;
  points: string; // Renamed from currentPoints to match DB schema
  isActive: boolean;
  enrolledBy: number;
  enrolledAt: Date;
  updatedAt: Date | null;
}

export interface LoyaltyReward {
  id: number;
  programId: number;
  name: string;
  description: string | null;
  pointsRequired: string;
  isActive: boolean;
  type: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface LoyaltyTransaction {
  id: number;
  memberId: number;
  programId: number;
  transactionId: number | null;
  rewardId: number | null;
  type: string; // Allow any string to match DB schema
  points: string;
  notes: string | null;
  userId: number;
  createdAt: Date;
}

export interface MemberWithDetails {
  member: LoyaltyMember;
  customer: {
    id: number;
    fullName: string;
    email: string;
    phone: string | null;
  };
  program: LoyaltyProgram;
  tier: LoyaltyTier | null;
  statistics: {
    totalPoints: string; // This is derived from member.points
    recentTransactions: LoyaltyTransaction[];
  };
}

/**
 * Standardized Loyalty Service implementation following Phase 5 requirements
 * 
 * This version adds comprehensive validation and testing support
 */
export class LoyaltyService extends BaseService<LoyaltyMember, 
  z.infer<typeof memberCreateSchema>, 
  z.infer<typeof memberUpdateSchema>> {
  
  protected readonly entityName = 'loyalty_member';
  protected readonly tableName = 'loyalty_members';
  protected readonly primaryKeyField = 'id';
  protected readonly createSchema = memberCreateSchema;
  protected readonly updateSchema = memberUpdateSchema;
  protected readonly redis?: RedisClientType;
  private userId: number = 1; // Default system user ID
  
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
  
  constructor(config?: ServiceConfig, customLogger?: any) {
    super(config || {});
    
    // Allow injection of dependencies for testing
    if (customLogger) {
      // Use logger from config instead of trying to override readonly property
      // this.logger = customLogger;
    }
    
    this.redis = config?.redis;
    this.logger.info('LoyaltyService initialized');
  }
  
  /**
   * Create a loyalty program with validation
   * Exposed as both createProgram and createLoyaltyProgram for backward compatibility
   */
  async createProgram(data: ProgramCreate): Promise<LoyaltyProgram> {
    try {
      // Validate input data
      const validatedData = this.validateInput(data, programCreateSchema);
      
      // Insert into database
      const result = await this.executeQuery(
        async (db) => {
          return db.insert(this.safeIdentifier('loyalty_programs'))
            .values({
              ...validatedData,
              createdAt: new Date()
            })
            .returning();
        },
        'loyalty.createProgram'
      );
      
      const program = result[0];
      
      if (!program) {
        throw new ServiceError(
          ErrorCode.DATABASE_ERROR,
          'Failed to create loyalty program',
          { data: validatedData }
        );
      }
      
      // Invalidate cache for program lists
      if (this.cache) {
        await this.cache.invalidatePattern(`loyalty:programs:*`);
      }
      
      return program;
    } catch (error) {
      return this.handleError(error, 'Error creating loyalty program');
    }
  }
  
  /**
   * Alias for createProgram to support test compatibility
   */
  async createLoyaltyProgram(data: ProgramCreate): Promise<LoyaltyProgram> {
    return this.createProgram(data);
  }
  
  /**
   * Get a loyalty program by ID
   */
  /**
   * Helper method to wrap DB operations in try/catch with proper error handling
   */
  private withTryCatch<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    return withDbTryCatch(operation, (error) => {
      this.logger.error(`Error in ${operationName}`, { error });
      throw new ServiceError(
        ErrorCode.DATABASE_ERROR,
        `Error in ${operationName}`,
        { error: error instanceof Error ? error.message : String(error) }
      );
    });
  }

  /**
   * Get the current user ID for audit tracking
   */
  private getCurrentUserId(): number {
    return this.userId;
  }

  async getLoyaltyProgramById(id: string | number): Promise<LoyaltyProgram> {
    return this.withTryCatch(async () => {
      const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
      
      const program = await this.db.query.loyaltyPrograms.findFirst({
        where: eq(loyaltyPrograms.id, numericId)
      });
      
      if (!program) {
        throw new ServiceError(
          'Loyalty program not found',
          ErrorCode.NOT_FOUND,
          404
        );
      }
      
      return validateDbResult(z.object({
        id: z.number(),
        storeId: z.number(),
        name: z.string(),
        description: z.string().nullable(),
        isActive: z.boolean(),
        createdAt: z.date(),
        updatedAt: z.date().nullable()
      }), program, {
        operation: 'findById',
        entity: 'loyalty_program'
      });
    }, 'getLoyaltyProgramById');
  }
  
  /**
   * Enroll a customer in a loyalty program
   */
  async enrollCustomer(params: {
    customerId: string | number;
    programId: string | number;
    startingPoints: number;
    tierLevel: number;
  }): Promise<LoyaltyMember> {
    // Validate the input
    const validatedParams = validateServiceData(z.object({
      customerId: z.union([z.string(), z.number()]),
      programId: z.union([z.string(), z.number()]),
      startingPoints: z.number().min(0),
      tierLevel: z.number().min(1)
    }), params, {
      service: 'LoyaltyService',
      method: 'enrollCustomer',
      type: 'input'
    });
    
    return this.withTryCatch(async () => {
      // Convert IDs to numbers if they're strings
      const customerId = typeof validatedParams.customerId === 'string' 
        ? parseInt(validatedParams.customerId, 10) 
        : validatedParams.customerId;
        
      const programId = typeof validatedParams.programId === 'string' 
        ? parseInt(validatedParams.programId, 10) 
        : validatedParams.programId;
      
      // Check if program exists
      const program = await this.db.query.loyaltyPrograms.findFirst({
        where: eq(loyaltyPrograms.id, programId)
      });
      
      if (!program) {
        throw new ServiceError(
          'Loyalty program not found',
          ErrorCode.NOT_FOUND,
          404
        );
      }
      
      // Check if customer is already enrolled
      const existingMember = await this.db.query.loyaltyMembers.findFirst({
        where: and(
          eq(loyaltyMembers.customerId, customerId),
          eq(loyaltyMembers.programId, programId)
        )
      });
      
      if (existingMember) {
        throw new ServiceError(
          ErrorCode.CONFLICT,
          'Customer is already enrolled',
          { customerId, programId }
        );
      }
      
      // Generate a unique loyalty ID
      const loyaltyId = `LID-${customerId}-${programId}-${Date.now().toString(36)}`;
      
      // Create the membership using raw SQL for maximum flexibility with schema
      const result = await this.db.execute(sql`
        INSERT INTO loyalty_members (
          program_id, customer_id, tier_id, loyalty_id, 
          points, is_active, enrolled_by, enrolled_at, updated_at
        ) VALUES (
          ${programId}, ${customerId}, ${validatedParams.tierLevel}, ${loyaltyId},
          ${validatedParams.startingPoints.toString()}, ${true}, 
          ${this.getCurrentUserId() || 1}, ${new Date()}, ${new Date()}
        ) RETURNING *
      `);
      
      const member = result[0];
      
      // Record the enrollment transaction if starting points > 0
      if (validatedParams.startingPoints > 0) {
        await this.db.execute(sql`
          INSERT INTO loyalty_transactions (
            member_id, program_id, type, points, notes, user_id, created_at
          ) VALUES (
            ${member.id}, ${programId}, ${'enroll'}, 
            ${validatedParams.startingPoints.toString()},
            ${'Initial enrollment points'}, 
            ${this.getCurrentUserId() || 1},
            ${new Date()}
          )
        `);
      }
      
      return validateDbResult(z.object({
        id: z.number(),
        programId: z.number(),
        customerId: z.number(),
        tierId: z.number().nullable(),
        loyaltyId: z.string(),
        points: z.string(),
        isActive: z.boolean(),
        enrolledBy: z.number(),
        enrolledAt: z.date(),
        updatedAt: z.date().nullable()
      }), member, {
        operation: 'create',
        entity: 'loyalty_member'
      });
    }, 'enrollCustomer');
  }
  
  /**
   * Check if a customer is enrolled in a program
   */
  async isCustomerEnrolled(customerId: string | number, programId: string | number): Promise<boolean> {
    return this.withTryCatch(async () => {
      // Convert IDs to numbers if they're strings
      const custId = typeof customerId === 'string' ? parseInt(customerId, 10) : customerId;
      const progId = typeof programId === 'string' ? parseInt(programId, 10) : programId;
      
      const member = await this.db.query.loyaltyMembers.findFirst({
        where: and(
          eq(loyaltyMembers.customerId, custId),
          eq(loyaltyMembers.programId, progId)
        )
      });
      
      return !!member;
    }, 'isCustomerEnrolled');
  }
  
  /**
   * Get a member by ID
   */
  async getMemberById(id: string | number): Promise<LoyaltyMember> {
    return this.withTryCatch(async () => {
      const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
      
      const member = await this.db.query.loyaltyMembers.findFirst({
        where: eq(loyaltyMembers.id, numericId)
      });
      
      if (!member) {
        throw new ServiceError(
          ErrorCode.NOT_FOUND,
          'Loyalty member not found',
          { id: numericId }
        );
      }
      
      return validateDbResult(z.object({
        id: z.number(),
        programId: z.number(),
        customerId: z.number(),
        tierId: z.number().nullable(),
        loyaltyId: z.string(),
        points: z.string(),
        isActive: z.boolean(),
        enrolledBy: z.number(),
        enrolledAt: z.date(),
        updatedAt: z.date().nullable()
      }), member, {
        operation: 'findById',
        entity: 'loyalty_member'
      });
    }, 'getMemberById');
  }
  
  /**
   * Award points for a purchase
   */
  async awardPointsForPurchase(params: {
    memberId: string | number;
    purchaseAmount: number;
    orderId: string;
    storeId: string | number;
  }): Promise<LoyaltyTransaction> {
    // Validate the input
    const validatedParams = validateServiceData(z.object({
      memberId: z.union([z.string(), z.number()]),
      purchaseAmount: z.number().positive(),
      orderId: z.string(),
      storeId: z.union([z.string(), z.number()])
    }), params, {
      service: 'LoyaltyService',
      method: 'awardPointsForPurchase',
      type: 'input'
    });
    
    return this.withTryCatch(async () => {
      // Convert IDs to numbers if they're strings
      const memberId = typeof validatedParams.memberId === 'string' 
        ? parseInt(validatedParams.memberId, 10) 
        : validatedParams.memberId;
      
      // Get the member and program
      const member = await this.getMemberById(memberId);
      const program = await this.getLoyaltyProgramById(member.programId);
      
      // Calculate points to award
      const pointsToAward = Math.floor(validatedParams.purchaseAmount * program.pointsPerDollar);
      
      // Create transaction in a DB transaction to ensure data consistency
      return await this.db.transaction(async (tx) => {
        // Record the transaction
        const [transaction] = await tx.insert(loyaltyTransactions).values({
          memberId,
          programId: member.programId,
          type: 'purchase',
          points: pointsToAward.toString(),
          notes: `Points for order ${validatedParams.orderId}`,
          userId: this.getCurrentUserId() || 1
        }).returning();
        
        // Update member points
        const currentPoints = parseInt(member.points, 10);
        const newPoints = currentPoints + pointsToAward;
        
        await tx.update(loyaltyMembers)
          .set({ 
            points: newPoints.toString(),
            updatedAt: new Date()
          })
          .where(eq(loyaltyMembers.id, memberId));
        
        return validateDbResult(z.object({
          id: z.number(),
          memberId: z.number(),
          programId: z.number(),
          transactionId: z.number().nullable(),
          rewardId: z.number().nullable(),
          type: z.string(),
          points: z.string(),
          notes: z.string().nullable(),
          userId: z.number(),
          createdAt: z.date()
        }), transaction, {
          operation: 'create',
          entity: 'loyalty_transaction'
        });
      });
    }, 'awardPointsForPurchase');
  }
  
  /**
   * Update a loyalty program
   */
  async updateProgram(id: number, data: ProgramUpdate): Promise<LoyaltyProgram | null> {
    try {
      // Validate input data
      const validatedData = this.validateInput(data, programUpdateSchema);
      
      // Update in database
      const result = await this.executeQuery(
        async (db) => {
          return db.update(this.safeIdentifier('loyalty_programs'))
            .set({
              ...validatedData,
              updatedAt: new Date()
            })
            .where(eq(sql.identifier('id'), this.safeToString(id)))
            .returning();
        },
        'loyalty.updateProgram'
      );
      
      const program = result[0] || null;
      
      // Invalidate cache
      if (program && this.cache) {
        await this.cache.del(`loyalty:program:${id}`);
        await this.cache.invalidatePattern(`loyalty:programs:*`);
      }
      
      return program;
    } catch (error) {
      return this.handleError(error, `Error updating loyalty program with ID: ${id}`);
    }
  }
  
  /**
   * Get programs by store ID
   */
  async getProgramsByStoreId(storeId: number): Promise<LoyaltyProgram[]> {
    try {
      const cacheKey = `loyalty:programs:store:${storeId}`;
      
      // Try to get from cache first if available
      if (this.cache) {
        const cached = await this.cache.get(cacheKey);
        if (cached) {
          this.logger.debug(`Cache hit for ${cacheKey}`);
          return cached as LoyaltyProgram[];
        }
      }
      
      // Fetch from database
      const programs = await this.executeQuery(
        async (db) => {
          return db.select()
            .from(this.safeIdentifier('loyalty_programs'))
            .where(eq(sql.identifier('storeId'), this.safeToString(storeId)));
        },
        'loyalty.getProgramsByStoreId'
      );
      
      // Cache the result
      if (this.cache) {
        await this.cache.set(cacheKey, programs, this.CACHE_TTL.PROGRAM);
      }
      
      return programs;
    } catch (error) {
      return this.handleError(error, `Error fetching loyalty programs for store ID: ${storeId}`);
    }
  }
  
  /**
   * Create a loyalty tier
   */
  async createTier(data: z.infer<typeof tierCreateSchema>): Promise<LoyaltyTier> {
    try {
      // Validate input data
      const validatedData = this.validateInput(data, tierCreateSchema);
      
      // Verify the program exists
      const programExists = await this.executeQuery(
        async (db) => {
          return db.select()
            .from(this.safeIdentifier('loyalty_programs'))
            .where(eq(sql.identifier('id'), this.safeToString(validatedData.programId)))
            .limit(1);
        },
        'loyalty.verifyProgramExists'
      );
      
      if (!programExists.length) {
        throw new ServiceError(
          ErrorCode.NOT_FOUND,
          `Loyalty program with ID ${validatedData.programId} not found`,
          { programId: validatedData.programId }
        );
      }
      
      // Insert into database
      const result = await this.executeQuery(
        async (db) => {
          return db.insert(this.safeIdentifier('loyalty_tiers'))
            .values({
              ...validatedData,
              createdAt: new Date()
            })
            .returning();
        },
        'loyalty.createTier'
      );
      
      const tier = result[0];
      
      if (!tier) {
        throw new ServiceError(
          ErrorCode.DATABASE_ERROR,
          'Failed to create loyalty tier',
          { data: validatedData }
        );
      }
      
      // Invalidate cache for tier lists
      if (this.cache) {
        await this.cache.invalidatePattern(`loyalty:tiers:*`);
      }
      
      return tier;
    } catch (error) {
      return this.handleError(error, 'Error creating loyalty tier');
    }
  }
  
  /**
   * Get tiers by program ID
   */
  async getTiersByProgramId(programId: number): Promise<LoyaltyTier[]> {
    try {
      const cacheKey = `loyalty:tiers:program:${programId}`;
      
      // Try to get from cache first if available
      if (this.cache) {
        const cached = await this.cache.get(cacheKey);
        if (cached) {
          this.logger.debug(`Cache hit for ${cacheKey}`);
          return cached as LoyaltyTier[];
        }
      }
      
      // Fetch from database
      const tiers = await this.executeQuery(
        async (db) => {
          return db.select()
            .from(this.safeIdentifier('loyalty_tiers'))
            .where(eq(sql.identifier('programId'), this.safeToString(programId)))
            .orderBy(sql.identifier('pointsRequired'));
        },
        'loyalty.getTiersByProgramId'
      );
      
      // Cache the result
      if (this.cache) {
        await this.cache.set(cacheKey, tiers, this.CACHE_TTL.TIER);
      }
      
      return tiers;
    } catch (error) {
      return this.handleError(error, `Error fetching loyalty tiers for program ID: ${programId}`);
    }
  }
  
  /**
   * Update member points
   */
  async updatePoints(params: PointsUpdate): Promise<LoyaltyMember> {
    try {
      // Validate input data
      const validatedData = this.validateInput(params, pointsUpdateSchema);
      
      return await this.withTransaction(async (trx) => {
        // Get current member
        const memberResult = await trx.select()
          .from(this.safeIdentifier('loyalty_members'))
          .where(eq(sql.identifier('id'), this.safeToString(validatedData.memberId)))
          .limit(1);
        
        if (!memberResult.length) {
          throw new ServiceError(
            ErrorCode.NOT_FOUND,
            `Loyalty member with ID ${validatedData.memberId} not found`,
            { memberId: validatedData.memberId }
          );
        }
        
        const member = memberResult[0];
        let newPoints: number;
        // Use points field consistently
        const currentPoints = parseFloat(member.points || '0');
        const updatePoints = parseFloat(String(validatedData.points));
        
        // Calculate new points based on transaction type
        // Type safe comparison using string literals
        const transactionType = validatedData.type as string;
        if (transactionType === 'earn' || transactionType === 'enroll') {
          newPoints = currentPoints + updatePoints;
        } else if (validatedData.type === 'redeem') {
          // For redemptions, ensure customer has enough points
          if (currentPoints < updatePoints) {
            throw new ServiceError(
              ErrorCode.SERVICE_VALIDATION_FAILED,
              'Insufficient points for redemption',
              { 
                memberId: validatedData.memberId, 
                currentPoints, 
                redemptionPoints: updatePoints 
              }
            );
          }
          
          newPoints = currentPoints - updatePoints;
        } else {
          // For adjustments, just add/subtract (can be negative for point expirations)
          newPoints = currentPoints + updatePoints;
        }
        
        // Update the member's points
        await trx.update(this.safeIdentifier('loyalty_members'))
          .set({
            points: newPoints.toString(),
            updatedAt: new Date()
          })
          .where(eq(sql.identifier('id'), this.safeToString(validatedData.memberId)));
        
        // Create transaction record using SQL template for schema flexibility
        await trx.execute(sql`
          INSERT INTO loyalty_transactions (
            member_id, program_id, transaction_id, reward_id,
            type, points, notes, user_id, created_at
          ) VALUES (
            ${validatedData.memberId}, ${member.programId},
            ${validatedData.transactionId || null}, ${validatedData.rewardId || null},
            ${validatedData.type}, ${validatedData.points},
            ${validatedData.notes || null}, ${this.getCurrentUserId()},
            ${new Date()}
          )
        `);
        
        // Invalidate member cache
        if (this.cache) {
          await this.cache.del(`loyalty:member:${validatedData.memberId}`);
          await this.cache.invalidatePattern(`loyalty:transactions:member:${validatedData.memberId}:*`);
        }
        
        return updatedMember[0];
      });
    } catch (error) {
      return this.handleError(error, `Error updating points for member ID: ${params.memberId}`);
    }
  }
  
  /**
   * Redeem a reward
   */
  async redeemReward(params: z.infer<typeof redeemRewardSchema>): Promise<LoyaltyTransaction> {
    try {
      // Validate input
      const validatedData = this.validateInput(params, redeemRewardSchema);
      
      return await this.withTransaction(async (trx) => {
        // Get reward details
        const rewardResult = await trx.select()
          .from(this.safeIdentifier('loyalty_rewards'))
          .where(eq(sql.identifier('id'), this.safeToString(validatedData.rewardId)))
          .limit(1);
        
        if (!rewardResult.length) {
          throw new ServiceError(
            ErrorCode.NOT_FOUND,
            `Reward with ID ${validatedData.rewardId} not found`,
            { rewardId: validatedData.rewardId }
          );
        }
        
        const reward = rewardResult[0];
        
        // Get member details
        const memberResult = await trx.select()
          .from(this.safeIdentifier('loyalty_members'))
          .where(eq(sql.identifier('id'), this.safeToString(validatedData.memberId)))
          .limit(1);
        
        if (!memberResult.length) {
          throw new ServiceError(
            ErrorCode.NOT_FOUND,
            `Member with ID ${validatedData.memberId} not found`,
            { memberId: validatedData.memberId }
          );
        }
        
        const member = memberResult[0];
        
        // Check if member has enough points
        const currentPoints = parseFloat(member.currentPoints || '0');
        const requiredPoints = parseFloat(reward.pointsRequired);
        
        if (currentPoints < requiredPoints) {
          throw new ServiceError(
            ErrorCode.SERVICE_VALIDATION_FAILED,
            'Insufficient points for reward redemption',
            { requiredPoints, currentPoints }
          );
        }
        
        // Create points update params
        const pointsUpdateParams: PointsUpdate = {
          memberId: validatedData.memberId,
          points: -requiredPoints, // Negative to deduct points
          type: 'redeem',
          rewardId: validatedData.rewardId,
          transactionId: validatedData.transactionId,
          notes: validatedData.notes || `Redeemed reward: ${reward.name}`,
          userId: validatedData.userId
        };
        
        // Update points (this will also create the transaction)
        await this.updatePoints(pointsUpdateParams);
        
        // Get the newly created transaction
        const transactionResult = await trx.select()
          .from(this.safeIdentifier('loyalty_transactions'))
          .where(and(
            eq(sql.identifier('memberId'), this.safeToString(validatedData.memberId)),
            eq(sql.identifier('rewardId'), this.safeToString(validatedData.rewardId))
          ))
          .orderBy(desc(sql.identifier('createdAt')))
          .limit(1);
        
        return transactionResult[0];
      });
    } catch (error) {
      return this.handleError(error, `Error redeeming reward for member ID: ${params.memberId}`);
    }
  }
  
  /**
   * Get member transactions
   */
  async getMemberTransactions(memberId: number, limit: number = 20): Promise<LoyaltyTransaction[]> {
    try {
      const cacheKey = `loyalty:transactions:member:${memberId}:${limit}`;
      
      // Try to get from cache first if available
      if (this.cache) {
        const cached = await this.cache.get(cacheKey);
        if (cached) {
          this.logger.debug(`Cache hit for ${cacheKey}`);
          return cached as LoyaltyTransaction[];
        }
      }
      
      // Fetch from database
      const transactions = await this.executeQuery(
        async (db) => {
          return db.select()
            .from(this.safeIdentifier('loyalty_transactions'))
            .where(eq(sql.identifier('memberId'), this.safeToString(memberId)))
            .orderBy(desc(sql.identifier('createdAt')))
            .limit(limit);
        },
        'loyalty.getMemberTransactions'
      );
      
      // Cache the result
      if (this.cache) {
        await this.cache.set(cacheKey, transactions, this.CACHE_TTL.TRANSACTION);
      }
      
      return transactions;
    } catch (error) {
      return this.handleError(error, `Error fetching transactions for member ID: ${memberId}`);
    }
  }
  
  /**
   * Get member with full details
   */
  async getMemberWithFullDetails(memberId: number): Promise<MemberWithDetails> {
    try {
      // Get member
      const member = await this.getById(memberId);
      
      if (!member) {
        throw new ServiceError(
          ErrorCode.NOT_FOUND,
          `Member with ID ${memberId} not found`,
          { memberId }
        );
      }
      
      // Get customer details
      const customer = await this.executeQuery(
        async (db) => {
          return db.select({
            id: sql.identifier('id'),
            fullName: sql.identifier('fullName'),
            email: sql.identifier('email'),
            phone: sql.identifier('phone')
          })
          .from(this.safeIdentifier('customers'))
          .where(eq(sql.identifier('id'), this.safeToString(member.customerId)))
          .limit(1);
        },
        'loyalty.getCustomerDetails'
      );
      
      // Get program details
      const program = await this.executeQuery(
        async (db) => {
          return db.select()
            .from(this.safeIdentifier('loyalty_programs'))
            .where(eq(sql.identifier('id'), this.safeToString(member.programId)))
            .limit(1);
        },
        'loyalty.getProgramDetails'
      );
      
      // Get tier details if member has a tier
      let tier = null;
      if (member.tierId) {
        const tierResult = await this.executeQuery(
          async (db) => {
            return db.select()
              .from(this.safeIdentifier('loyalty_tiers'))
              .where(eq(sql.identifier('id'), this.safeToString(member.tierId)))
              .limit(1);
          },
          'loyalty.getTierDetails'
        );
        tier = tierResult[0] || null;
      }
      
      // Get recent transactions
      const recentTransactions = await this.getMemberTransactions(memberId, 5);
      
      // Assemble full details
      const memberWithDetails: MemberWithDetails = {
        member,
        customer: customer[0] || { 
          id: member.customerId, 
          fullName: 'Unknown', 
          email: 'unknown@example.com', 
          phone: null 
        },
        program: program[0] || { 
          id: member.programId, 
          name: 'Unknown Program',
          storeId: 0,
          description: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: null
        },
        tier,
        statistics: {
          totalPoints: member.currentPoints,
          recentTransactions
        }
      };
      
      return memberWithDetails;
    } catch (error) {
      return this.handleError(error, `Error fetching full details for member ID: ${memberId}`);
    }
  }
  
  /**
   * Get product IDs by loyalty program
   */
  async getProductIdsByLoyaltyProgram(programId: number): Promise<number[]> {
    try {
      const cacheKey = `loyalty:products:program:${programId}`;
      
      // Try to get from cache first if available
      if (this.cache) {
        const cached = await this.cache.get(cacheKey);
        if (cached) {
          this.logger.debug(`Cache hit for ${cacheKey}`);
          return cached as number[];
        }
      }
      
      // Fetch from database
      const productIds = await this.executeQuery(
        async (db) => {
          // Use raw SQL to avoid type issues with identifiers
          const result = await db.execute(sql`
            SELECT product_id FROM loyalty_program_products 
            WHERE program_id = ${programId}
          `);
          
          // Extract and convert to number array
          return (result as any[]).map(row => Number(row.product_id));
        },
        'loyalty.getProductIdsByProgram'
      );
      
      // Cache the result
      if (this.cache) {
        await this.cache.set(cacheKey, productIds, this.CACHE_TTL.LIST);
      }
      
      return productIds;
    } catch (error) {
      return this.handleError(error, `Error fetching product IDs for loyalty program ID: ${programId}`);
    }
  }
}
