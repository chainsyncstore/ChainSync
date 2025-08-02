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
  SelectTransaction
} from '../shared/schema.js';

// Storage interface for ChainSync operations
export interface IStorage {
  // User operations
  createUser(_user: InsertUser): Promise<SelectUser>;
  getUserById(_id: number): Promise<SelectUser | null>;
  getUserByEmail(_email: string): Promise<SelectUser | null>;
  updateUser(_id: number, _updates: Partial<InsertUser>): Promise<SelectUser | null>;
  getAllUsers(): Promise<SelectUser[]>;
  deleteUser(_id: number): Promise<boolean>;

  // Store operations
  createStore(_store: InsertStore): Promise<SelectStore>;
  getStoreById(_id: number): Promise<SelectStore | null>;
  getAllStores(): Promise<SelectStore[]>;
  updateStore(_id: number, _updates: Partial<InsertStore>): Promise<SelectStore | null>;
  deleteStore(_id: number): Promise<boolean>;

  // Product operations
  createProduct(_product: InsertProduct): Promise<SelectProduct>;
  getProductById(_id: number): Promise<SelectProduct | null>;
  getProductByBarcode(_barcode: string): Promise<SelectProduct | null>;
  getAllProducts(limit?: number, offset?: number): Promise<SelectProduct[]>;
  searchProducts(_query: string): Promise<SelectProduct[]>;
  updateProduct(_id: number, _updates: Partial<InsertProduct>): Promise<SelectProduct | null>;
  deleteProduct(_id: number): Promise<boolean>;

  // Inventory operations
  createInventoryItem(_inventory: InsertInventory): Promise<SelectInventory>;
  getInventoryById(_id: number): Promise<SelectInventory | null>;
  getInventoryByStore(_storeId: number): Promise<SelectInventory[]>;
  getInventoryByProduct(_productId: number): Promise<SelectInventory[]>;
  updateInventory(_id: number, _updates: Partial<InsertInventory>): Promise<SelectInventory | null>;
  updateInventoryQuantity(_productId: number, _storeId: number, _quantity: number): Promise<SelectInventory | null>;
  getLowStockItems(storeId?: number): Promise<SelectInventory[]>;

  // Transaction operations
  createTransaction(_transaction: InsertTransaction): Promise<SelectTransaction>;
  getTransactionById(_id: number): Promise<SelectTransaction | null>;
  getTransactionsByStore(_storeId: number, limit?: number): Promise<SelectTransaction[]>;
  getTransactionsByUser(_userId: number, limit?: number): Promise<SelectTransaction[]>;
  updateTransactionStatus(_id: number, _status: 'pending' | 'completed' | 'cancelled'): Promise<SelectTransaction | null>;
  getTotalSales(storeId?: number, from?: Date, to?: Date): Promise<number>;
}

// In-memory storage implementation for development
class MemStorage implements IStorage {
  private _users: Map<number, SelectUser> = new Map();
  private _stores: Map<number, SelectStore> = new Map();
  private _products: Map<number, SelectProduct> = new Map();
  private _inventory: Map<number, SelectInventory> = new Map();
  private _transactions: Map<number, SelectTransaction> = new Map();
  private nextId = { _users: 1, _stores: 1, _products: 1, _inventory: 1, _transactions: 1 };

  // User operations
  async createUser(_user: InsertUser): Promise<SelectUser> {
    const _newUser: SelectUser = {
      _password: user.password || '',
      _email: user.email || '',
      _name: user.name || '',
      _id: this.nextId.users++,
      _role: (user.role as 'admin' | 'manager' | 'cashier') || 'cashier',
      _storeId: (user.storeId as number) || 1,
      _isActive: (user.isActive as boolean) ?? true,
      _createdAt: new Date(),
      _updatedAt: new Date()
    };
    this.users.set(newUser.id, newUser);
    return newUser;
  }

  async getUserById(_id: number): Promise<SelectUser | null> {
    return this.users.get(id) || null;
  }

  async getUserByEmail(_email: string): Promise<SelectUser | null> {
    for (const user of this.users.values()) {
      if (user.email === email) return user;
    }
    return null;
  }

  async updateUser(_id: number, _updates: Partial<InsertUser>): Promise<SelectUser | null> {
    const user = this.users.get(id);
    if (!user) return null;

    const _updatedUser: SelectUser = {
      ...user,
      ...updates,
      _isActive: (updates.isActive as boolean) ?? user.isActive,
      _storeId: (updates.storeId as number) ?? user.storeId,
      _role: (updates.role as 'admin' | 'manager' | 'cashier') ?? user.role,
      _updatedAt: new Date()
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async getAllUsers(): Promise<SelectUser[]> {
    return Array.from(this.users.values());
  }

  async deleteUser(_id: number): Promise<boolean> {
    return this.users.delete(id);
  }

  // Store operations
  async createStore(_store: InsertStore): Promise<SelectStore> {
    const _newStore: SelectStore = {
      _status: store.status || 'active',
      _email: store.email || '',
      _name: store.name || '',
      _isActive: (store.isActive as boolean) ?? true,
      _id: this.nextId.stores++,
      _createdAt: new Date(),
      _updatedAt: new Date(),
      _phone: store.phone || '',
      _location: store.location || '',
      _address: store.address || '',
      _city: store.city || '',
      _state: store.state || '',
      _country: store.country || '',
      _timezone: store.timezone || '',
      _managerId: (store.managerId as number) || 1
    };
    this.stores.set(newStore.id, newStore);
    return newStore;
  }

  async getStoreById(_id: number): Promise<SelectStore | null> {
    return this.stores.get(id) || null;
  }

  async getAllStores(): Promise<SelectStore[]> {
    return Array.from(this.stores.values());
  }

  async updateStore(_id: number, _updates: Partial<InsertStore>): Promise<SelectStore | null> {
    const store = this.stores.get(id);
    if (!store) return null;

    const _updatedStore: SelectStore = {
      ...store,
      ...updates,
      _isActive: (updates.isActive as boolean) ?? store.isActive,
      _managerId: (updates.managerId as number) ?? store.managerId,
      _address: updates.address ?? store.address,
      _city: updates.city ?? store.city,
      _state: updates.state ?? store.state,
      _country: updates.country ?? store.country,
      _phone: updates.phone ?? store.phone,
      _email: updates.email ?? store.email,
      _timezone: updates.timezone ?? store.timezone,
      _status: updates.status ?? store.status,
      _updatedAt: new Date()
    };
    this.stores.set(id, updatedStore);
    return updatedStore;
  }

  async deleteStore(_id: number): Promise<boolean> {
    return this.stores.delete(id);
  }

  // Product operations
  async createProduct(_product: InsertProduct): Promise<SelectProduct> {
    const _newProduct: SelectProduct = {
      _name: product.name || '',
      _isActive: (product.isActive as boolean) ?? true,
      _id: this.nextId.products++,
      _createdAt: new Date(),
      _updatedAt: new Date(),
      _storeId: (product.storeId as number) || 1,
      _description: product.description || '',
      _barcode: product.barcode || '',
      _price: (product.price as string) || '0',
      _cost: (product.cost as string) || '0',
      _categoryId: (product.categoryId as number) || 1,
      _brandId: (product.brandId as number) || 1,
      _unit: product.unit || 'pcs',
      _isPerishable: (product.isPerishable as boolean) ?? false,
      _imageUrl: product.imageUrl || '',
      _attributes: product.attributes || {},
      _sku: product.sku || ''
    };
    this.products.set(newProduct.id, newProduct);
    return newProduct;
  }

  async getProductById(_id: number): Promise<SelectProduct | null> {
    return this.products.get(id) || null;
  }

  async getProductByBarcode(_barcode: string): Promise<SelectProduct | null> {
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

  async searchProducts(_query: string): Promise<SelectProduct[]> {
    const searchTerm = query.toLowerCase();
    return Array.from(this.products.values()).filter(
      product =>
        product.name.toLowerCase().includes(searchTerm) ||
        product.description?.toLowerCase().includes(searchTerm) ||
        product.barcode?.includes(searchTerm)
    );
  }

  async updateProduct(_id: number, _updates: Partial<InsertProduct>): Promise<SelectProduct | null> {
    const product = this.products.get(id);
    if (!product) return null;

    const _updatedProduct: SelectProduct = {
      ...product,
      ...updates,
      _isActive: (updates.isActive as boolean) ?? product.isActive,
      _storeId: (updates.storeId as number) ?? product.storeId,
      _price: (updates.price as string) ?? product.price,
      _cost: (updates.cost as string) ?? product.cost,
      _categoryId: (updates.categoryId as number) ?? product.categoryId,
      _brandId: (updates.brandId as number) ?? product.brandId,
      _isPerishable: (updates.isPerishable as boolean) ?? product.isPerishable,
      _attributes: (updates.attributes as any) ?? product.attributes,
      _description: updates.description ?? product.description,
      _barcode: updates.barcode ?? product.barcode,
      _imageUrl: updates.imageUrl ?? product.imageUrl,
      _sku: updates.sku ?? product.sku,
      _unit: updates.unit ?? product.unit,
      _updatedAt: new Date()
    };
    this.products.set(id, updatedProduct);
    return updatedProduct;
  }

  async deleteProduct(_id: number): Promise<boolean> {
    return this.products.delete(id);
  }

  // Inventory operations
  async createInventoryItem(_inventory: InsertInventory): Promise<SelectInventory> {
    const _newInventory: SelectInventory = {
      _id: this.nextId.inventory++,
      _updatedAt: new Date(),
      _storeId: (inventory.storeId as number) || 1,
      _productId: (inventory.productId as number) || 1,
      _quantity: (inventory.quantity as number) ?? 0,
      _minStock: (inventory.minStock as number) ?? 0,
      _maxStock: (inventory.maxStock as number) ?? 100,
      _lastRestocked: (inventory.lastRestocked as Date) ?? new Date(),
      _batchTracking: (inventory.batchTracking as boolean) ?? false,
      _currentUtilization: (inventory.currentUtilization as number) ?? 0,
      _totalQuantity: (inventory.totalQuantity as number) ?? 0,
      _availableQuantity: (inventory.availableQuantity as number) ?? 0,
      _minimumLevel: (inventory.minimumLevel as number) ?? 0
    };
    this.inventory.set(newInventory.id, newInventory);
    return newInventory;
  }

  async getInventoryById(_id: number): Promise<SelectInventory | null> {
    return this.inventory.get(id) || null;
  }

  async getInventoryByStore(_storeId: number): Promise<SelectInventory[]> {
    return Array.from(this.inventory.values()).filter(item => item.storeId === storeId);
  }

  async getInventoryByProduct(_productId: number): Promise<SelectInventory[]> {
    return Array.from(this.inventory.values()).filter(item => item.productId === productId);
  }

  async updateInventory(_id: number, _updates: Partial<InsertInventory>): Promise<SelectInventory | null> {
    const inventory = this.inventory.get(id);
    if (!inventory) return null;

    const _updatedInventory: SelectInventory = {
      ...inventory,
      ...updates,
      _storeId: (updates.storeId as number) ?? inventory.storeId,
      _productId: (updates.productId as number) ?? inventory.productId,
      _quantity: (updates.quantity as number) ?? inventory.quantity,
      _minStock: (updates.minStock as number) ?? inventory.minStock,
      _maxStock: (updates.maxStock as number) ?? inventory.maxStock,
      _lastRestocked: (updates.lastRestocked as Date) ?? inventory.lastRestocked,
      _batchTracking: (updates.batchTracking as boolean) ?? inventory.batchTracking,
      _currentUtilization: (updates.currentUtilization as number) ?? inventory.currentUtilization,
      _totalQuantity: (updates.totalQuantity as number) ?? inventory.totalQuantity,
      _availableQuantity: (updates.availableQuantity as number) ?? inventory.availableQuantity,
      _minimumLevel: (updates.minimumLevel as number) ?? inventory.minimumLevel,
      _updatedAt: new Date()
    };
    this.inventory.set(id, updatedInventory);
    return updatedInventory;
  }

  async updateInventoryQuantity(_productId: number, _storeId: number, _quantity: number): Promise<SelectInventory | null> {
    for (const [id, item] of this.inventory) {
      if (item.productId === productId && item.storeId === storeId) {
        const updatedInventory = { ...item, quantity, _updatedAt: new Date() };
        this.inventory.set(id, updatedInventory);
        return updatedInventory;
      }
    }
    return null;
  }

  async getLowStockItems(storeId?: number): Promise<SelectInventory[]> {
    return Array.from(this.inventory.values()).filter(item => {
      const isLowStock = item.quantity !== null && item.minStock !== null && item.quantity <= item.minStock;
      return isLowStock && (storeId ? item.storeId === _storeId : true);
    });
  }

  // Transaction operations
  async createTransaction(_transaction: InsertTransaction): Promise<SelectTransaction> {
    const _newTransaction: SelectTransaction = {
      _status: transaction.status || 'pending',
      _id: this.nextId.transactions++,
      _customerId: (transaction.customerId as number) || 1,
      _createdAt: new Date(),
      _storeId: (transaction.storeId as number) || 1,
      _userId: (transaction.userId as number) || 1,
      _total: (transaction.total as string) || '0',
      _subtotal: (transaction.subtotal as string) || '0',
      _tax: (transaction.tax as string) || '0',
      _discount: (transaction.discount as string) || '0',
      _paymentMethod: (transaction.paymentMethod as 'card' | 'cash' | 'mobile') || 'cash',
      _items: transaction.items || {}
    };
    this.transactions.set(newTransaction.id, newTransaction);
    return newTransaction;
  }

  async getTransactionById(_id: number): Promise<SelectTransaction | null> {
    return this.transactions.get(id) || null;
  }

  async getTransactionsByStore(_storeId: number, limit?: number): Promise<SelectTransaction[]> {
    const storeTransactions = Array.from(this.transactions.values())
      .filter(t => t.storeId === storeId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));

    return limit ? storeTransactions.slice(0, limit) : storeTransactions;
  }

  async getTransactionsByUser(_userId: number, limit?: number): Promise<SelectTransaction[]> {
    const userTransactions = Array.from(this.transactions.values())
      .filter(t => t.userId === userId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));

    return limit ? userTransactions.slice(0, limit) : userTransactions;
  }

  async updateTransactionStatus(_id: number, _status: 'pending' | 'completed' | 'cancelled'): Promise<SelectTransaction | null> {
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
export const _storage: IStorage = new MemStorage();
