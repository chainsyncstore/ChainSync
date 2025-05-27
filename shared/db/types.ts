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
  namespace NodeJS {
    interface Global {
      stores: any; // Will be populated at runtime
      users: any;   // Will be populated at runtime
      products: any; // Will be populated at runtime
      categories: any; // Will be populated at runtime
      inventory: any; // Will be populated at runtime
      inventoryBatches: any; // Will be populated at runtime
      suppliers: any; // Will be populated at runtime
    }
  }
}

// Initialize global references
export async function initializeGlobals() {
  if (!(global as any).stores) {
    try {
      const { stores } = await import('./stores');
      (global as any).stores = stores;
    } catch (error) {
      console.warn('Failed to initialize stores:', error);
    }
  }
  
  if (!(global as any).users) {
    try {
      const { users } = await import('./users');
      (global as any).users = users;
    } catch (error) {
      console.warn('Failed to initialize users:', error);
    }
  }

  if (!(global as any).products) {
    try {
      const { products, categories } = await import('./products'); // Assuming categories is in products.ts
      (global as any).products = products;
      (global as any).categories = categories;
    } catch (error) {
      console.warn('Failed to initialize products/categories:', error);
    }
  }

  if (!(global as any).inventory) {
    try {
      const { inventory, inventoryBatches } = await import('./inventory'); // Assuming inventoryBatches is in inventory.ts
      (global as any).inventory = inventory;
      (global as any).inventoryBatches = inventoryBatches;
    } catch (error) {
      console.warn('Failed to initialize inventory/inventoryBatches:', error);
    }
  }

  if (!(global as any).suppliers) {
    try {
      const { suppliers } = await import('./suppliers');
      (global as any).suppliers = suppliers;
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
