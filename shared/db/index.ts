import { users } from "./users";
import { stores } from "./stores";
import { customers } from "./customers";
import { products, categories } from "./products";
import { inventory, inventoryBatches } from "./inventory";
import { transactions, transactionItems } from "./transactions";
import { subscriptions } from "./subscriptions";

// Additional tables referenced in storage.ts
import { cashierSessions } from "./cashierSessions";
import { loyaltyMembers } from "./loyaltyMembers";
import { notifications } from "./notifications";
import { returns } from "./returns";
import { refunds } from "./refunds";
import { passwordResetTokens } from "./passwordResetTokens";
import { affiliates } from "./affiliates";
import { referrals } from "./referrals";
import { referralPayments } from "./referralPayments";
import { batchAuditLogs } from "./batchAuditLogs";
import { returnItems } from "./returnItems";
import { returnReasons } from "./returnReasons";

// Loyalty tables
import { loyaltyPrograms } from "./loyaltyPrograms";
import { loyaltyTiers } from "./loyaltyTiers";
import { loyaltyRewards } from "./loyaltyRewards";
import { loyaltyTransactions } from "./loyaltyTransactions";

// Database configuration
export const schema = {
  users,
  customers,
  stores,
  categories,
  products,
  inventory,
  inventoryBatches,
  transactions,
  transactionItems,
  subscriptions,
  cashierSessions,
  loyaltyMembers,
  notifications,
  returns,
  refunds,
  passwordResetTokens,
  affiliates,
  referrals,
  referralPayments,
  batchAuditLogs,
  returnItems,
  returnReasons,
  // Newly added loyalty tables
  loyaltyPrograms,
  loyaltyTiers,
  loyaltyRewards,
  loyaltyTransactions,
};

// Re-export all types and schemas
export * from "./base";
export * from "./users";
export * from "./customers";
export * from "./stores";
export * from "./products";
export * from "./inventory";
export * from "./transactions";
export * from "./subscriptions";
export * from "./cashierSessions";
export * from "./loyaltyMembers";
export * from "./notifications";
export * from "./returns";
export * from "./refunds";
export * from "./passwordResetTokens";
export * from "./affiliates";
export * from "./referrals";
export * from "./referralPayments";
export * from "./batchAuditLogs";
export * from "./returnItems";
export * from "./returnReasons";
// Export loyalty tables
export * from "./loyaltyPrograms";
export * from "./loyaltyTiers";
export * from "./loyaltyRewards";
export * from "./loyaltyTransactions";
