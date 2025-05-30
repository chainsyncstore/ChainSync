import { z } from 'zod';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { PgTransaction } from 'drizzle-orm/pg-core';

// Define the DrizzleClient type
export type DrizzleClient = NodePgDatabase<any>;

// Define the Transaction type
export type Transaction = PgTransaction<any, any, any>;


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
  points: string;
  isActive: boolean;
  enrolledBy: number;
  enrolledAt: Date;
  updatedAt: Date | null;
}

export interface LoyaltyTransaction {
  id: number;
  memberId: number;
  programId: number;
  transactionId: number | null;
  rewardId: number | null;
  type: 'earn' | 'redeem' | 'enroll';
  points: string;
  userId: number;
  createdAt: Date;
  reward?: LoyaltyReward;
}

export interface LoyaltyReward {
  id: number;
  programId: number;
  name: string;
  description: string | null;
  pointsCost: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface LoyaltyMemberStats {
  totalPoints: string;
  currentTier: LoyaltyTier | null;
  recentTransactions: LoyaltyTransaction[];
}

export interface LoyaltyAnalytics {
  totalMembers: number;
  activeMembers: number;
  avgPointsPerMember: string;
  totalPointsEarned: string;
  totalPointsRedeemed: string;
  pointsBalance: string;
  topTier: LoyaltyTier | null;
  programDetails: LoyaltyProgram;
  topRewards: Array<{ name: string; redemptions: number }>;
  recentRedemptions: LoyaltyTransaction[];
}

export interface LoyaltyProgramWithTiers extends LoyaltyProgram {
  tiers: LoyaltyTier[];
}
