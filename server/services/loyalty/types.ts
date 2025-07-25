import {
  loyaltyMembers,
  loyaltyPrograms,
  loyaltyRewards,
  loyaltyTiers,
  loyaltyTransactions,
} from '@shared/schema';
import { AppError, ErrorCode, ErrorCategory } from '@shared/types/errors';

// Enums
export const enum LoyaltyProgramStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DRAFT = 'draft',
}

// Base Types
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;

// Insert Types
export type LoyaltyProgramInsert = typeof loyaltyPrograms.$inferInsert;
export type LoyaltyMemberInsert = typeof loyaltyMembers.$inferInsert;
export type LoyaltyTierInsert = typeof loyaltyTiers.$inferInsert;
export type LoyaltyRewardInsert = typeof loyaltyRewards.$inferInsert;
export type LoyaltyTransactionInsert = typeof loyaltyTransactions.$inferInsert;

// Service operation parameters
export type CreateProgramParams = Omit<LoyaltyProgramInsert, 'id' | 'createdAt' | 'updatedAt'> & {
  tiers: Omit<LoyaltyTierInsert, 'id' | 'programId' | 'createdAt' | 'updatedAt'>[];
};

export type UpdateProgramParams = Partial<CreateProgramParams> & { id: number };

export type EnrollCustomerParams = {
  customerId: number;
  programId: number;
  storeId: number; // storeId is required to check for existing members
};

export type AddPointsParams = {
  memberId: number;
  points: number;
  source: string; // e.g., 'purchase', 'manual_adjustment'
  transactionId?: number;
  storeId: number;
  userId: number;
};

export type RedeemPointsParams = {
  memberId: number;
  rewardId: number;
  storeId: number;
  userId: number;
};

// Error classes
export class LoyaltyProgramNotFoundError extends AppError {
  constructor(programId: number) {
    super(
      `Loyalty program with ID ${programId} not found`,
      ErrorCategory.RESOURCE,
      ErrorCode.NOT_FOUND,
      { programId },
      404
    );
  }
}

export class LoyaltyMemberNotFoundError extends AppError {
  constructor(memberId: number) {
    super(
      `Loyalty member with ID ${memberId} not found`,
      ErrorCategory.RESOURCE,
      ErrorCode.NOT_FOUND,
      { memberId },
      404
    );
  }
}

export class InsufficientPointsError extends AppError {
  constructor(memberId: number, requiredPoints: number) {
    super(
      `Member ${memberId} has insufficient points. Required: ${requiredPoints}`,
      ErrorCategory.BUSINESS,
      ErrorCode.INSUFFICIENT_BALANCE,
      { memberId, requiredPoints },
      400
    );
  }
}

export class RewardNotFoundError extends AppError {
  constructor(rewardId: number) {
    super(
      `Reward with ID ${rewardId} not found`,
      ErrorCategory.RESOURCE,
      ErrorCode.NOT_FOUND,
      { rewardId },
      404
    );
  }
}

export class ProgramAlreadyExistsError extends AppError {
  constructor(name: string, storeId: number) {
    super(
      `A loyalty program with name "${name}" already exists for store ${storeId}`,
      ErrorCategory.BUSINESS,
      ErrorCode.CONFLICT,
      { name, storeId },
      409
    );
  }
}

export class MemberAlreadyEnrolledError extends AppError {
  constructor(customerId: number, programId: number) {
    super(
      `Customer ${customerId} is already enrolled in program ${programId}`,
      ErrorCategory.BUSINESS,
      ErrorCode.CONFLICT,
      { customerId, programId },
      409
    );
  }
}

export class InvalidTierError extends AppError {
  constructor(message: string) {
    super(message, ErrorCategory.VALIDATION, ErrorCode.INVALID_FIELD_VALUE, {}, 400);
  }
}

export class DatabaseOperationError extends AppError {
  constructor(operation: string, error?: any) {
    super(
      `Database operation "${operation}" failed`,
      ErrorCategory.DATABASE,
      ErrorCode.DATABASE_ERROR,
      { error: error?.message },
      500,
      true // retryable
    );
  }
}

export interface ILoyaltyService {
  generateLoyaltyId(): Promise<string>;
  enrollCustomer(customerId: number, storeId: number, userId: number): Promise<LoyaltyMember>;
  calculatePointsForTransaction(
    subtotal: string | number,
    storeId: number,
    userId: number
  ): Promise<number>;
  addPoints(
    memberId: number,
    points: number,
    source: string,
    transactionId: number | undefined,
    userId: number
  ): Promise<{
    success: boolean;
    transaction?: LoyaltyTransaction;
  }>;
  getAvailableRewards(memberId: number): Promise<LoyaltyReward[]>;
  applyReward(
    memberId: number,
    rewardId: number,
    currentTotal: number
  ): Promise<{
    success: boolean;
    newTotal?: number;
    pointsRedeemed?: string;
    message?: string;
  }>;
  getLoyaltyMember(identifier: string | number): Promise<LoyaltyMember | null>;
  getLoyaltyMemberByCustomerId(customerId: number): Promise<LoyaltyMember | null>;
  getMemberActivityHistory(
    memberId: number,
    limit?: number,
    offset?: number
  ): Promise<LoyaltyTransaction[]>;
  getLoyaltyProgram(storeId: number): Promise<LoyaltyProgram | null>;
  upsertLoyaltyProgram(
    storeId: number,
    programData: Partial<LoyaltyProgramInsert>
  ): Promise<LoyaltyProgram>;
  createLoyaltyTier(tierData: LoyaltyTierInsert): Promise<LoyaltyTier>;
  createLoyaltyReward(rewardData: LoyaltyRewardInsert): Promise<LoyaltyReward>;
  processExpiredPoints(userId: number): Promise<number>;
  checkAndUpdateMemberTier(memberId: number): Promise<boolean>;
  getLoyaltyAnalytics(storeId: number): Promise<{
    totalMembers: number;
    totalPointsEarned: number;
    totalPointsRedeemed: number;
  }>;
}
