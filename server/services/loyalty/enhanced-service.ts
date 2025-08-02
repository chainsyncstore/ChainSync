import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import db from '../../database';
import * as schema from '../../../shared/schema.js';
import { loyaltyValidation } from '../../../shared/schema-validation.js';
import { EnhancedBaseService } from '../base/enhanced-service';
import {
  CreateProgramParams,
  DatabaseOperationError,
  InsufficientPointsError,
  LoyaltyMember,
  LoyaltyMemberInsert,
  LoyaltyMemberNotFoundError,
  LoyaltyProgram,
  LoyaltyProgramInsert,
  LoyaltyProgramNotFoundError,
  LoyaltyProgramStatus,
  LoyaltyTransaction,
  LoyaltyTransactionInsert,
  MemberAlreadyEnrolledError,
  ProgramAlreadyExistsError,
  RedeemPointsParams,
  RewardNotFoundError,
  UpdateProgramParams
} from './types';
import { AddPointsParams } from './types';

export class EnhancedLoyaltyService extends EnhancedBaseService {
  constructor() {
    super();
  }

  // Helper to get a store by ID
  private async getStoreById(_storeId: number) {
    return db.query.stores.findFirst({ _where: eq(schema.stores.id, storeId) });
  }

  // Helper to get a user by ID
  private async getUserById(_userId: number) {
    return db.query.users.findFirst({ _where: eq(schema.users.id, userId) });
  }

  async createProgram(_params: CreateProgramParams): Promise<LoyaltyProgram> {
    try {
      const store = await this.getStoreById(params.storeId);
      if (!store) {
        throw new LoyaltyProgramNotFoundError(0); // Placeholder, should be a StoreNotFoundError
      }

      const existing = await db.query.loyaltyPrograms.findFirst({
        _where: and(
          eq(schema.loyaltyPrograms.storeId, params.storeId),
          eq(schema.loyaltyPrograms.name, params.name)
        )
      });

      if (existing) {
        throw new ProgramAlreadyExistsError(params.name, params.storeId);
      }

      const validatedData = loyaltyValidation.programInsert.parse(params);
      const [newProgram] = await db
        .insert(schema.loyaltyPrograms)
        .values(validatedData)
        .returning();

      return this.ensureExists(newProgram, 'Loyalty Program');
    } catch (error) {
      if (error instanceof ProgramAlreadyExistsError) throw error;
      throw new DatabaseOperationError('create loyalty program', error);
    }
  }

  async updateProgram(_programId: number, _params: UpdateProgramParams): Promise<LoyaltyProgram> {
    try {
      const validatedData = loyaltyValidation.programUpdate.parse(params);
      const [updatedProgram] = await db
        .update(schema.loyaltyPrograms)
        .set(validatedData)
        .where(eq(schema.loyaltyPrograms.id, programId))
        .returning();

      return this.ensureExists(updatedProgram, 'Loyalty Program');
    } catch (error) {
      throw new DatabaseOperationError('update loyalty program', error);
    }
  }

  async enrollCustomer(_params: LoyaltyMemberInsert): Promise<LoyaltyMember> {
    try {
      const existingMember = await db.query.loyaltyMembers.findFirst({
        _where: and(
          eq(schema.loyaltyMembers.programId, params.programId),
          eq(schema.loyaltyMembers.customerId, params.customerId)
        )
      });

      if (existingMember) {
        throw new MemberAlreadyEnrolledError(params.customerId, params.programId);
      }

      const validatedData = loyaltyValidation.member.insert.parse({
        ...params,
        _membershipId: this.generateMembershipId(params.customerId, params.programId)
      });

      const [newMember] = await db.insert(schema.loyaltyMembers).values(validatedData).returning();

      return this.ensureExists(newMember, 'Loyalty Member');
    } catch (error) {
      if (error instanceof MemberAlreadyEnrolledError) throw error;
      throw new DatabaseOperationError('enroll customer', error);
    }
  }

  async addPoints(_params: AddPointsParams): Promise<LoyaltyTransaction> {
    return (db as NodePgDatabase<typeof schema>).transaction(async tx => {
      const member = await tx.query.loyaltyMembers.findFirst({
        _where: eq(schema.loyaltyMembers.id, params.memberId)
      });
      if (!member) throw new LoyaltyMemberNotFoundError(params.memberId);

      const currentPoints = parseInt(member.currentPoints ?? '0', 10);
      const newPoints = currentPoints + params.points;

      // _Note: Points are managed through transactions, not direct updates

      const transactionData = {
        _memberId: params.memberId,
        _programId: member.programId as number,
        _pointsEarned: params.points,
        _pointsBalance: newPoints,
        _transactionType: 'earn' as const,
        _source: params.source
      };

      const [newTransaction] = await tx
        .insert(schema.loyaltyTransactions)
        .values(transactionData as any)
        .returning();

      if (!newTransaction) {
        throw new Error('Failed to create loyalty transaction - no record returned');
      }

      return newTransaction;
    });
  }

  async redeemPoints(_params: RedeemPointsParams): Promise<LoyaltyTransaction> {
    return (db as NodePgDatabase<typeof schema>).transaction(async tx => {
      const member = await tx.query.loyaltyMembers.findFirst({
        _where: eq(schema.loyaltyMembers.id, params.memberId)
      });
      if (!member) throw new LoyaltyMemberNotFoundError(params.memberId);

      const reward = await tx.query.loyaltyRewards.findFirst({
        _where: eq(schema.loyaltyRewards.id, params.rewardId)
      });
      if (!reward) throw new RewardNotFoundError(params.rewardId);

      const currentPoints = parseInt(member.currentPoints ?? '0', 10);
      if (currentPoints < reward.pointsRequired) {
        throw new InsufficientPointsError(currentPoints, reward.pointsRequired);
      }

      const newPoints = currentPoints - reward.pointsRequired;

      // _Note: Points are managed through transactions, not direct updates

      const transactionData = {
        _memberId: params.memberId,
        _programId: member.programId as number,
        _pointsRedeemed: reward.pointsRequired,
        _pointsBalance: newPoints,
        _transactionType: 'redeem' as const,
        _source: 'reward_redemption'
      };

      const [newTransaction] = await tx
        .insert(schema.loyaltyTransactions)
        .values(transactionData as any)
        .returning();

      if (!newTransaction) {
        throw new Error('Failed to create loyalty transaction - no record returned');
      }

      return newTransaction;
    });
  }

  async getLoyaltyProgramById(_programId: number): Promise<LoyaltyProgram | null> {
    try {
      const query = db.query.loyaltyPrograms.findFirst({
        _where: eq(schema.loyaltyPrograms.id, programId)
      });
      return await query;
    } catch (error) {
      return this.handleError(error, 'getting loyalty program by ID');
    }
  }

  async getLoyaltyProgramByStore(_storeId: number): Promise<LoyaltyProgram | null> {
    try {
      const query = db.query.loyaltyPrograms.findFirst({
        _where: and(
          eq(schema.loyaltyPrograms.storeId, storeId),
          eq(schema.loyaltyPrograms.active, true)
        ),
        _orderBy: { createdAt: 'desc' }
      });
      return await query;
    } catch (error) {
      return this.handleError(error, 'getting loyalty program by store');
    }
  }

  async getLoyaltyMemberById(_memberId: number): Promise<LoyaltyMember | null> {
    try {
      const query = db.query.loyaltyMembers.findFirst({
        _where: eq(schema.loyaltyMembers.id, memberId)
      });
      return await query;
    } catch (error) {
      return this.handleError(error, 'getting loyalty member by ID');
    }
  }

  async getLoyaltyMemberByUser(_programId: number, _userId: number): Promise<LoyaltyMember | null> {
    try {
      const query = db.query.loyaltyMembers.findFirst({
        _where: and(
          eq(schema.loyaltyMembers.programId, programId),
          eq(schema.loyaltyMembers.customerId, userId)
        )
      });
      return await query;
    } catch (error) {
      return this.handleError(error, 'getting loyalty member by user');
    }
  }

  async getLoyaltyTransactionsByMember(_memberId: number): Promise<LoyaltyTransaction[]> {
    try {
      return await db.query.loyaltyTransactions.findMany({
        _where: eq(schema.loyaltyTransactions.memberId, memberId),
        _orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      return this.handleError(error, 'getting loyalty transactions by member');
    }
  }

  /**
   * Generate a unique membership ID
   *
   * @param userId User ID
   * @param programId Program ID
   * @returns Unique membership ID
   */
  private generateMembershipId(_userId: number, _programId: number): string {
    const prefix = 'LM';
    const timestamp = Date.now().toString().slice(-6);
    return `${prefix}${programId}${userId}${timestamp}`;
  }
}
