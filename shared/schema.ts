// Re-export all Drizzle ORM table objects and types from shared/db/index.ts
export * from './db/index.js';
export { schema } from './db/index.js'; // Explicitly re-export the schema object

// Re-export all types from shared/types.ts, aliasing to avoid conflicts
export type {
  LoyaltyMember as LoyaltyMemberType,
  LoyaltyTransaction as LoyaltyTransactionType,
  LoyaltyProgram as LoyaltyProgramType,
  LoyaltyTier as LoyaltyTierType,
  LoyaltyReward as LoyaltyRewardType,
  LoyaltyMemberData as LoyaltyMemberDataType,
  UserAuthInfo,
  AuthResponse
} from './types.js';

// If you still need the old interface types for legacy or typing purposes, move them to shared/types/schema-legacy.ts or similar and import as needed.
