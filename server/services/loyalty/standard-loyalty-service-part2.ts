/**
 * Standardized Loyalty Service - Part 2
 * 
 * Continuing the implementation with additional methods
 */

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
            .orderBy(loyaltyTiers.pointsRequired);
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
      const result = await this.executeQuery(
        async (db) => {
          return db.insert(loyaltyRewards).values({
            ...validatedData,
            createdAt: new Date()
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
            .orderBy(loyaltyRewards.pointsRequired);
        },
        'loyalty.getRewardsByProgramId'
      );
      
      // Cache the result
      if (this.cache) {
        await this.cache.set(cacheKey, rewards, this.CACHE_TTL.REWARD);
      }
      
      return rewards;
    } catch (error) {
      return this.handleError(error, `Error fetching loyalty rewards for program ID: ${programId}`);
    }
  }
  
  /**
   * Update member points
   */
  async updatePoints(params: PointsUpdateParams): Promise<LoyaltyMember> {
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
        let newPoints: number;
        let totalPointsEarned = parseFloat(member.totalPointsEarned);
        let totalPointsRedeemed = parseFloat(member.totalPointsRedeemed);
        const currentPoints = parseFloat(member.currentPoints);
        const updatePoints = parseFloat(String(validatedData.points));
        
        // Calculate new points and update totals based on transaction type
        switch (validatedData.type) {
          case 'earn':
            newPoints = currentPoints + updatePoints;
            totalPointsEarned += updatePoints;
            break;
          case 'redeem':
            if (currentPoints < updatePoints) {
              throw new ServiceError(
                ErrorCode.VALIDATION_ERROR,
                'Insufficient points for redemption',
                {
                  memberId: validatedData.memberId,
                  currentPoints: member.currentPoints,
                  requestedPoints: validatedData.points
                }
              );
            }
            newPoints = currentPoints - updatePoints;
            totalPointsRedeemed += updatePoints;
            break;
          case 'adjust':
            newPoints = currentPoints + updatePoints; // Can be negative for deductions
            if (updatePoints > 0) {
              totalPointsEarned += updatePoints;
            } else if (updatePoints < 0) {
              // We don't add to redeemed for adjustments
            }
            break;
          case 'expire':
            if (currentPoints < updatePoints) {
              // Cap at current points
              newPoints = 0;
              totalPointsRedeemed += currentPoints;
            } else {
              newPoints = currentPoints - updatePoints;
              totalPointsRedeemed += updatePoints;
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
            points: String(validatedData.points),
            note: validatedData.note,
            createdBy: validatedData.createdBy,
            createdAt: new Date()
          });
        
        // Update member points
        const updatedMemberResult = await trx
          .update(loyaltyMembers)
          .set({
            currentPoints: String(newPoints),
            totalPointsEarned: String(totalPointsEarned),
            totalPointsRedeemed: String(totalPointsRedeemed),
            lastActivity: new Date()
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
        await this.cache.set(cacheKey, transactions, this.CACHE_TTL.TRANSACTION);
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
    try {
      // Get all tiers for the program
      const tiers = await trx
        .select()
        .from(loyaltyTiers)
        .where(
          and(
            eq(loyaltyTiers.programId, member.programId),
            eq(loyaltyTiers.active, true)
          )
        )
        .orderBy(loyaltyTiers.pointsRequired);
      
      if (!tiers.length) {
        return;
      }
      
      const currentPoints = parseFloat(member.currentPoints);
      let highestQualifyingTier = member.tierId;
      
      // Find the highest tier the member qualifies for
      for (const tier of tiers) {
        const pointsRequired = parseFloat(tier.pointsRequired);
        if (currentPoints >= pointsRequired && tier.id > highestQualifyingTier) {
          highestQualifyingTier = tier.id;
        }
      }
      
      // If a higher tier is found, update the member
      if (highestQualifyingTier !== member.tierId) {
        await trx
          .update(loyaltyMembers)
          .set({ tierId: highestQualifyingTier })
          .where(eq(loyaltyMembers.id, member.id));
          
        this.logger.info('Member tier upgraded', {
          memberId: member.id,
          previousTierId: member.tierId,
          newTierId: highestQualifyingTier,
          currentPoints: member.currentPoints
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
    member: LoyaltyMember;
    program: LoyaltyProgram;
    tier: LoyaltyTier;
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
      
      if (!memberDetails) {
        throw new ServiceError(
          ErrorCode.NOT_FOUND,
          `Loyalty member with ID ${memberId} not found`,
          { memberId }
        );
      }
      
      // Get recent transactions
      const transactions = await this.getMemberTransactions(memberId, 10);
      
      // Get all tiers for the program
      const tiers = await this.getTiersByProgramId(memberDetails.programId);
      
      // Find the next tier if any
      let nextTier: {
        id: number;
        name: string;
        pointsRequired: string;
        pointsToNextTier: string;
      } | undefined;
      
      const currentPoints = parseFloat(memberDetails.currentPoints);
      const currentTierId = memberDetails.tierId;
      
      for (const tier of tiers) {
        const pointsRequired = parseFloat(tier.pointsRequired);
        if (pointsRequired > currentPoints && tier.id !== currentTierId) {
          nextTier = {
            id: tier.id,
            name: tier.name,
            pointsRequired: tier.pointsRequired,
            pointsToNextTier: String(pointsRequired - currentPoints)
          };
          break;
        }
      }
      
      // Get the program and current tier
      const program = await this.executeQuery(
        async (db) => {
          return db
            .select()
            .from(loyaltyPrograms)
            .where(eq(loyaltyPrograms.id, memberDetails.programId))
            .limit(1);
        },
        'loyalty.getProgram'
      );
      
      const tier = await this.executeQuery(
        async (db) => {
          return db
            .select()
            .from(loyaltyTiers)
            .where(eq(loyaltyTiers.id, memberDetails.tierId))
            .limit(1);
        },
        'loyalty.getTier'
      );
      
      return {
        member: memberDetails,
        program: program[0],
        tier: tier[0],
        pointsBalance: memberDetails.currentPoints,
        lifetimePoints: memberDetails.totalPointsEarned,
        redeemedPoints: memberDetails.totalPointsRedeemed,
        recentTransactions: transactions,
        nextTier
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
