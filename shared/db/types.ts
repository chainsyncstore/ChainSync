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
  var stores: any; // Will be populated at runtime
  var users: any;   // Will be populated at runtime
  var products: any; // Will be populated at runtime
  var categories: any; // Will be populated at runtime
  var inventory: any; // Will be populated at runtime
  var inventoryBatches: any; // Will be populated at runtime
  var suppliers: any; // Will be populated at runtime
}

// Initialize global references
export function initializeGlobals() {
  if (!global.stores) {
    try {
      const { stores } = require('./stores');
      global.stores = stores;
    } catch (error) {
      console.warn('Failed to initialize stores:', error);
    }
  }
  
  if (!global.users) {
    try {
      const { users } = require('./users');
      global.users = users;
    } catch (error) {
      console.warn('Failed to initialize users:', error);
    }
  }

  if (!global.products) {
    try {
      const { products, categories } = require('./products'); // Assuming categories is in products.ts
      global.products = products;
      global.categories = categories;
    } catch (error) {
      console.warn('Failed to initialize products/categories:', error);
    }
  }

  if (!global.inventory) {
    try {
      const { inventory, inventoryBatches } = require('./inventory'); // Assuming inventoryBatches is in inventory.ts
      global.inventory = inventory;
      global.inventoryBatches = inventoryBatches;
    } catch (error) {
      console.warn('Failed to initialize inventory/inventoryBatches:', error);
    }
  }

  if (!global.suppliers) {
    try {
      const { suppliers } = require('./suppliers');
      global.suppliers = suppliers;
    } catch (error) {
      console.warn('Failed to initialize suppliers:', error);
    }
  }
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
