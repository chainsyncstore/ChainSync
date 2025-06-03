/**
 * Standardized Loyalty Service - Part 2
 * 
 * Continuing the implementation with additional methods
 */

import { z } from 'zod';
import { eq, and, desc, sql } from 'drizzle-orm';
// Removed duplicate imports of z and drizzle-orm utils
import { 
  loyaltyMembers, 
  loyaltyPrograms, 
  loyaltyTiers, 
  loyaltyRewards,
  loyaltyTransactions,
  customers,
  // Import Drizzle types
  type LoyaltyProgram, 
  type LoyaltyTier, 
  type LoyaltyReward, 
  type LoyaltyMember, 
  type LoyaltyTransaction 
} from '../../../shared/schema';
import { ErrorCode } from '../../../shared/types/errors';
import { BaseService, ServiceError, ServiceConfig } from '../base/standard-service';
import { RedisClientType } from 'redis'; // This might not be used directly if cache service abstracts it
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
  // LoyaltyProgram, LoyaltyTier etc. are Drizzle types, not from ./schemas
} from './schemas';

export class StandardLoyaltyServicePart2 extends BaseService<LoyaltyProgram, z.infer<typeof programCreateSchema>, z.infer<typeof programUpdateSchema>> {
  private static readonly CACHE_TTL = {
    PROGRAM: 3600, // 1 hour in seconds
    TIER: 3600,
    REWARD: 3600,
    TRANSACTION: 3600,
    MEMBER_DETAILS: 1800, // 30 minutes for member details
  };

  // Implement required abstract members
  protected readonly entityName = 'loyalty_program';
  protected readonly tableName = 'loyalty_programs';
  protected readonly primaryKeyField = 'id';
  // Cast the schema to match the expected types in BaseService
  protected readonly createSchema = programCreateSchema as unknown as z.ZodType<{ storeId: number; name: string; isActive: boolean; description?: string | undefined; }>;
  // Cast the schema to match the expected types in BaseService
  protected readonly updateSchema = programUpdateSchema as unknown as z.ZodType<{ storeId?: number; name?: string; isActive?: boolean; description?: string; }>;
  /**
   * Create a loyalty program
   */
  async createProgram(data: z.infer<typeof programCreateSchema>): Promise<LoyaltyProgram> {
    try {
      // Validate input data
      const validatedData = this.validateInput(data, programCreateSchema);
      
      // Insert into database
      const result = await this.executeQuery(
        async (db) => {
          return db.insert(loyaltyPrograms).values({
            ...validatedData,
            createdAt: new Date()
          }).returning();
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
   * Update a loyalty program
   */
  async updateProgram(id: number, data: z.infer<typeof programUpdateSchema>): Promise<LoyaltyProgram | null> {
    try {
      // Validate input data
      const validatedData = this.validateInput(data, programUpdateSchema);
      
      // Update in database
      const result = await this.executeQuery(
        async (db) => {
          return db
            .update(loyaltyPrograms)
            .set(validatedData)
            .where(eq(loyaltyPrograms.id, id))
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
          return db
            .select()
            .from(loyaltyPrograms)
            .where(eq(loyaltyPrograms.storeId, storeId));
        },
        'loyalty.getProgramsByStoreId'
      );
      
      // Cache the result
      if (this.cache) {
        await this.cache.set(cacheKey, programs, StandardLoyaltyServicePart2.CACHE_TTL.PROGRAM);
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
          return db
            .select()
            .from(loyaltyPrograms)
            .where(eq(loyaltyPrograms.id, validatedData.programId))
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
          return db.insert(loyaltyTiers).values({
            ...validatedData,
            createdAt: new Date()
          }).returning();
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
          return db
            .select()
            .from(loyaltyTiers)
            .where(eq(loyaltyTiers.programId, programId))
            .orderBy(loyaltyTiers.pointThreshold); // Changed pointsRequired to pointThreshold
        },
        'loyalty.getTiersByProgramId'
      );
      
      // Cache the result
      if (this.cache) {
        await this.cache.set(cacheKey, tiers, StandardLoyaltyServicePart2.CACHE_TTL.TIER);
      }
      
      return tiers;
    } catch (error) {
      return this.handleError(error, `Error fetching loyalty tiers for program ID: ${programId}`);
    }
  }
  
  /**
   * Create a loyalty reward
   */
  async createReward(data: z.infer<typeof rewardCreateSchema>): Promise<LoyaltyReward> {
    try {
      // Validate input data
      const validatedData = this.validateInput(data, rewardCreateSchema);
      
      // Verify the program exists
      const programExists = await this.executeQuery(
        async (db) => {
          return db
            .select()
            .from(loyaltyPrograms)
            .where(eq(loyaltyPrograms.id, validatedData.programId))
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
      // Map fields from the schema names to database column names
      const result = await this.executeQuery(
        async (db) => {
          return db.insert(loyaltyRewards).values({
            programId: validatedData.programId,
            name: validatedData.name,
            description: validatedData.description,
            pointCost: Number(validatedData.pointsRequired), // Map pointsRequired to pointCost
            isActive: validatedData.isActive ?? true,
            createdAt: new Date(),
            updatedAt: new Date()
          }).returning();
        },
        'loyalty.createReward'
      );
      
      const reward = result[0];
      
      if (!reward) {
        throw new ServiceError(
          ErrorCode.DATABASE_ERROR,
          'Failed to create loyalty reward',
          { data: validatedData }
        );
      }
      
      // Clear caches related to this program
      await this.invalidateListCache();
      
      // Invalidate cache for reward lists
      if (this.cache) {
        await this.cache.invalidatePattern(`loyalty:rewards:*`);
      }
      
      return reward;
    } catch (error) {
      return this.handleError(error, 'Error creating loyalty reward');
    }
  }
  
  /**
   * Get rewards by program ID
   */
  async getRewardsByProgramId(programId: number): Promise<LoyaltyReward[]> {
    try {
      const cacheKey = `loyalty:rewards:program:${programId}`;
      
      // Try to get from cache first if available
      if (this.cache) {
        const cached = await this.cache.get(cacheKey);
        if (cached) {
          this.logger.debug(`Cache hit for ${cacheKey}`);
          return cached as LoyaltyReward[];
        }
      }
      
      // Fetch from database
      const rewards = await this.executeQuery(
        async (db) => {
          return db
            .select()
            .from(loyaltyRewards)
            .where(eq(loyaltyRewards.programId, programId))
            .orderBy(loyaltyRewards.pointCost); // Changed pointsRequired to pointCost
        },
        'loyalty.getRewardsByProgramId'
      );
      
      // Cache the result
      if (this.cache) {
        await this.cache.set(cacheKey, rewards, StandardLoyaltyServicePart2.CACHE_TTL.REWARD);
      }
      
      return rewards;
    } catch (error) {
      return this.handleError(error, `Error fetching loyalty rewards for program ID: ${programId}`);
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
        const memberResult = await trx
          .select()
          .from(loyaltyMembers)
          .where(eq(loyaltyMembers.id, validatedData.memberId))
          .limit(1);
        
        if (!memberResult.length) {
          throw new ServiceError(
            ErrorCode.NOT_FOUND,
            `Loyalty member with ID ${validatedData.memberId} not found`,
            { memberId: validatedData.memberId }
          );
        }
        
        const member = memberResult[0];
        // Get current points balance from the member record
      const pointsBalance = String(member.points || 0);
      const currentPoints = parseFloat(pointsBalance);
      
      // Initialize calculation variables
      let newPoints: number;
      let earnedPoints = 0;  // Track points earned in this transaction
      let redeemedPoints = 0; // Track points redeemed in this transaction
        const updatePoints = parseFloat(String(validatedData.points));
        
        // Calculate new points and update totals based on transaction type
        switch (validatedData.type) {
          case 'earn':
            newPoints = currentPoints + updatePoints;
            earnedPoints = updatePoints;
            break;
            
          case 'redeem':
            // Check if member has enough points
            if (currentPoints < updatePoints) {
              throw new ServiceError(
                ErrorCode.VALIDATION_ERROR, // Using VALIDATION_ERROR as INSUFFICIENT_POINTS doesn't exist
                'Insufficient points for redemption',
                {
                  memberId: validatedData.memberId,
                  currentPoints: pointsBalance,
                  requestedPoints: validatedData.points
                }
              );
            }
            
            newPoints = currentPoints - updatePoints;
            redeemedPoints = updatePoints;
            break;
            
          case 'adjust':
            if (updatePoints > 0) {
              earnedPoints = updatePoints;
              newPoints = currentPoints + updatePoints;
            } else {
              // If negative adjustment, treat as a redemption
              const absPoints = Math.abs(updatePoints);
              
              // Check if member has enough points
              if (currentPoints < absPoints) {
                redeemedPoints = currentPoints;
                newPoints = 0;
              } else {
                redeemedPoints = absPoints;
                newPoints = currentPoints - absPoints;
              }
            }
            break;
            
          case 'expire':
            if (currentPoints < updatePoints) {
              // Cap at current points
              newPoints = 0;
              redeemedPoints = currentPoints;
            } else {
              newPoints = currentPoints - updatePoints;
              redeemedPoints = updatePoints;
            }
            break;
            
          default:
            throw new ServiceError(
              ErrorCode.VALIDATION_ERROR,
              'Invalid transaction type',
              { type: validatedData.type }
            );
        }
        
        // Ensure points are not negative
        if (newPoints < 0) {
          newPoints = 0;
        }
        
        // Create the transaction record
        await trx
          .insert(loyaltyTransactions)
          .values({
            memberId: validatedData.memberId,
            transactionId: validatedData.transactionId,
            type: validatedData.type,
            points: Number(validatedData.points),
            description: validatedData.notes || undefined,
            status: 'completed',
            createdAt: new Date()
          });
        
        // Update member points
        const updatedMemberResult = await trx
          .update(loyaltyMembers)
          .set({
            points: Number(newPoints),
            updatedAt: new Date()
          })
          .where(eq(loyaltyMembers.id, validatedData.memberId))
          .returning();
        
        const updatedMember = updatedMemberResult[0];
        
        if (!updatedMember) {
          throw new ServiceError(
            ErrorCode.DATABASE_ERROR,
            'Failed to update member points',
            { memberId: validatedData.memberId }
          );
        }
        
        // Check if member qualifies for a higher tier
        await this.checkAndUpdateTier(trx, updatedMember);
        
        // Invalidate cache
        if (this.cache) {
          await this.cache.del(`loyalty:member:${validatedData.memberId}`);
          await this.cache.del(`loyalty:member:details:${validatedData.memberId}`);
          await this.cache.invalidatePattern(`loyalty:member:customer:*`);
          await this.cache.invalidatePattern(`loyalty:transactions:*`);
        }
        
        return updatedMember;
      });
    } catch (error) {
      return this.handleError(error, 'Error updating member points');
    }
  }
  
  /**
   * Get member transaction history
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
          return db
            .select()
            .from(loyaltyTransactions)
            .where(eq(loyaltyTransactions.memberId, memberId))
            .orderBy(desc(loyaltyTransactions.createdAt))
            .limit(limit);
        },
        'loyalty.getMemberTransactions'
      );
      
      // Cache the result
      if (this.cache) {
        await this.cache.set(cacheKey, transactions, StandardLoyaltyServicePart2.CACHE_TTL.TRANSACTION);
      }
      
      return transactions;
    } catch (error) {
      return this.handleError(error, `Error fetching loyalty transactions for member ID: ${memberId}`);
    }
  }
  
  /**
   * Check if member qualifies for a higher tier and update if needed
   */
  private async checkAndUpdateTier(trx: any, member: LoyaltyMember): Promise<void> { 
    // member.programId should now be available directly from the LoyaltyMember type
    if (!member.programId) { 
      this.logger.warn(`Cannot check/update tier for member ${member.id} without programId.`);
      return;
    }
    try {
      // Get all tiers for the program
      const tiers = await trx
        .select()
        .from(loyaltyTiers)
        .where(
          and(
            eq(loyaltyTiers.programId, member.programId), 
            eq(loyaltyTiers.status, 'active') 
          )
        )
        .orderBy(loyaltyTiers.pointThreshold); 
      
      if (!tiers.length) {
        return;
      }
      
      const currentMemberPoints = member.points; 
      let highestQualifyingTierId = member.tierId; 
      
      // Find the highest tier the member qualifies for
      for (const tier of tiers) {
        if (currentMemberPoints >= tier.pointThreshold) {
          if (highestQualifyingTierId === null || tier.id > highestQualifyingTierId) {
            highestQualifyingTierId = tier.id;
          }
        }
      }
      
      // If a higher tier is found, update the member
      if (highestQualifyingTierId !== member.tierId) {
        await trx
          .update(loyaltyMembers)
          .set({ tierId: highestQualifyingTierId })
          .where(eq(loyaltyMembers.id, member.id));
          
        this.logger.info('Member tier upgraded', {
          memberId: member.id,
          previousTierId: member.tierId,
          newTierId: highestQualifyingTierId,
          currentPoints: currentMemberPoints 
        });
      }
    } catch (error) {
      this.logger.error('Error checking for tier upgrade', {
        error,
        memberId: member.id
      });
    }
  }
  
  /**
   * Generate member activity report
   */
  async generateMemberActivityReport(memberId: number): Promise<{
    member: LoyaltyMember; // LoyaltyMember should now include programId
    program: LoyaltyProgram;
    tier: LoyaltyTier | null; 
    pointsBalance: string;
    lifetimePoints: string;
    redeemedPoints: string;
    recentTransactions: LoyaltyTransaction[];
    nextTier?: {
      id: number;
      name: string;
      pointsRequired: string;
      pointsToNextTier: string;
    };
  }> {
    try {
      // Get member with details
      const memberDetails = await this.getMemberWithDetails(memberId); 
      
      if (!memberDetails || !memberDetails.programId) { // programId should now be part of LoyaltyMember type
        throw new ServiceError(
          ErrorCode.NOT_FOUND,
          `Loyalty member with ID ${memberId} not found or missing programId.`,
          { memberId }
        );
      }
      
      // Get recent transactions
      const transactions = await this.getMemberTransactions(memberId, 10);
      
      // Get all tiers for the program
      const tiers = await this.getTiersByProgramId(memberDetails.programId); 
      
      // Find the next tier if any
      let nextTierData: { 
        id: number;
        name: string;
        pointsRequired: string; 
        pointsToNextTier: string;
      } | undefined;
      
      const currentMemberPoints = memberDetails.points; 
      const currentTierId = memberDetails.tierId;
      
      for (const tier of tiers) {
        const tierPointThreshold = tier.pointThreshold; 
        if (tierPointThreshold > currentMemberPoints && tier.id !== currentTierId) {
          nextTierData = {
            id: tier.id,
            name: tier.name,
            pointsRequired: String(tierPointThreshold), 
            pointsToNextTier: String(tierPointThreshold - currentMemberPoints)
          };
          break;
        }
      }
      
      // Get the program and current tier
      const programResult = await this.executeQuery( 
        async (db) => {
          return db
            .select()
            .from(loyaltyPrograms)
            .where(eq(loyaltyPrograms.id, memberDetails.programId)) 
            .limit(1);
        },
        'loyalty.getProgram'
      );
      
      let currentTierDetails: LoyaltyTier | null = null; 
      if (memberDetails.tierId !== null && memberDetails.tierId !== undefined) { 
        const tierResult = await this.executeQuery(
          async (db) => {
            return db
              .select()
              .from(loyaltyTiers)
              .where(eq(loyaltyTiers.id, memberDetails.tierId as number)) // tierId is nullable, so cast might still be needed if eq doesn't handle null well
              .limit(1);
          },
          'loyalty.getTier'
        );
        currentTierDetails = tierResult[0] || null;
      }
      
      // Format data for response
      const programForReport = programResult[0];
      if (!programForReport) {
        throw new ServiceError(ErrorCode.NOT_FOUND, `Loyalty program not found for member ${memberId}`);
      }

      return {
        member: memberDetails, // memberDetails is now (LoyaltyMember | (LoyaltyMember & { programId?: number | null })) | null
        program: programForReport,
        tier: currentTierDetails, 
        pointsBalance: String(memberDetails.points || 0),
        lifetimePoints: "0", // Not stored in DB schema, would calculate from transactions
        redeemedPoints: "0", // Not stored in DB schema, would calculate from transactions
        recentTransactions: transactions,
        nextTier: nextTierData // Use the renamed variable
      };
    } catch (error) {
      return this.handleError(error, `Error generating activity report for member ID: ${memberId}`);
    }
  }
  
  /**
   * Override default cache key for loyalty member
   */
  protected getCacheKey(id: string | number): string | null {
    if (!this.cache) return null;
    return `loyalty:member:${id}`;
  }
  
  /**
   * Override default list cache invalidation
   */
  protected async invalidateListCache(): Promise<void> {
    if (!this.cache) return;
    await this.cache.invalidatePattern(`loyalty:member:list:*`);
  }

  // Placeholder for the missing method
  protected async getMemberWithDetails(memberId: number): Promise<LoyaltyMember | null> {
    this.logger.warn(`getMemberWithDetails for member ID ${memberId} is not fully implemented.`);
    // This should fetch the member. Since programId is now part of loyaltyMembers schema,
    // a direct select should include it.
    const memberData = await this.executeQuery(
      async (db) => db.select().from(loyaltyMembers).where(eq(loyaltyMembers.id, memberId)).limit(1),
      'loyalty.getMemberByIdInternal'
    );
    // The fetched memberData[0] should now conform to LoyaltyMember type which includes programId.
    return memberData[0] || null; 
  }
}
