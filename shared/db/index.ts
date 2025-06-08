// Additional tables referenced in storage.ts
import { returns } from './returns';
import { refunds } from './refunds';
import { passwordResetTokens } from './passwordResetTokens';
import { affiliates } from './affiliates';
import { referrals } from './referrals';
import { referralPayments } from './referralPayments';
import { batchAuditLogs } from './batchAuditLogs';
import { cashierSessions } from './cashierSessions';
import { customers } from './customers';
import { inventory, inventoryBatches } from './inventory';

// Loyalty tables
import { loyaltyTiers } from './loyaltyTiers';
import { loyaltyRewards } from './loyaltyRewards';
import { loyaltyTransactions as loyaltyTransactionsTable } from './loyaltyTransactions'; // Alias to avoid conflict if re-exporting type
import { inventoryTransactions } from './inventoryTransactions'; // Import new table
import { loyaltyMembers } from './loyaltyMembers';
import { loyaltyPrograms } from './loyaltyPrograms';
import { notifications } from './notifications';
import { products, categories } from './products';
import { returnItems } from './returnItems';
import { returnReasons } from './returnReasons';
import { stores } from './stores';
import { subscriptions } from './subscriptions';
import { transactions, transactionItems } from './transactions';
import { users } from './users';

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
export * from './base';
export * from './users';
export * from './customers';
export * from './stores';
export * from './products';
export * from './inventory';
export * from './transactions';
export * from './subscriptions';
export * from './cashierSessions';
export * from './loyaltyMembers';
export * from './notifications';
export * from './returns';
export * from './refunds';
// passwordResetTokens is exported from users.js, so re-exporting here is redundant
// export * from "./passwordResetTokens";
export * from './affiliates';
export * from './referrals';
export * from './referralPayments';
export * from './batchAuditLogs';
export * from './returnItems';
export * from './returnReasons';
// Export loyalty tables
export * from './loyaltyPrograms';
export * from './loyaltyTiers';
export * from './loyaltyRewards';
export * from './loyaltyTransactions';
export * from './inventoryTransactions'; // Re-export new table types/schemas
