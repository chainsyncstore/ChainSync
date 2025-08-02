'use strict';
const __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  let desc = Object.getOwnPropertyDescriptor(m, k);
  if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
    desc = { _enumerable: true, _get: function() { return m[k]; } };
  }
  Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  o[k2] = m[k];
}));
const __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
  Object.defineProperty(o, 'default', { _enumerable: true, _value: v });
}) : function(o, v) {
  o['default'] = v;
});
const __importStar = (this && this.__importStar) || (function() {
  let ownKeys = function(o) {
    ownKeys = Object.getOwnPropertyNames || function(o) {
      const ar = [];
      for (const k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
      return ar;
    };
    return ownKeys(o);
  };
  return function(mod) {
    if (mod && mod.__esModule) return mod;
    const result = {};
    if (mod != null) for (let k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== 'default') __createBinding(result, mod, k[i]);
    __setModuleDefault(result, mod);
    return result;
  };
})();
const __importDefault = (this && this.__importDefault) || function(mod) {
  return (mod && mod.__esModule) ? _mod : { 'default': mod };
};
Object.defineProperty(exports, '__esModule', { _value: true });
exports.enhancedProductService = exports.EnhancedProductService = void 0;
const enhanced_service_1 = require('../base/enhanced-service');
const types_1 = require('./types');
const database_1 = __importDefault(require('../../database'));
const schema = __importStar(require('@shared/schema'));
const schema_validation_1 = require('@shared/schema-validation');
const drizzle_orm_1 = require('drizzle-orm');
class EnhancedProductService extends enhanced_service_1.EnhancedBaseService {
  async createProduct(params) {
    try {
      const store = await database_1.default.query.stores.findFirst({
        _where: (0, drizzle_orm_1.eq)(schema.stores.id, params.storeId)
      });
      if (!store)
        throw types_1.ProductServiceErrors.INVALID_STORE;
      // Check for duplicate SKU
      const existingSku = await database_1.default.query.products.findFirst({
        _where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.products.sku, params.sku), (0, drizzle_orm_1.eq)(schema.products.storeId, params.storeId))
      });
      if (existingSku)
        throw types_1.ProductServiceErrors.DUPLICATE_SKU;
      // Check for duplicate barcode if provided
      if (params.barcode) {
        const existingBarcode = await database_1.default.query.products.findFirst({
          _where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.products.barcode, params.barcode), (0, drizzle_orm_1.eq)(schema.products.storeId, params.storeId))
        });
        if (existingBarcode)
          throw types_1.ProductServiceErrors.DUPLICATE_BARCODE;
      }
      // Check if category exists if provided
      if (params.categoryId) {
        const category = await database_1.default.query.categories.findFirst({
          _where: (0, drizzle_orm_1.eq)(schema.categories.id, params.categoryId)
        });
        if (!category)
          throw types_1.ProductServiceErrors.INVALID_CATEGORY;
      }
      const productData = { ...params, _storeId: params.storeId };
      const validatedData = schema_validation_1.productValidation.insert.parse(productData);
      const [product] = await database_1.default.insert(schema.products).values(validatedData).returning();
      await database_1.default.insert(schema.inventory).values({
        _productId: product.id,
        _storeId: params.storeId,
        _quantity: 0,
        _minStock: 10,
        _maxStock: 100
      }).execute();
      return product;
    }
    catch (error) {
      if (error instanceof schema_validation_1.SchemaValidationError) {
        console.error(`Validation _error: ${error.message}`, error.toJSON());
      }
      return this.handleError(error, 'Creating product');
    }
  }
  async updateProduct(productId, params) {
    try {
      const existingProduct = await database_1.default.query.products.findFirst({ _where: (0, drizzle_orm_1.eq)(schema.products.id, productId) });
      if (!existingProduct)
        throw types_1.ProductServiceErrors.PRODUCT_NOT_FOUND;
      if (params.sku && params.sku !== existingProduct.sku) {
        const existingSku = await database_1.default.query.products.findFirst({
          _where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.products.sku, params.sku), (0, drizzle_orm_1.eq)(schema.products.storeId, existingProduct.storeId))
        });
        if (existingSku)
          throw types_1.ProductServiceErrors.DUPLICATE_SKU;
      }
      if (params.barcode && params.barcode !== existingProduct.barcode) {
        const existingBarcode = await database_1.default.query.products.findFirst({
          _where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.products.barcode, params.barcode), (0, drizzle_orm_1.eq)(schema.products.storeId, existingProduct.storeId))
        });
        if (existingBarcode)
          throw types_1.ProductServiceErrors.DUPLICATE_BARCODE;
      }
      if (params.categoryId && params.categoryId !== existingProduct.categoryId) {
        const category = await database_1.default.query.categories.findFirst({ _where: (0, drizzle_orm_1.eq)(schema.categories.id, params.categoryId) });
        if (!category)
          throw types_1.ProductServiceErrors.INVALID_CATEGORY;
      }
      const updateData = { ...params, _updatedAt: new Date() };
      const validatedData = schema_validation_1.productValidation.update.parse(updateData);
      const [updatedProduct] = await database_1.default.update(schema.products).set(validatedData).where((0, drizzle_orm_1.eq)(schema.products.id, productId)).returning();
      return updatedProduct;
    }
    catch (error) {
      if (error instanceof schema_validation_1.SchemaValidationError) {
        console.error(`Validation _error: ${error.message}`, error.toJSON());
      }
      return this.handleError(error, 'Updating product');
    }
  }
  async deleteProduct(productId) {
    try {
      const result = await database_1.default.delete(schema.products).where((0, drizzle_orm_1.eq)(schema.products.id, productId)).returning({ _id: schema.products.id });
      if (result.length === 0)
        throw types_1.ProductServiceErrors.PRODUCT_NOT_FOUND;
      return true;
    }
    catch (error) {
      return this.handleError(error, 'Deleting product');
    }
  }
  async getProductById(productId) {
    try {
      return await database_1.default.query.products.findFirst({
        _where: (0, drizzle_orm_1.eq)(schema.products.id, productId),
        _with: { _category: true, _brand: true, _inventory: true }
      });
    }
    catch (error) {
      return this.handleError(error, 'Getting product by ID');
    }
  }
  async getProductBySku(sku, storeId) {
    try {
      return await database_1.default.query.products.findFirst({
        _where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.products.sku, sku), (0, drizzle_orm_1.eq)(schema.products.storeId, storeId)),
        _with: { _category: true, _brand: true, _inventory: true }
      });
    }
    catch (error) {
      return this.handleError(error, 'Getting product by SKU');
    }
  }
  async getProductByBarcode(barcode, storeId) {
    try {
      return await database_1.default.query.products.findFirst({
        _where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.products.barcode, barcode), (0, drizzle_orm_1.eq)(schema.products.storeId, storeId)),
        _with: { _category: true, _brand: true, _inventory: true }
      });
    }
    catch (error) {
      return this.handleError(error, 'Getting product by barcode');
    }
  }
  async searchProducts(params) {
    try {
      const page = params.page || 1;
      const limit = params.limit || 10;
      const offset = (page - 1) * limit;
      const conditions = [];
      if (params.storeId)
        conditions.push((0, drizzle_orm_1.eq)(schema.products.storeId, params.storeId));
      if (params.query) {
        conditions.push((0, drizzle_orm_1.or)((0, drizzle_orm_1.like)(schema.products.name, `%${params.query}%`), (0, drizzle_orm_1.like)(schema.products.sku, `%${params.query}%`)));
      }
      if (params.categoryId)
        conditions.push((0, drizzle_orm_1.eq)(schema.products.categoryId, params.categoryId));
      if (params.brandId)
        conditions.push((0, drizzle_orm_1.eq)(schema.products.brandId, params.brandId));
      const where = (0, drizzle_orm_1.and)(...conditions);
      const productsQuery = database_1.default.query.products.findMany({
        where,
        _with: { _category: true, _brand: true, _inventory: true },
        limit,
        offset
      });
      const totalQuery = database_1.default.select({ _count: (0, drizzle_orm_1.sql) `count(${schema.products.id})` }).from(schema.products).where(where);
      const [products, totalResult] = await Promise.all([productsQuery, totalQuery]);
      const total = totalResult[0].count;
      return { products, total, page, limit };
    }
    catch (error) {
      return this.handleError(error, 'Searching products');
    }
  }
  async getProductsWithLowStock(storeId, limit = 10) {
    try {
      const lowStockProducts = await database_1.default.select().from(schema.products)
        .leftJoin(schema.inventory, (0, drizzle_orm_1.eq)(schema.products.id, schema.inventory.productId))
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.products.storeId, storeId), (0, drizzle_orm_1.lte)(schema.inventory.quantity, schema.inventory.minStock ?? 0)))
        .limit(limit);
      return lowStockProducts.map((p) => p.products);
    }
    catch (error) {
      return this.handleError(error, 'Getting products with low stock');
    }
  }
  async updateProductInventory(productId, quantity, reason) {
    try {
      const inventory = await database_1.default.query.inventory.findFirst({ _where: (0, drizzle_orm_1.eq)(schema.inventory.productId, productId) });
      if (!inventory)
        throw types_1.ProductServiceErrors.PRODUCT_NOT_FOUND;
      const newQuantity = inventory.quantity + quantity;
      if (newQuantity < 0)
        throw new Error('Insufficient stock');
      await database_1.default.update(schema.inventory).set({ _quantity: newQuantity }).where((0, drizzle_orm_1.eq)(schema.inventory.id, inventory.id));
      await database_1.default.insert(schema.inventoryTransactions).values({
        _inventoryId: inventory.id,
        quantity,
        _type: quantity > 0 ? 'in' : 'out',
        reason
      }).execute();
      return true;
    }
    catch (error) {
      return this.handleError(error, 'Updating product inventory');
    }
  }
}
exports.EnhancedProductService = EnhancedProductService;
exports.enhancedProductService = new EnhancedProductService();
