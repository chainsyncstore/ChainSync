// This file contains type definitions to handle circular dependencies

// Import types without causing circular dependencies
type User = import('./users').User;
type PasswordResetToken = import('./users').PasswordResetToken;
type Store = import('./stores').Store;
type UserRole = import('./users').UserRole;
type Product = import('./products').Product;
type Category = import('./products').Category;
type Inventory = import('./inventory').Inventory;
type InventoryBatch = import('./inventory').InventoryBatch;
type Supplier = import('./suppliers').Supplier;

// Global type augmentations
declare global {
  var _stores: any; // Will be populated at runtime
  var _users: any;   // Will be populated at runtime
  var _products: any; // Will be populated at runtime
  var _categories: any; // Will be populated at runtime
  var _inventory: any; // Will be populated at runtime
  var _inventoryBatches: any; // Will be populated at runtime
  var _suppliers: any; // Will be populated at runtime
}

// Initialize global references
export async function initializeGlobals() {
  // Simplified initialization that doesn't rely on server-side modules
  console.log('Initializing global references for client...');
  return Promise.resolve();
}

// Re-export types with proper circular references
export interface UserWithRelations extends User {
  store?: Store;
  passwordResetTokens?: PasswordResetToken[];
}

export interface StoreWithRelations extends Store {
  users?: User[];
}

// Example for ProductWithRelations - adapt as needed based on actual relations
export interface ProductWithRelations extends Product {
  category?: Category;
  // inventoryBatches?: InventoryBatch[]; // If products link to inventory batches
}

export interface InventoryWithRelations extends Inventory {
  // product?: Product; // If inventory links back to a single product
  batches?: InventoryBatch[];
  supplier?: Supplier; // If inventory links to a supplier
}

export interface CategoryWithRelations extends Category {
  products?: Product[];
}

export interface InventoryBatchWithRelations extends InventoryBatch {
  inventory?: Inventory;
  product?: Product; // If batches directly link to products
}

export interface SupplierWithRelations extends Supplier {
  inventory?: Inventory[]; // If supplier links to many inventory items
  // inventoryBatches?: InventoryBatch[]; // If supplier links to inventory batches
}


// Export enums and other shared types
export type { UserRole };

// Export schema types
export type * from './users';
export type * from './stores';
export type * from './products';
export type * from './inventory';
export type * from './suppliers';
