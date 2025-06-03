import { users } from "./users.js";
import { stores } from "./stores.js";
import { customers } from "./customers.js";
import { products, categories } from "./products.js";
import { inventory, inventoryBatches } from "./inventory.js";
import { transactions, transactionItems } from "./transactions.js";
import { subscriptions } from "./subscriptions.js";

// Additional tables referenced in storage.ts
import { cashierSessions } from "./cashierSessions.js";
import { loyaltyMembers } from "./loyaltyMembers.js";
import { notifications } from "./notifications.js";
import { returns } from "./returns.js";
import { refunds } from "./refunds.js";
import { passwordResetTokens } from "./passwordResetTokens.js";
import { affiliates } from "./affiliates.js";
import { referrals } from "./referrals.js";
import { referralPayments } from "./referralPayments.js";
import { batchAuditLogs } from "./batchAuditLogs.js";
import { returnItems } from "./returnItems.js";
import { returnReasons } from "./returnReasons.js";

// Loyalty tables
import { loyaltyPrograms } from "./loyaltyPrograms.js";
import { loyaltyTiers } from "./loyaltyTiers.js";
import { loyaltyRewards } from "./loyaltyRewards.js";
import { loyaltyTransactions as loyaltyTransactionsTable } from "./loyaltyTransactions.js"; // Alias to avoid conflict if re-exporting type
import { inventoryTransactions } from "./inventoryTransactions.js"; // Import new table

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
  loyaltyTransactions: loyaltyTransactionsTable, // Use aliased table object
  inventoryTransactions, // Add new table to schema object
};

// Re-export all types and schemas
export * from "./base.js";
export * from "./users.js";
export * from "./customers.js";
export * from "./stores.js";
export * from "./products.js";
export * from "./inventory.js";
export * from "./transactions.js";
export * from "./subscriptions.js";
export * from "./cashierSessions.js";
export * from "./loyaltyMembers.js";
export * from "./notifications.js";
export * from "./returns.js";
export * from "./refunds.js";
// passwordResetTokens is exported from users.js, so re-exporting here is redundant
// export * from "./passwordResetTokens.js"; 
export * from "./affiliates.js";
export * from "./referrals.js";
export * from "./referralPayments.js";
export * from "./batchAuditLogs.js";
export * from "./returnItems.js";
export * from "./returnReasons.js";
// Export loyalty tables
export * from "./loyaltyPrograms.js";
export * from "./loyaltyTiers.js";
export * from "./loyaltyRewards.js";
export * from "./loyaltyTransactions.js";
export * from "./inventoryTransactions.js"; // Re-export new table types/schemas
