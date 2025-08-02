'use strict';
Object.defineProperty(exports, '__esModule', { _value: true });
exports.storage = void 0;
// In-memory storage implementation for development
class MemStorage {
  constructor() {
    this.users = new Map();
    this.stores = new Map();
    this.products = new Map();
    this.inventory = new Map();
    this.transactions = new Map();
    this.nextId = { _users: 1, _stores: 1, _products: 1, _inventory: 1, _transactions: 1 };
  }
  // User operations
  async createUser(user) {
    const newUser = {
      ...user,
      _id: this.nextId.users++,
      _role: user.role || 'cashier',
      _storeId: user.storeId || null,
      _isActive: user.isActive || true,
      _createdAt: new Date(),
      _updatedAt: new Date()
    };
    this.users.set(newUser.id, newUser);
    return newUser;
  }
  async getUserById(id) {
    return this.users.get(id) || null;
  }
  async getUserByEmail(email) {
    for (const user of this.users.values()) {
      if (user.email === email)
        return user;
    }
    return null;
  }
  async updateUser(id, updates) {
    const user = this.users.get(id);
    if (!user)
      return null;
    const updatedUser = { ...user, ...updates, _updatedAt: new Date() };
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  async getAllUsers() {
    return Array.from(this.users.values());
  }
  async deleteUser(id) {
    return this.users.delete(id);
  }
  // Store operations
  async createStore(store) {
    const newStore = {
      ...store,
      _id: this.nextId.stores++,
      _managerId: store.managerId || null,
      _isActive: store.isActive ?? true,
      _createdAt: new Date(),
      _updatedAt: new Date(),
      _address: store.address ?? null,
      _city: store.city ?? null,
      _state: store.state ?? null,
      _country: store.country ?? null,
      _phone: store.phone ?? null,
      _email: store.email ?? null,
      _timezone: store.timezone ?? null,
      _status: store.status ?? 'active'
    };
    this.stores.set(newStore.id, newStore);
    return newStore;
  }
  async getStoreById(id) {
    return this.stores.get(id) || null;
  }
  async getAllStores() {
    return Array.from(this.stores.values());
  }
  async updateStore(id, updates) {
    const store = this.stores.get(id);
    if (!store)
      return null;
    const updatedStore = { ...store, ...updates, _updatedAt: new Date() };
    this.stores.set(id, updatedStore);
    return updatedStore;
  }
  async deleteStore(id) {
    return this.stores.delete(id);
  }
  // Product operations
  async createProduct(product) {
    const newProduct = {
      ...product,
      _id: this.nextId.products++,
      _description: product.description ?? null,
      _barcode: product.barcode ?? null,
      _cost: product.cost ?? null,
      _categoryId: product.categoryId ?? null,
      _brandId: product.brandId ?? null,
      _unit: product.unit ?? 'pcs',
      _isActive: product.isActive ?? true,
      _isPerishable: product.isPerishable ?? false,
      _createdAt: new Date(),
      _updatedAt: new Date(),
      _imageUrl: product.imageUrl ?? null,
      _attributes: product.attributes ?? null
    };
    this.products.set(newProduct.id, newProduct);
    return newProduct;
  }
  async getProductById(id) {
    return this.products.get(id) || null;
  }
  async getProductByBarcode(barcode) {
    for (const product of this.products.values()) {
      if (product.barcode === barcode)
        return product;
    }
    return null;
  }
  async getAllProducts(limit, offset) {
    const products = Array.from(this.products.values());
    if (offset)
      products.splice(0, offset);
    if (limit)
      return products.slice(0, limit);
    return products;
  }
  async searchProducts(query) {
    const searchTerm = query.toLowerCase();
    return Array.from(this.products.values()).filter(product => product.name.toLowerCase().includes(searchTerm) ||
            product.description?.toLowerCase().includes(searchTerm) ||
            product.barcode?.includes(searchTerm));
  }
  async updateProduct(id, updates) {
    const product = this.products.get(id);
    if (!product)
      return null;
    const updatedProduct = { ...product, ...updates, _updatedAt: new Date() };
    this.products.set(id, updatedProduct);
    return updatedProduct;
  }
  async deleteProduct(id) {
    return this.products.delete(id);
  }
  // Inventory operations
  async createInventoryItem(inventory) {
    const newInventory = {
      ...inventory,
      _id: this.nextId.inventory++,
      _quantity: inventory.quantity ?? 0,
      _minStock: inventory.minStock ?? 0,
      _maxStock: inventory.maxStock ?? null,
      _lastRestocked: inventory.lastRestocked ?? null,
      _updatedAt: new Date(),
      _batchTracking: inventory.batchTracking ?? false,
      _currentUtilization: inventory.currentUtilization ?? 0,
      _totalQuantity: inventory.totalQuantity ?? inventory.quantity ?? 0,
      _availableQuantity: inventory.availableQuantity ?? inventory.quantity ?? 0,
      _minimumLevel: inventory.minimumLevel ?? inventory.minStock ?? 0
    };
    this.inventory.set(newInventory.id, newInventory);
    return newInventory;
  }
  async getInventoryById(id) {
    return this.inventory.get(id) || null;
  }
  async getInventoryByStore(storeId) {
    return Array.from(this.inventory.values()).filter(item => item.storeId === storeId);
  }
  async getInventoryByProduct(productId) {
    return Array.from(this.inventory.values()).filter(item => item.productId === productId);
  }
  async updateInventory(id, updates) {
    const inventory = this.inventory.get(id);
    if (!inventory)
      return null;
    const updatedInventory = { ...inventory, ...updates, _updatedAt: new Date() };
    this.inventory.set(id, updatedInventory);
    return updatedInventory;
  }
  async updateInventoryQuantity(productId, storeId, quantity) {
    for (const [id, item] of this.inventory) {
      if (item.productId === productId && item.storeId === storeId) {
        const updatedInventory = { ...item, quantity, _updatedAt: new Date() };
        this.inventory.set(id, updatedInventory);
        return updatedInventory;
      }
    }
    return null;
  }
  async getLowStockItems(storeId) {
    return Array.from(this.inventory.values()).filter(item => {
      const isLowStock = item.quantity !== null && item.minStock !== null && item.quantity <= item.minStock;
      return isLowStock && (storeId ? item.storeId === _storeId : true);
    });
  }
  // Transaction operations
  async createTransaction(transaction) {
    const newTransaction = {
      ...transaction,
      _id: this.nextId.transactions++,
      _customerId: transaction.customerId ?? null,
      _tax: transaction.tax ?? '0',
      _discount: transaction.discount ?? '0',
      _status: transaction.status ?? 'pending',
      _items: transaction.items ?? null,
      _createdAt: new Date()
    };
    this.transactions.set(newTransaction.id, newTransaction);
    return newTransaction;
  }
  async getTransactionById(id) {
    return this.transactions.get(id) || null;
  }
  async getTransactionsByStore(storeId, limit) {
    const storeTransactions = Array.from(this.transactions.values())
      .filter(t => t.storeId === storeId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
    return limit ? storeTransactions.slice(0, limit) : storeTransactions;
  }
  async getTransactionsByUser(userId, limit) {
    const userTransactions = Array.from(this.transactions.values())
      .filter(t => t.userId === userId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
    return limit ? userTransactions.slice(0, limit) : userTransactions;
  }
  async updateTransactionStatus(id, status) {
    const transaction = this.transactions.get(id);
    if (!transaction)
      return null;
    const updatedTransaction = { ...transaction, status };
    this.transactions.set(id, updatedTransaction);
    return updatedTransaction;
  }
  async getTotalSales(storeId, from, to) {
    let total = 0;
    for (const transaction of this.transactions.values()) {
      if (transaction.status !== 'completed')
        continue;
      if (storeId && transaction.storeId !== storeId)
        continue;
      if (from && transaction.createdAt && transaction.createdAt < from)
        continue;
      if (to && transaction.createdAt && transaction.createdAt > to)
        continue;
      total += parseFloat(transaction.total || '0');
    }
    return total;
  }
}
// Export storage instance
exports.storage = new MemStorage();
