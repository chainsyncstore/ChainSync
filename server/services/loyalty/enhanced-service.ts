import { and, eq } from 'drizzle-orm';
import db from '../../database';
import * as schema from '@shared/schema';
import { loyaltyValidation } from '@shared/schema-validation';
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
  UpdateProgramParams,
} from './types';
import { AddPointsParams } from './types';

export class EnhancedLoyaltyService extends EnhancedBaseService {
  constructor() {
    super();
  }

  // Helper to get a store by ID
  private async getStoreById(storeId: number) {
    return db.query.stores.findFirst({ where: eq(schema.stores.id, storeId) });
  }

  // Helper to get a user by ID
  private async getUserById(userId: number) {
    return db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  }

  async createProgram(params: CreateProgramParams): Promise<LoyaltyProgram> {
    try {
      const store = await this.getStoreById(params.storeId);
      if (!store) {
        throw new LoyaltyProgramNotFoundError(0); // Placeholder, should be a StoreNotFoundError
      }

      const existing = await db.query.loyaltyPrograms.findFirst({
        where: and(
          eq(schema.loyaltyPrograms.storeId, params.storeId),
          eq(schema.loyaltyPrograms.name, params.name)
        ),
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

  async updateProgram(programId: number, params: UpdateProgramParams): Promise<LoyaltyProgram> {
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

  async enrollCustomer(params: LoyaltyMemberInsert): Promise<LoyaltyMember> {
    try {
      const existingMember = await db.query.loyaltyMembers.findFirst({
        where: and(
          eq(schema.loyaltyMembers.programId, params.programId),
          eq(schema.loyaltyMembers.customerId, params.customerId)
        ),
      });

      if (existingMember) {
        throw new MemberAlreadyEnrolledError(params.customerId, params.programId);
      }

      const validatedData = loyaltyValidation.memberInsert.parse({
        ...params,
        membershipId: this.generateMembershipId(params.customerId, params.programId),
      });

      const [newMember] = await db.insert(schema.loyaltyMembers).values(validatedData).returning();

      return this.ensureExists(newMember, 'Loyalty Member');
    } catch (error) {
      if (error instanceof MemberAlreadyEnrolledError) throw error;
      throw new DatabaseOperationError('enroll customer', error);
    }
  }

  async addPoints(params: AddPointsParams): Promise<LoyaltyTransaction> {
    return db.transaction(async tx => {
      try {
        const member = await tx.query.loyaltyMembers.findFirst({
          where: eq(schema.loyaltyMembers.id, params.memberId),
          for: 'update',
        });

        if (!member) {
          throw new LoyaltyMemberNotFoundError(params.memberId);
        }

        const newPoints = (member.points ?? 0) + params.points;

        await tx
          .update(schema.loyaltyMembers)
          .set({ points: newPoints, updatedAt: new Date() })
          .where(eq(schema.loyaltyMembers.id, params.memberId));

        const transactionData: LoyaltyTransactionInsert = {
          memberId: params.memberId,
          programId: member.programId,
          pointsEarned: params.points,
          pointsBalance: newPoints,
          transactionType: 'earn',
          source: params.source,
          transactionId: params.transactionId,
          description: `Earned ${params.points} points from ${params.source}`,
        };

        const validatedData = loyaltyValidation.transactionInsert.parse(transactionData);
        const [newTransaction] = await tx
          .insert(schema.loyaltyTransactions)
          .values(validatedData)
          .returning();

        return this.ensureExists(newTransaction, 'Loyalty Transaction');
      } catch (error) {
        if (error instanceof LoyaltyMemberNotFoundError) throw error;
        throw new DatabaseOperationError('add points', error);
      }
    });
  }

  async redeemPoints(params: RedeemPointsParams): Promise<LoyaltyTransaction> {
    return db.transaction(async tx => {
      try {
        const member = await tx.query.loyaltyMembers.findFirst({
          where: eq(schema.loyaltyMembers.id, params.memberId),
          for: 'update',
        });

        if (!member) {
          throw new LoyaltyMemberNotFoundError(params.memberId);
        }

        const reward = await tx.query.loyaltyRewards.findFirst({
          where: eq(schema.loyaltyRewards.id, params.rewardId),
        });

        if (!reward || !reward.pointsRequired) {
          throw new RewardNotFoundError(params.rewardId);
        }

        if ((member.points ?? 0) < reward.pointsRequired) {
          throw new InsufficientPointsError(params.memberId, reward.pointsRequired);
        }

        const newPoints = (member.points ?? 0) - reward.pointsRequired;

        await tx
          .update(schema.loyaltyMembers)
          .set({ points: newPoints, updatedAt: new Date() })
          .where(eq(schema.loyaltyMembers.id, params.memberId));

        const transactionData: LoyaltyTransactionInsert = {
          memberId: params.memberId,
          programId: member.programId,
          pointsRedeemed: reward.pointsRequired,
          pointsBalance: newPoints,
          transactionType: 'redeem',
          source: 'reward_redemption',
          description: `Redeemed reward: ${reward.name}`,
        };

        const validatedData = loyaltyValidation.transactionInsert.parse(transactionData);
        const [newTransaction] = await tx
          .insert(schema.loyaltyTransactions)
          .values(validatedData)
          .returning();

        return this.ensureExists(newTransaction, 'Loyalty Transaction');
      } catch (error) {
        if (
          error instanceof LoyaltyMemberNotFoundError ||
          error instanceof RewardNotFoundError ||
          error instanceof InsufficientPointsError
        ) {
          throw error;
        }
        throw new DatabaseOperationError('redeem points', error);
      }
    });
  }

  async getLoyaltyProgramById(programId: number): Promise<LoyaltyProgram | null> {
    try {
      const query = db.query.loyaltyPrograms.findFirst({
        where: eq(schema.loyaltyPrograms.id, programId),
      });
      return await query;
    } catch (error) {
      return this.handleError(error, 'getting loyalty program by ID');
    }
  }

  async getLoyaltyProgramByStore(storeId: number): Promise<LoyaltyProgram | null> {
    try {
      const query = db.query.loyaltyPrograms.findFirst({
        where: and(
          eq(schema.loyaltyPrograms.storeId, storeId),
          eq(schema.loyaltyPrograms.active, true)
        ),
        orderBy: { createdAt: 'desc' },
      });
      return await query;
    } catch (error) {
      return this.handleError(error, 'getting loyalty program by store');
    }
  }

  async getLoyaltyMemberById(memberId: number): Promise<LoyaltyMember | null> {
    try {
      const query = db.query.loyaltyMembers.findFirst({
        where: eq(schema.loyaltyMembers.id, memberId),
      });
      return await query;
    } catch (error) {
      return this.handleError(error, 'getting loyalty member by ID');
    }
  }

  async getLoyaltyMemberByUser(programId: number, userId: number): Promise<LoyaltyMember | null> {
    try {
      const query = db.query.loyaltyMembers.findFirst({
        where: and(
          eq(schema.loyaltyMembers.programId, programId),
          eq(schema.loyaltyMembers.customerId, userId)
        ),
      });
      return await query;
    } catch (error) {
      return this.handleError(error, 'getting loyalty member by user');
    }
  }

  async getLoyaltyTransactionsByMember(memberId: number): Promise<LoyaltyTransaction[]> {
    try {
      return await db.query.loyaltyTransactions.findMany({
        where: eq(schema.loyaltyTransactions.memberId, memberId),
        orderBy: { createdAt: 'desc' },
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
  private generateMembershipId(userId: number, programId: number): string {
    const prefix = 'LM';
    const timestamp = Date.now().toString().slice(-6);
    return `${prefix}${programId}${userId}${timestamp}`;
  }
}
