import { ErrorCode, ErrorCategory } from '@shared/types/errors'; // AppError removed
import * as schema from '@shared/schema';

export type LoyaltyProgram = schema.LoyaltyProgram;
export type LoyaltyMember = schema.LoyaltyMember;
export type LoyaltyTransaction = schema.LoyaltyTransaction;
export type LoyaltyProgramStatus = 'active' | 'inactive' | 'draft' | 'archived'; // Adjust as needed if enum/type exists in schema

export interface ILoyaltyService {
  generateLoyaltyId(): Promise<string>;
  enrollCustomer(
    customerId: number,
    storeId: number,
    userId: number
  ): Promise<schema.LoyaltyMember>;
  calculatePointsForTransaction(
    subtotal: string | number,
    storeId: number,
    items: Array<{
      productId: number;
      quantity: number;
      unitPrice: number | string;
    }>
  ): Promise<number>;
  recordPointsEarned(
    transactionId: number,
    memberId: number,
    points: number,
    userId: number
  ): Promise<{
    success: boolean;
    transaction?: schema.LoyaltyTransaction;
  }>;
  getAvailableRewards(memberId: number): Promise<schema.LoyaltyReward[]>;
  applyReward(
    memberId: number,
    rewardId: number,
    transactionId: number,
    userId: number
  ): Promise<{
    success: boolean;
    discountAmount?: string;
    pointsRedeemed?: string;
    message?: string;
  }>;
  getLoyaltyMember(identifier: string | number): Promise<schema.LoyaltyMember | null>;
  getLoyaltyMemberByCustomerId(customerId: number): Promise<schema.LoyaltyMember | null>;
  getMemberActivityHistory(
    memberId: number,
    limit?: number,
    offset?: number
  ): Promise<schema.LoyaltyTransaction[]>;
  getLoyaltyProgram(storeId: number): Promise<schema.LoyaltyProgram | null>;
  upsertLoyaltyProgram(
    storeId: number,
    programData: Partial<schema.LoyaltyProgramInsert>
  ): Promise<schema.LoyaltyProgram>;
  createLoyaltyTier(tierData: schema.LoyaltyTierInsert): Promise<schema.LoyaltyTier>;
  createLoyaltyReward(
    rewardData: schema.LoyaltyRewardInsert
  ): Promise<schema.LoyaltyReward>;
  processExpiredPoints(userId: number): Promise<number>;
  checkAndUpdateMemberTier(memberId: number): Promise<boolean>;
  getLoyaltyAnalytics(storeId: number): Promise<{
    memberCount: number;
    activeMembers: number;
    totalPointsEarned: string;
    totalPointsRedeemed: string;
    pointsBalance: string;
    programDetails: schema.LoyaltyProgram | null;
    topRewards: Array<{
      name: string;
      redemptions: number;
    }>;
  }>;
}

export interface ILoyaltyServiceErrors {
  CUSTOMER_NOT_FOUND: ServiceError;
  DUPLICATE_MEMBER: ServiceError;
  INSUFFICIENT_POINTS: ServiceError;
  INVALID_REWARD: ServiceError;
  PROGRAM_NOT_FOUND: ServiceError;
  TIER_NOT_FOUND: ServiceError;
  REWARD_NOT_FOUND: ServiceError;
  TRANSACTION_FAILED: ServiceError;
}

export const LoyaltyServiceErrors: ILoyaltyServiceErrors = {
  CUSTOMER_NOT_FOUND: new ServiceError(
    'Customer not found',
    ErrorCode.RESOURCE_NOT_FOUND,
    ErrorCategory.RESOURCE
  ),
  DUPLICATE_MEMBER: new ServiceError(
    'Customer already enrolled in loyalty program',
    ErrorCode.RESOURCE_ALREADY_EXISTS,
    ErrorCategory.RESOURCE
  ),
  INSUFFICIENT_POINTS: new ServiceError(
    'Insufficient points for reward',
    ErrorCode.INSUFFICIENT_BALANCE,
    ErrorCategory.BUSINESS
  ),
  INVALID_REWARD: new ServiceError(
    'Invalid reward selected',
    ErrorCode.RESOURCE_NOT_FOUND,
    ErrorCategory.RESOURCE
  ),
  PROGRAM_NOT_FOUND: new ServiceError(
    'Loyalty program not found',
    ErrorCode.RESOURCE_NOT_FOUND,
    ErrorCategory.RESOURCE
  ),
  TIER_NOT_FOUND: new ServiceError(
    'Loyalty tier not found',
    ErrorCode.RESOURCE_NOT_FOUND,
    ErrorCategory.RESOURCE
  ),
  REWARD_NOT_FOUND: new ServiceError(
    'Loyalty reward not found',
    ErrorCode.RESOURCE_NOT_FOUND,
    ErrorCategory.RESOURCE
  ),
  TRANSACTION_FAILED: new ServiceError(
    'Failed to process loyalty transaction',
    ErrorCode.INTERNAL_SERVER_ERROR,
    ErrorCategory.SYSTEM,
    true,
    5000
  )
};
