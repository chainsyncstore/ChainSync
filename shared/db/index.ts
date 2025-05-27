import { users } from "./users";
import { stores } from "./stores";
import { customers } from "./customers";
import { products, categories } from "./products";
import { inventory, inventoryBatches } from "./inventory";
import { transactions, transactionItems } from "./transactions";
import { subscriptions } from "./subscriptions";

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
  subscriptions
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
