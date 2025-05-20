import { users } from "./users";
import { stores, categories } from "./stores";
import { products } from "./products";
import { inventory, inventoryBatches } from "./inventory";
import { transactions, transactionItems } from "./transactions";

// Database configuration
export const schema = {
  users,
  stores,
  categories,
  products,
  inventory,
  inventoryBatches,
  transactions,
  transactionItems
};

// Re-export all types and schemas
export * from "./base";
export * from "./users";
export * from "./stores";
export * from "./products";
export * from "./inventory";
export * from "./transactions";
