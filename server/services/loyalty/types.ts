import {
  loyaltyMembers,
  loyaltyPrograms,
  loyaltyRewards,
  loyaltyTiers,
  loyaltyTransactions
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
  _tiers: Omit<LoyaltyTierInsert, 'id' | 'programId' | 'createdAt' | 'updatedAt'>[];
};

export type UpdateProgramParams = Partial<CreateProgramParams> & { _id: number };

export type EnrollCustomerParams = {
  _customerId: number;
  _programId: number;
  _storeId: number; // storeId is required to check for existing members
};

export type AddPointsParams = {
  _memberId: number;
  _points: number;
  _source: string; // e.g., 'purchase', 'manual_adjustment'
  transactionId?: number;
  _storeId: number;
  _userId: number;
};

export type RedeemPointsParams = {
  _memberId: number;
  _rewardId: number;
  _storeId: number;
  _userId: number;
};

// Error classes
export class LoyaltyProgramNotFoundError extends AppError {
  constructor(_programId: number) {
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
  constructor(_memberId: number) {
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
  constructor(_memberId: number, _requiredPoints: number) {
    super(
      `Member ${memberId} has insufficient points. _Required: ${requiredPoints}`,
      ErrorCategory.BUSINESS,
      ErrorCode.INSUFFICIENT_BALANCE,
      { memberId, requiredPoints },
      400
    );
  }
}

export class RewardNotFoundError extends AppError {
  constructor(_rewardId: number) {
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
  constructor(_name: string, _storeId: number) {
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
  constructor(_customerId: number, _programId: number) {
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
  constructor(_message: string) {
    super(message, ErrorCategory.VALIDATION, ErrorCode.INVALID_FIELD_VALUE, {}, 400);
  }
}

export class DatabaseOperationError extends AppError {
  constructor(_operation: string, error?: any) {
    super(
      `Database operation "${operation}" failed`,
      ErrorCategory.DATABASE,
      ErrorCode.DATABASE_ERROR,
      { _error: error?.message },
      500,
      true // retryable
    );
  }
}

export interface ILoyaltyService {
  generateLoyaltyId(): Promise<string>;
  enrollCustomer(_customerId: number, _storeId: number, _userId: number): Promise<LoyaltyMember>;
  calculatePointsForTransaction(
    _subtotal: string | number,
    _storeId: number,
    _userId: number
  ): Promise<number>;
  addPoints(
    _memberId: number,
    _points: number,
    _source: string,
    _transactionId: number | undefined,
    _userId: number
  ): Promise<{
    _success: boolean;
    transaction?: LoyaltyTransaction;
  }>;
  getAvailableRewards(_memberId: number): Promise<LoyaltyReward[]>;
  applyReward(
    _memberId: number,
    _rewardId: number,
    _currentTotal: number
  ): Promise<{
    _success: boolean;
    newTotal?: number;
    pointsRedeemed?: string;
    message?: string;
  }>;
  getLoyaltyMember(_identifier: string | number): Promise<LoyaltyMember | null>;
  getLoyaltyMemberByCustomerId(_customerId: number): Promise<LoyaltyMember | null>;
  getMemberActivityHistory(
    _memberId: number,
    limit?: number,
    offset?: number
  ): Promise<LoyaltyTransaction[]>;
  getLoyaltyProgram(_storeId: number): Promise<LoyaltyProgram | null>;
  upsertLoyaltyProgram(
    _storeId: number,
    _programData: Partial<LoyaltyProgramInsert>
  ): Promise<LoyaltyProgram>;
  createLoyaltyTier(_tierData: LoyaltyTierInsert): Promise<LoyaltyTier>;
  createLoyaltyReward(_rewardData: LoyaltyRewardInsert): Promise<LoyaltyReward>;
  processExpiredPoints(_userId: number): Promise<number>;
  checkAndUpdateMemberTier(_memberId: number): Promise<boolean>;
  getLoyaltyAnalytics(_storeId: number): Promise<{
    _totalMembers: number;
    _totalPointsEarned: number;
    _totalPointsRedeemed: number;
  }>;
}
