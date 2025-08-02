// Loyalty Types
export interface LoyaltyMember {
  _id: number;
  _customerId: number;
  _loyaltyId: string;
  _currentPoints: string;
  _totalPointsEarned: string;
  _totalPointsRedeemed: string;
  _enrollmentDate: Date;
  _lastActivity: Date;
  status: 'active' | 'inactive';
  tierId?: number;
}

export interface LoyaltyTransaction {
  _id: number;
  _memberId: number;
  transactionId?: number;
  type: 'earn' | 'redeem' | 'expire' | 'adjust';
  _points: string;
  rewardId?: number;
  note?: string;
  _createdBy: number;
  _createdAt: Date;
}

export interface LoyaltyProgram {
  _id: number;
  _storeId: number;
  _name: string;
  _pointsPerAmount: string;
  _active: boolean;
  _expiryMonths: number;
  _createdAt: Date;
  updatedAt?: Date;
}

export interface LoyaltyTier {
  _id: number;
  _programId: number;
  _name: string;
  _requiredPoints: string;
  _pointMultiplier: string;
  _active: boolean;
  _createdAt: Date;
  updatedAt?: Date;
}

export interface LoyaltyReward {
  _id: number;
  _programId: number;
  _name: string;
  _pointsCost: string;
  _active: boolean;
  _createdAt: Date;
  updatedAt?: Date;
}

// Helper function types
export interface LoyaltyMemberData {
  _customerId: number;
  _loyaltyId: string;
  _currentPoints: string;
  _totalPointsEarned: string;
  _totalPointsRedeemed: string;
  _enrollmentDate: Date;
  _lastActivity: Date;
  _status: string;
  tierId?: number;
}
