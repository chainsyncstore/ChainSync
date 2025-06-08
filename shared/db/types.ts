// This file contains type definitions to handle circular dependencies

// Import types without causing circular dependencies
type User = import('./users.js').User;
type PasswordResetToken = import('./users.js').PasswordResetToken;
type Store = import('./stores.js').Store;
type UserRole = import('./users.js').UserRole;
type Product = import('./products.js').Product;
type Category = import('./products.js').Category;
type Inventory = import('./inventory.js').Inventory;
type InventoryBatch = import('./inventory.js').InventoryBatch;
type Supplier = import('./suppliers.js').Supplier;

// Global type augmentations
declare global {
  namespace NodeJS {
    interface Global {
      stores: unknown; // Will be populated at runtime
      users: unknown; // Will be populated at runtime
      products: unknown; // Will be populated at runtime
      categories: unknown; // Will be populated at runtime
      inventory: unknown; // Will be populated at runtime
      inventoryBatches: unknown; // Will be populated at runtime
      suppliers: unknown; // Will be populated at runtime
    }
  }
}

// Create a cross-environment global reference
const getGlobalThis = (): any => {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof self !== 'undefined') return self;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  throw new Error('Unable to locate global object');
};

// Use our safe global reference
const globalRef = getGlobalThis();
if (!globalRef.__chainSyncGlobals) {
  globalRef.__chainSyncGlobals = {};
}

// Initialize global references
export async function initializeGlobals() {
  if (!globalRef.__chainSyncGlobals.stores) {
    try {
      const { stores } = await import('./stores.js');
      globalRef.__chainSyncGlobals.stores = stores;
    } catch (error: unknown) {
      console.warn('Failed to initialize stores:', error);
    }
  }

  if (!globalRef.__chainSyncGlobals.users) {
    try {
      const { users } = await import('./users.js');
      globalRef.__chainSyncGlobals.users = users;
    } catch (error: unknown) {
      console.warn('Failed to initialize users:', error);
    }
  }

  if (!globalRef.__chainSyncGlobals.products) {
    try {
      const { products, categories } = await import('./products.js'); // Assuming categories is in products.ts
      globalRef.__chainSyncGlobals.products = products;
      globalRef.__chainSyncGlobals.categories = categories;
    } catch (error: unknown) {
      console.warn('Failed to initialize products/categories:', error);
    }
  }

  if (!globalRef.__chainSyncGlobals.inventory) {
    try {
      const { inventory, inventoryBatches } = await import('./inventory.js'); // Assuming inventoryBatches is in inventory.ts
      globalRef.__chainSyncGlobals.inventory = inventory;
      globalRef.__chainSyncGlobals.inventoryBatches = inventoryBatches;
    } catch (error: unknown) {
      console.warn('Failed to initialize inventory/inventoryBatches:', error);
    }
  }

  if (!globalRef.__chainSyncGlobals.suppliers) {
    try {
      const { suppliers } = await import('./suppliers.js');
      globalRef.__chainSyncGlobals.suppliers = suppliers;
    } catch (error: unknown) {
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
export type * from './users.js';
export type * from './stores.js';
export type * from './products.js';
export type * from './inventory.js';
export type * from './suppliers.js';
