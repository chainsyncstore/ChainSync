// Loyalty Types
export interface LoyaltyMember {
  id: number;
  customerId: number;
  loyaltyId: string;
  currentPoints: string;
  totalPointsEarned: string;
  totalPointsRedeemed: string;
  enrollmentDate: Date;
  lastActivity: Date;
  status: "active" | "inactive";
  tierId?: number;
}

export interface LoyaltyTransaction {
  id: number;
  memberId: number;
  transactionId?: number;
  type: "earn" | "redeem" | "expire" | "adjust";
  points: string;
  rewardId?: number;
  note?: string;
  createdBy: number;
  createdAt: Date;
}

export interface LoyaltyProgram {
  id: number;
  storeId: number;
  name: string;
  pointsPerAmount: string;
  active: boolean;
  expiryMonths: number;
  createdAt: Date;
  updatedAt?: Date;
}

export interface LoyaltyTier {
  id: number;
  programId: number;
  name: string;
  requiredPoints: string;
  pointMultiplier: string;
  active: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

export interface LoyaltyReward {
  id: number;
  programId: number;
  name: string;
  pointsCost: string;
  active: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

// Helper function types
export interface LoyaltyMemberData {
  customerId: number;
  loyaltyId: string;
  currentPoints: string;
  totalPointsEarned: string;
  totalPointsRedeemed: string;
  enrollmentDate: Date;
  lastActivity: Date;
  status: string;
  tierId?: number;
}
