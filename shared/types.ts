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
  status: 'active' | 'inactive';
  tierId?: number;
}

export interface LoyaltyTransaction {
  id: number;
  memberId: number;
  transactionId?: number;
  type: 'earn' | 'redeem' | 'expire' | 'adjust';
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

// Auth Types
export interface UserAuthInfo {
  id: number;
  username: string;
  email: string;
  role: string;
  fullName?: string;
  storeId?: number | null; // Allow null from DB
  lastLogin?: string | Date | null; // Allow null from DB, string from JSON
  createdAt?: string | Date | null; // Allow null from DB, string from JSON
  updatedAt?: string | Date | null; // Allow null from DB, string from JSON
  // Add other user-specific fields as needed
}

export interface AuthResponse {
  authenticated: boolean;
  user: UserAuthInfo | null;
  // token and refreshToken are typically part of login-specific responses,
  // not the /api/auth/me (check auth status) response.
  // If /api/auth/me also returns tokens on initial load, they can be added here.
  // For now, assuming /api/auth/me is primarily for auth status and user info.
  token?: string; // Optional: if /me endpoint can also refresh/provide token
  refreshToken?: string; // Optional
}
