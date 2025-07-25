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
} from '@shared/schema';

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
      ...user,
      id: this.nextId.users++,
      role: user.role || 'cashier',
      storeId: user.storeId || null,
      isActive: user.isActive || true,
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

    const updatedUser = { ...user, ...updates, updatedAt: new Date() };
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
      ...store,
      id: this.nextId.stores++,
      managerId: store.managerId || null,
      isActive: store.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
      address: store.address ?? null,
      city: store.city ?? null,
      state: store.state ?? null,
      country: store.country ?? null,
      phone: store.phone ?? null,
      email: store.email ?? null,
      timezone: store.timezone ?? null,
      status: store.status ?? 'active',
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

    const updatedStore = { ...store, ...updates, updatedAt: new Date() };
    this.stores.set(id, updatedStore);
    return updatedStore;
  }

  async deleteStore(id: number): Promise<boolean> {
    return this.stores.delete(id);
  }

  // Product operations
  async createProduct(product: InsertProduct): Promise<SelectProduct> {
    const newProduct: SelectProduct = {
      ...product,
      id: this.nextId.products++,
      description: product.description ?? null,
      barcode: product.barcode ?? null,
      cost: product.cost ?? null,
      categoryId: product.categoryId ?? null,
      brandId: product.brandId ?? null,
      unit: product.unit ?? 'pcs',
      isActive: product.isActive ?? true,
      isPerishable: product.isPerishable ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
      imageUrl: product.imageUrl ?? null,
      attributes: product.attributes ?? null,
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

    const updatedProduct = { ...product, ...updates, updatedAt: new Date() };
    this.products.set(id, updatedProduct);
    return updatedProduct;
  }

  async deleteProduct(id: number): Promise<boolean> {
    return this.products.delete(id);
  }

  // Inventory operations
  async createInventoryItem(inventory: InsertInventory): Promise<SelectInventory> {
    const newInventory: SelectInventory = {
      ...inventory,
      id: this.nextId.inventory++,
      quantity: inventory.quantity ?? 0,
      minStock: inventory.minStock ?? 0,
      maxStock: inventory.maxStock ?? null,
      lastRestocked: inventory.lastRestocked ?? null,
      updatedAt: new Date(),
      batchTracking: inventory.batchTracking ?? false,
      currentUtilization: inventory.currentUtilization ?? 0,
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

    const updatedInventory = { ...inventory, ...updates, updatedAt: new Date() };
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
      ...transaction,
      id: this.nextId.transactions++,
      customerId: transaction.customerId ?? null,
      tax: transaction.tax ?? '0',
      discount: transaction.discount ?? '0',
      status: transaction.status ?? 'pending',
      items: transaction.items ?? null,
      createdAt: new Date(),
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
