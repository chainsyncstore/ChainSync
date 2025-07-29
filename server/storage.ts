import type {
  InsertUser,
  InsertStore,
  InsertProduct,
  InsertInventory,
  InsertTransaction,
  SelectUser,
  SelectStore,
  SelectProduct,
  SelectInventory,
  SelectTransaction,
} from '../shared/schema.js';

// Storage interface for ChainSync operations
export interface IStorage {
  // User operations
  createUser(user: InsertUser): Promise<SelectUser>;
  getUserById(id: number): Promise<SelectUser | null>;
  getUserByEmail(email: string): Promise<SelectUser | null>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<SelectUser | null>;
  getAllUsers(): Promise<SelectUser[]>;
  deleteUser(id: number): Promise<boolean>;

  // Store operations
  createStore(store: InsertStore): Promise<SelectStore>;
  getStoreById(id: number): Promise<SelectStore | null>;
  getAllStores(): Promise<SelectStore[]>;
  updateStore(id: number, updates: Partial<InsertStore>): Promise<SelectStore | null>;
  deleteStore(id: number): Promise<boolean>;

  // Product operations
  createProduct(product: InsertProduct): Promise<SelectProduct>;
  getProductById(id: number): Promise<SelectProduct | null>;
  getProductByBarcode(barcode: string): Promise<SelectProduct | null>;
  getAllProducts(limit?: number, offset?: number): Promise<SelectProduct[]>;
  searchProducts(query: string): Promise<SelectProduct[]>;
  updateProduct(id: number, updates: Partial<InsertProduct>): Promise<SelectProduct | null>;
  deleteProduct(id: number): Promise<boolean>;

  // Inventory operations
  createInventoryItem(inventory: InsertInventory): Promise<SelectInventory>;
  getInventoryById(id: number): Promise<SelectInventory | null>;
  getInventoryByStore(storeId: number): Promise<SelectInventory[]>;
  getInventoryByProduct(productId: number): Promise<SelectInventory[]>;
  updateInventory(id: number, updates: Partial<InsertInventory>): Promise<SelectInventory | null>;
  updateInventoryQuantity(productId: number, storeId: number, quantity: number): Promise<SelectInventory | null>;
  getLowStockItems(storeId?: number): Promise<SelectInventory[]>;

  // Transaction operations
  createTransaction(transaction: InsertTransaction): Promise<SelectTransaction>;
  getTransactionById(id: number): Promise<SelectTransaction | null>;
  getTransactionsByStore(storeId: number, limit?: number): Promise<SelectTransaction[]>;
  getTransactionsByUser(userId: number, limit?: number): Promise<SelectTransaction[]>;
  updateTransactionStatus(id: number, status: 'pending' | 'completed' | 'cancelled'): Promise<SelectTransaction | null>;
  getTotalSales(storeId?: number, from?: Date, to?: Date): Promise<number>;
}

// In-memory storage implementation for development
class MemStorage implements IStorage {
  private users: Map<number, SelectUser> = new Map();
  private stores: Map<number, SelectStore> = new Map();
  private products: Map<number, SelectProduct> = new Map();
  private inventory: Map<number, SelectInventory> = new Map();
  private transactions: Map<number, SelectTransaction> = new Map();
  private nextId = { users: 1, stores: 1, products: 1, inventory: 1, transactions: 1 };

  // User operations
  async createUser(user: InsertUser): Promise<SelectUser> {
    const newUser: SelectUser = {
      password: user.password || '',
      email: user.email || '',
      name: user.name || '',
      id: this.nextId.users++,
      role: (user.role as 'admin' | 'manager' | 'cashier') || 'cashier',
      storeId: (user.storeId as number) || 1,
      isActive: (user.isActive as boolean) ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(newUser.id, newUser);
    return newUser;
  }

  async getUserById(id: number): Promise<SelectUser | null> {
    return this.users.get(id) || null;
  }

  async getUserByEmail(email: string): Promise<SelectUser | null> {
    for (const user of this.users.values()) {
      if (user.email === email) return user;
    }
    return null;
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<SelectUser | null> {
    const user = this.users.get(id);
    if (!user) return null;

    const updatedUser: SelectUser = {
      ...user,
      ...updates,
      isActive: (updates.isActive as boolean) ?? user.isActive,
      storeId: (updates.storeId as number) ?? user.storeId,
      updatedAt: new Date()
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async getAllUsers(): Promise<SelectUser[]> {
    return Array.from(this.users.values());
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }

  // Store operations
  async createStore(store: InsertStore): Promise<SelectStore> {
    const newStore: SelectStore = {
      status: store.status || 'active',
      email: store.email || '',
      name: store.name || '',
      isActive: (store.isActive as boolean) ?? true,
      id: this.nextId.stores++,
      createdAt: new Date(),
      updatedAt: new Date(),
      phone: store.phone || '',
      location: store.location || '',
      address: store.address || '',
      city: store.city || '',
      state: store.state || '',
      country: store.country || '',
      timezone: store.timezone || '',
      managerId: (store.managerId as number) || 1,
    };
    this.stores.set(newStore.id, newStore);
    return newStore;
  }

  async getStoreById(id: number): Promise<SelectStore | null> {
    return this.stores.get(id) || null;
  }

  async getAllStores(): Promise<SelectStore[]> {
    return Array.from(this.stores.values());
  }

  async updateStore(id: number, updates: Partial<InsertStore>): Promise<SelectStore | null> {
    const store = this.stores.get(id);
    if (!store) return null;

    const updatedStore: SelectStore = {
      ...store,
      ...updates,
      isActive: (updates.isActive as boolean) ?? store.isActive,
      managerId: (updates.managerId as number) ?? store.managerId,
      updatedAt: new Date()
    };
    this.stores.set(id, updatedStore);
    return updatedStore;
  }

  async deleteStore(id: number): Promise<boolean> {
    return this.stores.delete(id);
  }

  // Product operations
  async createProduct(product: InsertProduct): Promise<SelectProduct> {
    const newProduct: SelectProduct = {
      name: product.name || '',
      isActive: (product.isActive as boolean) ?? true,
      id: this.nextId.products++,
      createdAt: new Date(),
      updatedAt: new Date(),
      storeId: (product.storeId as number) || 1,
      description: product.description || '',
      barcode: product.barcode || '',
      price: (product.price as string) || '0',
      cost: (product.cost as string) || '0',
      categoryId: (product.categoryId as number) || 1,
      brandId: (product.brandId as number) || 1,
      unit: product.unit || 'pcs',
      isPerishable: (product.isPerishable as boolean) ?? false,
      imageUrl: product.imageUrl || '',
      attributes: product.attributes || {},
      sku: product.sku || '',
    };
    this.products.set(newProduct.id, newProduct);
    return newProduct;
  }

  async getProductById(id: number): Promise<SelectProduct | null> {
    return this.products.get(id) || null;
  }

  async getProductByBarcode(barcode: string): Promise<SelectProduct | null> {
    for (const product of this.products.values()) {
      if (product.barcode === barcode) return product;
    }
    return null;
  }

  async getAllProducts(limit?: number, offset?: number): Promise<SelectProduct[]> {
    const products = Array.from(this.products.values());
    if (offset) products.splice(0, offset);
    if (limit) return products.slice(0, limit);
    return products;
  }

  async searchProducts(query: string): Promise<SelectProduct[]> {
    const searchTerm = query.toLowerCase();
    return Array.from(this.products.values()).filter(
      product => 
        product.name.toLowerCase().includes(searchTerm) ||
        product.description?.toLowerCase().includes(searchTerm) ||
        product.barcode?.includes(searchTerm)
    );
  }

  async updateProduct(id: number, updates: Partial<InsertProduct>): Promise<SelectProduct | null> {
    const product = this.products.get(id);
    if (!product) return null;

    const updatedProduct: SelectProduct = {
      ...product,
      ...updates,
      isActive: (updates.isActive as boolean) ?? product.isActive,
      storeId: (updates.storeId as number) ?? product.storeId,
      price: (updates.price as string) ?? product.price,
      cost: (updates.cost as string) ?? product.cost,
      categoryId: (updates.categoryId as number) ?? product.categoryId,
      brandId: (updates.brandId as number) ?? product.brandId,
      isPerishable: (updates.isPerishable as boolean) ?? product.isPerishable,
      attributes: (updates.attributes as any) ?? product.attributes,
      updatedAt: new Date()
    };
    this.products.set(id, updatedProduct);
    return updatedProduct;
  }

  async deleteProduct(id: number): Promise<boolean> {
    return this.products.delete(id);
  }

  // Inventory operations
  async createInventoryItem(inventory: InsertInventory): Promise<SelectInventory> {
    const newInventory: SelectInventory = {
      id: this.nextId.inventory++,
      updatedAt: new Date(),
      storeId: (inventory.storeId as number) || 1,
      productId: (inventory.productId as number) || 1,
      quantity: (inventory.quantity as number) ?? 0,
      minStock: (inventory.minStock as number) ?? 0,
      maxStock: (inventory.maxStock as number) ?? 100,
      lastRestocked: (inventory.lastRestocked as Date) ?? new Date(),
      batchTracking: (inventory.batchTracking as boolean) ?? false,
      currentUtilization: (inventory.currentUtilization as number) ?? 0,
      totalQuantity: (inventory.totalQuantity as number) ?? 0,
      availableQuantity: (inventory.availableQuantity as number) ?? 0,
      minimumLevel: (inventory.minimumLevel as number) ?? 0,
    };
    this.inventory.set(newInventory.id, newInventory);
    return newInventory;
  }

  async getInventoryById(id: number): Promise<SelectInventory | null> {
    return this.inventory.get(id) || null;
  }

  async getInventoryByStore(storeId: number): Promise<SelectInventory[]> {
    return Array.from(this.inventory.values()).filter(item => item.storeId === storeId);
  }

  async getInventoryByProduct(productId: number): Promise<SelectInventory[]> {
    return Array.from(this.inventory.values()).filter(item => item.productId === productId);
  }

  async updateInventory(id: number, updates: Partial<InsertInventory>): Promise<SelectInventory | null> {
    const inventory = this.inventory.get(id);
    if (!inventory) return null;

    const updatedInventory: SelectInventory = {
      ...inventory,
      ...updates,
      storeId: (updates.storeId as number) ?? inventory.storeId,
      productId: (updates.productId as number) ?? inventory.productId,
      quantity: (updates.quantity as number) ?? inventory.quantity,
      minStock: (updates.minStock as number) ?? inventory.minStock,
      maxStock: (updates.maxStock as number) ?? inventory.maxStock,
      lastRestocked: (updates.lastRestocked as Date) ?? inventory.lastRestocked,
      batchTracking: (updates.batchTracking as boolean) ?? inventory.batchTracking,
      currentUtilization: (updates.currentUtilization as number) ?? inventory.currentUtilization,
      totalQuantity: (updates.totalQuantity as number) ?? inventory.totalQuantity,
      availableQuantity: (updates.availableQuantity as number) ?? inventory.availableQuantity,
      minimumLevel: (updates.minimumLevel as number) ?? inventory.minimumLevel,
      updatedAt: new Date()
    };
    this.inventory.set(id, updatedInventory);
    return updatedInventory;
  }

  async updateInventoryQuantity(productId: number, storeId: number, quantity: number): Promise<SelectInventory | null> {
    for (const [id, item] of this.inventory) {
      if (item.productId === productId && item.storeId === storeId) {
        const updatedInventory = { ...item, quantity, updatedAt: new Date() };
        this.inventory.set(id, updatedInventory);
        return updatedInventory;
      }
    }
    return null;
  }

  async getLowStockItems(storeId?: number): Promise<SelectInventory[]> {
    return Array.from(this.inventory.values()).filter(item => {
      const isLowStock = item.quantity !== null && item.minStock !== null && item.quantity <= item.minStock;
      return isLowStock && (storeId ? item.storeId === storeId : true);
    });
  }

  // Transaction operations
  async createTransaction(transaction: InsertTransaction): Promise<SelectTransaction> {
    const newTransaction: SelectTransaction = {
      status: transaction.status || 'pending',
      id: this.nextId.transactions++,
      customerId: (transaction.customerId as number) || 1,
      createdAt: new Date(),
      storeId: (transaction.storeId as number) || 1,
      userId: (transaction.userId as number) || 1,
      total: (transaction.total as string) || '0',
      subtotal: (transaction.subtotal as string) || '0',
      tax: (transaction.tax as string) || '0',
      discount: (transaction.discount as string) || '0',
      paymentMethod: (transaction.paymentMethod as 'card' | 'cash' | 'mobile') || 'cash',
      items: transaction.items || {},
    };
    this.transactions.set(newTransaction.id, newTransaction);
    return newTransaction;
  }

  async getTransactionById(id: number): Promise<SelectTransaction | null> {
    return this.transactions.get(id) || null;
  }

  async getTransactionsByStore(storeId: number, limit?: number): Promise<SelectTransaction[]> {
    const storeTransactions = Array.from(this.transactions.values())
      .filter(t => t.storeId === storeId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
    
    return limit ? storeTransactions.slice(0, limit) : storeTransactions;
  }

  async getTransactionsByUser(userId: number, limit?: number): Promise<SelectTransaction[]> {
    const userTransactions = Array.from(this.transactions.values())
      .filter(t => t.userId === userId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
    
    return limit ? userTransactions.slice(0, limit) : userTransactions;
  }

  async updateTransactionStatus(id: number, status: 'pending' | 'completed' | 'cancelled'): Promise<SelectTransaction | null> {
    const transaction = this.transactions.get(id);
    if (!transaction) return null;

    const updatedTransaction = { ...transaction, status };
    this.transactions.set(id, updatedTransaction);
    return updatedTransaction;
  }

  async getTotalSales(storeId?: number, from?: Date, to?: Date): Promise<number> {
    let total = 0;
    for (const transaction of this.transactions.values()) {
      if (transaction.status !== 'completed') continue;
      if (storeId && transaction.storeId !== storeId) continue;
      if (from && transaction.createdAt && transaction.createdAt < from) continue;
      if (to && transaction.createdAt && transaction.createdAt > to) continue;
      
      total += parseFloat(transaction.total || '0');
    }
    return total;
  }
}

// Export storage instance
export const storage: IStorage = new MemStorage();
