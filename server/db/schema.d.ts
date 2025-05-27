import { InferSelectModel } from 'drizzle-orm';

export const loyaltyPrograms: any;
export const loyaltyTiers: any;
export const loyaltyMembers: any;
export const loyaltyTransactions: any;
export const loyaltyRewards: any;

export type LoyaltyProgram = InferSelectModel<typeof loyaltyPrograms>;
export type LoyaltyTier = InferSelectModel<typeof loyaltyTiers>;
export type LoyaltyMember = InferSelectModel<typeof loyaltyMembers>;
export type LoyaltyTransaction = InferSelectModel<typeof loyaltyTransactions>;
export type LoyaltyReward = InferSelectModel<typeof loyaltyRewards>;
