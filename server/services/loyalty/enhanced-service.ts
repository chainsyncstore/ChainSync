/**
 * Enhanced Loyalty Service
 * 
 * A refactored version of the Loyalty service that uses the enhanced base service
 * and utility abstractions to reduce code duplication and improve type safety.
 */
import { EnhancedBaseService } from '@server/services/base/enhanced-service';
import { 
  LoyaltyProgramFormatter, 
  LoyaltyMemberFormatter, 
  LoyaltyTransactionFormatter 
} from './formatter';
import { loyaltyValidation } from '@shared/schema-validation';
import { ILoyaltyService } from './interface';
import { 
  CreateLoyaltyProgramParams, 
  UpdateLoyaltyProgramParams,
  LoyaltyProgram,
  LoyaltyMember,
  LoyaltyTransaction,
  CreateLoyaltyMemberParams,
  UpdateLoyaltyMemberParams,
  LoyaltyTransactionParams,
  LoyaltyProgramStatus
} from './types';
import { LoyaltyServiceErrors } from './errors';
import { ErrorCode } from '@shared/types/errors';
import { db } from '@server/db';
import { eq, and, or, like, desc, asc, sql } from 'drizzle-orm';
import * as schema from '@shared/schema';

export class EnhancedLoyaltyService extends EnhancedBaseService implements ILoyaltyService {
  private programFormatter: LoyaltyProgramFormatter;
  private memberFormatter: LoyaltyMemberFormatter;
  private transactionFormatter: LoyaltyTransactionFormatter;
  
  constructor() {
    super();
    this.programFormatter = new LoyaltyProgramFormatter();
    this.memberFormatter = new LoyaltyMemberFormatter();
    this.transactionFormatter = new LoyaltyTransactionFormatter();
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
      if (existingProgram && existingProgram.status === LoyaltyProgramStatus.ACTIVE) {
        return this.updateLoyaltyProgram(existingProgram.id, params);
      }
      
      // Prepare program data
      const programData = {
        ...params,
        status: params.status || LoyaltyProgramStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: params.metadata ? JSON.stringify(params.metadata) : null
      };
      
      // Validate and prepare the data
      const validatedData = loyaltyValidation.programInsert(programData);
      
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
  async updateLoyaltyProgram(programId: number, params: UpdateLoyaltyProgramParams): Promise<LoyaltyProgram> {
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
        updatedAt: new Date()
      };
      
      // Validate the data
      const validatedData = loyaltyValidation.programUpdate(updateData);
      
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
          isActive: true
        });
      }
      
      // Generate membership ID if not provided
      const membershipId = params.membershipId || this.generateMembershipId(params.userId, params.programId);
      
      // Prepare member data
      const memberData = {
        ...params,
        membershipId,
        points: params.points || 0,
        tierLevel: params.tierLevel || 1,
        totalSpent: params.totalSpent || '0.00',
        lifetimePoints: params.lifetimePoints || 0,
        isActive: true,
        enrollmentDate: new Date(),
        lastActivityDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: params.metadata ? JSON.stringify(params.metadata) : null
      };
      
      // Validate and prepare the data
      const validatedData = loyaltyValidation.memberInsert(memberData);
      
      // Use the raw insert method to avoid TypeScript field mapping errors
      const member = await this.rawInsertWithFormatting(
        'loyalty_members',
        validatedData,
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
  async updateLoyaltyMember(memberId: number, params: UpdateLoyaltyMemberParams): Promise<LoyaltyMember> {
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
        metadata: params.metadata ? JSON.stringify(params.metadata) : existingMember.metadata
      };
      
      // Validate the data
      const validatedData = loyaltyValidation.memberUpdate(updateData);
      
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
      
      // Calculate new points balance
      const pointsEarned = params.pointsEarned || 0;
      const pointsRedeemed = params.pointsRedeemed || 0;
      const newPointsBalance = member.points + pointsEarned - pointsRedeemed;
      
      if (newPointsBalance < 0) {
        throw LoyaltyServiceErrors.INSUFFICIENT_POINTS;
      }
      
      // Update member points
      await this.updateLoyaltyMember(member.id, {
        points: newPointsBalance,
        lifetimePoints: member.lifetimePoints + pointsEarned
      });
      
      // Prepare transaction data
      const transactionData = {
        memberId: params.memberId,
        programId: member.programId,
        pointsEarned,
        pointsRedeemed,
        pointsBalance: newPointsBalance,
        transactionType: params.transactionType || 'earn',
        referenceId: params.referenceId,
        description: params.description || '',
        amount: params.amount || '0.00',
        transactionDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: params.metadata ? JSON.stringify(params.metadata) : null
      };
      
      // Validate and prepare the data
      const validatedData = loyaltyValidation.transactionInsert(transactionData);
      
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
      const result = await db.execute(
        sql.raw(`SELECT * FROM users WHERE id = ${userId} LIMIT 1`)
      );
      
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
  private generateMembershipId(userId: number, programId: number): string {
    const prefix = 'LM';
    const timestamp = Date.now().toString().slice(-6);
    return `${prefix}${programId}${userId}${timestamp}`;
  }
}
