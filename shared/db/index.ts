import { users } from "./users.js";
import { stores } from "./stores.js";
import { products, categories } from "./products.js";
import { inventory, inventoryBatches } from "./inventory.js";
import { transactions, transactionItems } from "./transactions.js";

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
export * from "./base.js";
export * from "./users.js";
export * from "./stores.js";
export * from "./products.js";
export * from "./inventory.js";
export * from "./transactions.js";
