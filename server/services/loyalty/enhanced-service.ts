/**
 * Enhanced Loyalty Service
 *
 * A refactored version of the Loyalty service that uses the enhanced base service
 * and utility abstractions to reduce code duplication and improve type safety.
 */
import { db } from '@server/database';
import { EnhancedBaseService } from '@server/services/base/enhanced-service';
import logger from '@shared/logging';
import * as schema from '@shared/schema';
import { loyaltyValidation, loyaltyMemberSchema } from '@shared/schema-validation'; // Import loyaltyMemberSchema
import { ErrorCode } from '@shared/types/errors';
import { eq, and, or, like, desc, asc, sql } from 'drizzle-orm';
import { z } from 'zod'; // Import z

import {
  LoyaltyProgramFormatter,
  LoyaltyMemberFormatter,
  LoyaltyTransactionFormatter,
} from './formatter';
import { ILoyaltyService } from './types'; // Corrected import path
import {
  CreateLoyaltyProgramParams,
  UpdateLoyaltyProgramParams,
  LoyaltyProgram,
  LoyaltyMember,
  LoyaltyTransaction,
  CreateLoyaltyMemberParams,
  UpdateLoyaltyMemberParams,
  LoyaltyTransactionParams,
  LoyaltyProgramStatus,
  LoyaltyTier, // For Partial<LoyaltyTier>
  LoyaltyReward, // For Partial<LoyaltyReward>
  GetLoyaltyAnalyticsResult,
  // Removed other specific Param/Result types not directly used or covered by ILoyaltyService's inline/Partial types
} from './types';
import { LoyaltyServiceErrors } from './types';

export class EnhancedLoyaltyService extends EnhancedBaseService implements ILoyaltyService {
  private programFormatter: LoyaltyProgramFormatter;
  private memberFormatter: LoyaltyMemberFormatter;
  private transactionFormatter: LoyaltyTransactionFormatter;

  constructor() {
    super({ db, logger }); // Pass db and logger in ServiceConfig
    this.programFormatter = new LoyaltyProgramFormatter();
    this.memberFormatter = new LoyaltyMemberFormatter();
    this.transactionFormatter = new LoyaltyTransactionFormatter();
  }

  /**
   * Generate a unique loyalty ID
   * @param userId User ID
   * @param programId Program ID
   * @returns A unique loyalty ID string
   */
  async generateLoyaltyId(userId: number, programId: number): Promise<string> {
    // Using a simplified version of the old generateMembershipId logic
    const prefix = 'LM';
    const timestamp = Date.now().toString().slice(-6); // Original logic used this
    return `${prefix}${programId}${userId}${timestamp}`; // Original logic
  }

  /**
   * Create a new loyalty program with validated data
   *
   * @param params Loyalty program creation parameters
   * @returns The created loyalty program
   */
  async createLoyaltyProgram(params: CreateLoyaltyProgramParams): Promise<LoyaltyProgram> {
    try {
      // Check if store exists
      const store = await this.getStoreById(params.storeId);
      if (!store) {
        throw LoyaltyServiceErrors.STORE_NOT_FOUND;
      }

      // Check for existing active program for this store
      const existingProgram = await this.getLoyaltyProgramByStore(params.storeId);
      if (existingProgram && existingProgram.status === 'active') {
        // Compare with string literal
        return this.updateLoyaltyProgram(existingProgram.id, params);
      }

      // Prepare program data
      const programData = {
        ...params,
        status: params.status || 'active', // Use string literal
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      };

      // Validate and prepare the data
      const validatedData = loyaltyValidation.program.insert(programData);

      // Use the raw insert method to avoid TypeScript field mapping errors
      const program = await this.rawInsertWithFormatting(
        'loyalty_programs',
        validatedData,
        this.programFormatter.formatResult.bind(this.programFormatter)
      );

      // Ensure the program was created
      return this.ensureExists(program, 'Loyalty Program');
    } catch (error: unknown) {
      return this.handleError(error, 'creating loyalty program');
    }
  }

  /**
   * Update a loyalty program with validated data
   *
   * @param programId ID of the program to update
   * @param params Loyalty program update parameters
   * @returns The updated loyalty program
   */
  async updateLoyaltyProgram(
    programId: number,
    params: UpdateLoyaltyProgramParams
  ): Promise<LoyaltyProgram> {
    try {
      // Get existing program
      const existingProgram = await this.getLoyaltyProgramById(programId);
      if (!existingProgram) {
        throw LoyaltyServiceErrors.PROGRAM_NOT_FOUND;
      }

      // Prepare update data with proper field names
      const updateData = {
        ...params,
        metadata: params.metadata ? JSON.stringify(params.metadata) : existingProgram.metadata,
        updatedAt: new Date(),
      };

      // Validate the data
      const validatedData = loyaltyValidation.program.update(updateData);

      // Use the raw update method to avoid TypeScript field mapping errors
      const updatedProgram = await this.rawUpdateWithFormatting(
        'loyalty_programs',
        validatedData,
        `id = ${programId}`,
        this.programFormatter.formatResult.bind(this.programFormatter)
      );

      // Ensure the program was updated
      return this.ensureExists(updatedProgram, 'Loyalty Program');
    } catch (error: unknown) {
      return this.handleError(error, 'updating loyalty program');
    }
  }

  /**
   * Get a loyalty program by ID
   *
   * @param programId ID of the program to retrieve
   * @returns The loyalty program or null if not found
   */
  async getLoyaltyProgramById(programId: number): Promise<LoyaltyProgram | null> {
    try {
      // Create a simple query to fetch the program
      const query = `
        SELECT * FROM loyalty_programs WHERE id = ${programId}
      `;

      // Execute the query and format the result
      return await this.executeSqlWithFormatting(
        query,
        [],
        this.programFormatter.formatResult.bind(this.programFormatter)
      );
    } catch (error: unknown) {
      return this.handleError(error, 'getting loyalty program by ID');
    }
  }

  /**
   * Get the active loyalty program for a store
   *
   * @param storeId ID of the store
   * @returns The active loyalty program or null if not found
   */
  async getLoyaltyProgramByStore(storeId: number): Promise<LoyaltyProgram | null> {
    try {
      // Create a query to fetch the active program
      const query = `
        SELECT * FROM loyalty_programs 
        WHERE store_id = ${storeId} 
        AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
      `;

      // Execute the query and format the result
      return await this.executeSqlWithFormatting(
        query,
        [],
        this.programFormatter.formatResult.bind(this.programFormatter)
      );
    } catch (error: unknown) {
      return this.handleError(error, 'getting loyalty program by store');
    }
  }

  /**
   * Create a new loyalty member with validated data
   *
   * @param params Loyalty member creation parameters
   * @returns The created loyalty member
   */
  async createLoyaltyMember(params: CreateLoyaltyMemberParams): Promise<LoyaltyMember> {
    try {
      // Check if program exists
      const program = await this.getLoyaltyProgramById(params.programId);
      if (!program) {
        throw LoyaltyServiceErrors.PROGRAM_NOT_FOUND;
      }

      // Check if user exists
      const user = await this.getUserById(params.userId);
      if (!user) {
        throw LoyaltyServiceErrors.USER_NOT_FOUND;
      }

      // Check for existing member
      const existingMember = await this.getLoyaltyMemberByUser(params.programId, params.userId);
      if (existingMember) {
        return this.updateLoyaltyMember(existingMember.id, {
          ...params,
          status: 'active', // Changed from isActive: true
        });
      }

      // Generate membership ID if not provided
      const loyaltyId =
        params.loyaltyId ||
        params.membershipId ||
        (await this.generateLoyaltyId(params.userId, params.programId));

      // Prepare member data for validation, aligning with loyaltyMemberSchema (from schema-validation.ts)
      // This schema is derived from the Drizzle loyaltyMembers table.
      const memberDataForValidation: z.input<typeof loyaltyMemberSchema> = {
        programId: params.programId, // Added programId
        customerId: params.customerId,
        loyaltyId: loyaltyId, // This is validated by loyaltyMemberSchema's override
        points: Number(params.points || 0), // DB expects number, Zod schema should align or transform
        tierId: params.tierId || (params.tierLevel ? Number(params.tierLevel) : null), // DB expects number | null
        status: params.status || 'active', // DB expects string, e.g., 'active'
        // joinDate, createdAt, updatedAt are typically handled by DB defaults or ORM.
        // isActive, enrolledBy are not part of loyaltyMembers table schema.
      };
      // Note: If params.metadata is used, loyaltyMemberSchema and the DB table need to support it.
      // Currently, loyaltyMembers table does not have a metadata column.

      // Validate data against loyaltyMemberSchema
      const validatedDataForDbInsert = loyaltyValidation.member.insert(memberDataForValidation);
      // validatedDataForDbInsert should now conform to the structure expected by the loyalty_members table,
      // as loyaltyMemberSchema is derived from it.

      // Use the raw insert method with the validated data
      const member = await this.rawInsertWithFormatting(
        'loyalty_members',
        validatedDataForDbInsert, // Use the data validated against DB-derived schema
        this.memberFormatter.formatResult.bind(this.memberFormatter)
      );

      // Ensure the member was created
      return this.ensureExists(member, 'Loyalty Member');
    } catch (error: unknown) {
      return this.handleError(error, 'creating loyalty member');
    }
  }

  /**
   * Update a loyalty member with validated data
   *
   * @param memberId ID of the member to update
   * @param params Loyalty member update parameters
   * @returns The updated loyalty member
   */
  async updateLoyaltyMember(
    memberId: number,
    params: UpdateLoyaltyMemberParams
  ): Promise<LoyaltyMember> {
    try {
      // Get existing member
      const existingMember = await this.getLoyaltyMemberById(memberId);
      if (!existingMember) {
        throw LoyaltyServiceErrors.MEMBER_NOT_FOUND;
      }

      // Prepare update data with proper field names
      const updateData = {
        ...params,
        lastActivityDate: new Date(),
        updatedAt: new Date(),
        metadata: params.metadata ? JSON.stringify(params.metadata) : existingMember.metadata,
      };

      // Validate the data
      const validatedData = loyaltyValidation.member.update(updateData);

      // Use the raw update method to avoid TypeScript field mapping errors
      const updatedMember = await this.rawUpdateWithFormatting(
        'loyalty_members',
        validatedData,
        `id = ${memberId}`,
        this.memberFormatter.formatResult.bind(this.memberFormatter)
      );

      // Ensure the member was updated
      return this.ensureExists(updatedMember, 'Loyalty Member');
    } catch (error: unknown) {
      return this.handleError(error, 'updating loyalty member');
    }
  }

  /**
   * Get a loyalty member by ID
   *
   * @param memberId ID of the member to retrieve
   * @returns The loyalty member or null if not found
   */
  async getLoyaltyMemberById(memberId: number): Promise<LoyaltyMember | null> {
    try {
      // Create a simple query to fetch the member
      const query = `
        SELECT * FROM loyalty_members WHERE id = ${memberId}
      `;

      // Execute the query and format the result
      return await this.executeSqlWithFormatting(
        query,
        [],
        this.memberFormatter.formatResult.bind(this.memberFormatter)
      );
    } catch (error: unknown) {
      return this.handleError(error, 'getting loyalty member by ID');
    }
  }

  /**
   * Get a loyalty member by user ID and program ID
   *
   * @param programId ID of the loyalty program
   * @param userId ID of the user
   * @returns The loyalty member or null if not found
   */
  async getLoyaltyMemberByUser(programId: number, userId: number): Promise<LoyaltyMember | null> {
    try {
      // Create a query to fetch the member
      const query = `
        SELECT * FROM loyalty_members 
        WHERE program_id = ${programId} 
        AND user_id = ${userId}
        LIMIT 1
      `;

      // Execute the query and format the result
      return await this.executeSqlWithFormatting(
        query,
        [],
        this.memberFormatter.formatResult.bind(this.memberFormatter)
      );
    } catch (error: unknown) {
      return this.handleError(error, 'getting loyalty member by user');
    }
  }

  /**
   * Create a loyalty transaction for a member
   *
   * @param params Loyalty transaction parameters
   * @returns The created loyalty transaction
   */
  async createLoyaltyTransaction(params: LoyaltyTransactionParams): Promise<LoyaltyTransaction> {
    try {
      // Get member and program
      const member = await this.getLoyaltyMemberById(params.memberId);
      if (!member) {
        throw LoyaltyServiceErrors.MEMBER_NOT_FOUND;
      }

      const program = await this.getLoyaltyProgramById(member.programId);
      if (!program) {
        throw LoyaltyServiceErrors.PROGRAM_NOT_FOUND;
      }

      // Calculate points change based on transaction type
      let pointsChange = 0;
      let lifetimePointsIncrement = 0;

      if (params.type === 'earn') {
        pointsChange = Number(params.points);
        lifetimePointsIncrement = Number(params.points);
      } else if (params.type === 'redeem') {
        pointsChange = -Number(params.points);
      } else if (params.type === 'adjust') {
        pointsChange = Number(params.points);
        // Adjustments might affect lifetime points if they are positive earnings
        if (Number(params.points) > 0) {
          lifetimePointsIncrement = Number(params.points);
        }
      }

      const newPointsBalance = member.points + pointsChange;

      if (newPointsBalance < 0) {
        throw LoyaltyServiceErrors.INSUFFICIENT_POINTS;
      }

      // Update member points
      await this.updateLoyaltyMember(member.id, {
        points: newPointsBalance,
        lifetimePoints: member.lifetimePoints + lifetimePointsIncrement,
      });

      // Prepare transaction data according to transactionCreateSchema
      const transactionDataToValidate = {
        memberId: params.memberId,
        programId: member.programId, // Derived from member
        transactionId: params.transactionId || null,
        rewardId: params.rewardId || null,
        type: params.type, // This is from LoyaltyTransactionParams
        points: String(params.points), // This is from LoyaltyTransactionParams, schema expects string
        userId: params.userId, // User performing the action
        notes: params.notes || null,
        // metadata is not in transactionCreateSchema
      };

      // Validate and prepare the data
      const validatedData = loyaltyValidation.transaction.insert(transactionDataToValidate);

      // Use the raw insert method to avoid TypeScript field mapping errors
      const transaction = await this.rawInsertWithFormatting(
        'loyalty_transactions',
        validatedData,
        this.transactionFormatter.formatResult.bind(this.transactionFormatter)
      );

      // Ensure the transaction was created
      return this.ensureExists(transaction, 'Loyalty Transaction');
    } catch (error: unknown) {
      return this.handleError(error, 'creating loyalty transaction');
    }
  }

  /**
   * Get a loyalty transaction by ID
   *
   * @param transactionId ID of the transaction to retrieve
   * @returns The loyalty transaction or null if not found
   */
  async getLoyaltyTransactionById(transactionId: number): Promise<LoyaltyTransaction | null> {
    try {
      // Create a simple query to fetch the transaction
      const query = `
        SELECT * FROM loyalty_transactions WHERE id = ${transactionId}
      `;

      // Execute the query and format the result
      return await this.executeSqlWithFormatting(
        query,
        [],
        this.transactionFormatter.formatResult.bind(this.transactionFormatter)
      );
    } catch (error: unknown) {
      return this.handleError(error, 'getting loyalty transaction by ID');
    }
  }

  /**
   * Get all loyalty transactions for a member
   *
   * @param memberId ID of the loyalty member
   * @returns Array of loyalty transactions
   */
  async getLoyaltyTransactionsByMember(memberId: number): Promise<LoyaltyTransaction[]> {
    try {
      // Create a query to fetch the transactions
      const query = `
        SELECT * FROM loyalty_transactions 
        WHERE member_id = ${memberId}
        ORDER BY transaction_date DESC
      `;

      // Execute the query and format the results
      return await this.executeSqlWithMultipleResults(
        query,
        [],
        this.transactionFormatter.formatResult.bind(this.transactionFormatter)
      );
    } catch (error: unknown) {
      return this.handleError(error, 'getting loyalty transactions by member');
    }
  }

  /**
   * Helper method to get a store by ID
   *
   * @param storeId ID of the store
   * @returns The store or null if not found
   */
  private async getStoreById(storeId: number): Promise<any> {
    try {
      const result = await db.execute(
        sql.raw(`SELECT * FROM stores WHERE id = ${storeId} LIMIT 1`)
      );

      return result.rows?.[0] || null;
    } catch (error: unknown) {
      return null;
    }
  }

  /**
   * Helper method to get a user by ID
   *
   * @param userId ID of the user
   * @returns The user or null if not found
   */
  private async getUserById(userId: number): Promise<any> {
    try {
      const result = await db.execute(sql.raw(`SELECT * FROM users WHERE id = ${userId} LIMIT 1`));

      return result.rows?.[0] || null;
    } catch (error: unknown) {
      return null;
    }
  }

  /**
   * Generate a unique membership ID
   *
   * @param userId User ID
   * @param programId Program ID
   * @returns Unique membership ID
   */
  // This was the original private method, now made public and renamed to generateLoyaltyId
  // private generateMembershipId(userId: number, programId: number): string {
  //   const prefix = 'LM';
  //   const timestamp = Date.now().toString().slice(-6);
  //   return `${prefix}${programId}${userId}${timestamp}`;
  // }

  // Stubs for missing ILoyaltyService methods

  async enrollCustomer(
    customerId: number,
    storeId: number,
    userId: number
  ): Promise<LoyaltyMember> {
    // TODO: Implement actual logic
    // This might involve finding or creating a program for the store, then creating a member
    this.logger.info(
      `Attempting to enroll customer ${customerId} for store ${storeId} by user ${userId}`
    );
    const program = await this.getLoyaltyProgramByStore(storeId);
    if (!program) {
      throw LoyaltyServiceErrors.PROGRAM_NOT_FOUND;
    }
    return this.createLoyaltyMember({
      customerId,
      programId: program.id,
      userId,
      enrolledBy: userId,
    });
  }

  async calculatePointsForTransaction(
    subtotal: string | number,
    storeId: number,
    items: Array<{ productId: number; quantity: number; unitPrice: number | string }>
  ): Promise<number> {
    // TODO: Implement actual logic based on program rules
    this.logger.info(`Calculating points for transaction in store ${storeId}`);
    const program = await this.getLoyaltyProgramByStore(storeId);
    if (!program || program.status !== 'active') {
      return 0;
    }
    // Example: 1 point per dollar, consult program.metadata for actual rules
    const numericSubtotal = typeof subtotal === 'string' ? parseFloat(subtotal) : subtotal;
    const pointsPerDollar = (program.metadata?.pointsPerDollar as number) || 1;
    return Math.floor(numericSubtotal * pointsPerDollar);
  }

  async recordPointsEarned(
    transactionId: number,
    memberId: number,
    points: number,
    userId: number
  ): Promise<{ success: boolean; transaction?: LoyaltyTransaction }> {
    // TODO: Implement actual logic
    this.logger.info(
      `Recording ${points} points for member ${memberId}, transaction ${transactionId}`
    );
    try {
      const member = await this.getLoyaltyMemberById(memberId);
      if (!member) throw LoyaltyServiceErrors.MEMBER_NOT_FOUND;

      const loyaltyTx = await this.createLoyaltyTransaction({
        memberId,
        programId: member.programId, // Pass programId explicitly
        transactionId, // Pass transactionId if available
        points: points,
        type: 'earn',
        userId,
        notes: `Earned ${points} points from transaction ${transactionId}`,
        // Other fields from LoyaltyTransactionParams like rewardId, metadata can be added if needed
      });
      return { success: true, transaction: loyaltyTx };
    } catch (error) {
      this.logger.error('Failed to record points earned', { error, memberId, transactionId });
      return { success: false };
    }
  }

  async getAvailableRewards(memberId: number): Promise<LoyaltyReward[]> {
    // TODO: Implement actual logic based on member's points and program rewards
    this.logger.info(`Fetching available rewards for member ${memberId}`);
    const member = await this.getLoyaltyMemberById(memberId);
    if (!member) return [];
    // Example: Fetch all active rewards for the program, then filter by points
    // This requires a method to get rewards by programId
    // For now, returning empty array
    return [];
  }

  async applyReward(
    memberId: number,
    rewardId: number,
    transactionId: number,
    userId: number
  ): Promise<{
    success: boolean;
    discountAmount?: string;
    pointsRedeemed?: string;
    message?: string;
  }> {
    // TODO: Implement actual logic
    this.logger.info(`Applying reward ${rewardId} for member ${memberId}`);
    // This would involve:
    // 1. Fetching member and reward details.
    // 2. Checking if member has enough points.
    // 3. Creating a 'redeem' loyalty transaction.
    // 4. Updating member's points.
    // 5. Returning discount details.
    return { success: false, message: 'Not implemented' };
  }

  async getLoyaltyMember(identifier: string | number): Promise<LoyaltyMember | null> {
    if (typeof identifier === 'number') {
      return this.getLoyaltyMemberById(identifier);
    }
    // If string, assume it's loyaltyId
    // TODO: Implement lookup by loyaltyId string
    this.logger.info(`Fetching loyalty member by identifier ${identifier}`);
    const query = `SELECT * FROM loyalty_members WHERE loyalty_id = '${identifier}' LIMIT 1`;
    return await this.executeSqlWithFormatting(
      query,
      [],
      this.memberFormatter.formatResult.bind(this.memberFormatter)
    );
  }

  async getLoyaltyMemberByCustomerId(customerId: number): Promise<LoyaltyMember | null> {
    // This might need to iterate through programs if a customer can be in multiple,
    // or assume one program per store and customer is linked via store.
    // For now, assuming a simpler lookup or that getLoyaltyMemberByUser can be adapted.
    this.logger.info(`Fetching loyalty member by customer ID ${customerId}`);
    const query = `SELECT * FROM loyalty_members WHERE customer_id = ${customerId} LIMIT 1`;
    return await this.executeSqlWithFormatting(
      query,
      [],
      this.memberFormatter.formatResult.bind(this.memberFormatter)
    );
  }

  async getMemberActivityHistory(
    memberId: number,
    limit?: number,
    offset?: number
  ): Promise<LoyaltyTransaction[]> {
    this.logger.info(`Fetching activity history for member ${memberId}`);
    let query = `SELECT * FROM loyalty_transactions WHERE member_id = ${memberId} ORDER BY created_at DESC`;
    if (limit) query += ` LIMIT ${limit}`;
    if (offset) query += ` OFFSET ${offset}`;

    return await this.executeSqlWithMultipleResults(
      query,
      [],
      this.transactionFormatter.formatResult.bind(this.transactionFormatter)
    );
  }

  async getLoyaltyProgram(storeId: number): Promise<LoyaltyProgram | null> {
    return this.getLoyaltyProgramByStore(storeId);
  }

  async upsertLoyaltyProgram(
    storeId: number,
    programData: Partial<LoyaltyProgram>
  ): Promise<LoyaltyProgram> {
    const existingProgram = await this.getLoyaltyProgramByStore(storeId);
    if (existingProgram) {
      return this.updateLoyaltyProgram(existingProgram.id, programData);
    } else {
      // Ensure all required fields for creation are present
      if (!programData.name) throw new Error('Program name is required for creation.');
      return this.createLoyaltyProgram({
        storeId,
        name: programData.name,
        description: programData.description,
        status: programData.status || 'active',
        metadata: programData.metadata,
      });
    }
  }

  async createLoyaltyTier(tierData: Partial<LoyaltyTier>): Promise<LoyaltyTier> {
    // TODO: Implement actual logic
    this.logger.info('Creating loyalty tier', { tierData });
    throw new Error('createLoyaltyTier not implemented.');
  }

  async createLoyaltyReward(rewardData: Partial<LoyaltyReward>): Promise<LoyaltyReward> {
    // TODO: Implement actual logic
    this.logger.info('Creating loyalty reward', { rewardData });
    throw new Error('createLoyaltyReward not implemented.');
  }

  async processExpiredPoints(userId: number): Promise<number> {
    // TODO: Implement actual logic
    this.logger.info(`Processing expired points for user ${userId}`);
    return 0; // Placeholder
  }

  async checkAndUpdateMemberTier(memberId: number): Promise<boolean> {
    // TODO: Implement actual logic
    this.logger.info(`Checking and updating tier for member ${memberId}`);
    return false; // Placeholder
  }

  async getLoyaltyAnalytics(storeId: number): Promise<GetLoyaltyAnalyticsResult> {
    // TODO: Implement actual logic
    this.logger.info(`Fetching loyalty analytics for store ${storeId}`);
    // Placeholder structure
    return {
      memberCount: 0,
      activeMembers: 0,
      totalPointsEarned: '0',
      totalPointsRedeemed: '0',
      pointsBalance: '0',
      programDetails: null,
      topRewards: [],
    };
  }
}
