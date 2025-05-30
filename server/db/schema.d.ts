import { InferSelectModel } from 'drizzle-orm';
import { MySqlTableWithColumns } from 'drizzle-orm/mysql-core';

// Declare schema tables with proper types
export declare const loyaltyPrograms: MySqlTableWithColumns<any>;
export declare const loyaltyTiers: MySqlTableWithColumns<any>;
export declare const loyaltyMembers: MySqlTableWithColumns<any>;
export declare const loyaltyTransactions: MySqlTableWithColumns<any>;
export declare const loyaltyRewards: MySqlTableWithColumns<any>;

// Export inferred types for each table
export type LoyaltyProgram = InferSelectModel<typeof loyaltyPrograms>;
export type LoyaltyTier = InferSelectModel<typeof loyaltyTiers>;
export type LoyaltyMember = InferSelectModel<typeof loyaltyMembers>;
export type LoyaltyTransaction = InferSelectModel<typeof loyaltyTransactions>;
export type LoyaltyReward = InferSelectModel<typeof loyaltyRewards>;
