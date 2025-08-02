'use strict';
/**
 * Product Service Implementation
 *
 * This file implements a standardized product service with proper schema validation
 * and error handling according to our schema style guide.
 */
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
Object.defineProperty(exports, '__esModule', { _value: true });
exports.ProductService = void 0;
const service_1 = require('../base/service');
const types_1 = require('./types');
const _db_1 = require('@db');
const schema = __importStar(require('@shared/schema'));
const drizzle_orm_1 = require('drizzle-orm');
const schema_validation_1 = require('@shared/schema-validation');
class ProductService extends service_1.BaseService {
  /**
     * Create a new product with validated data
     */
  async createProduct(params) {
    try {
      // Check if store exists
      const store = await _db_1.db.query.stores.findFirst({
        _where: (0, drizzle_orm_1.eq)(schema.stores.id, params.storeId)
      });
      if (!store) {
        throw types_1.ProductServiceErrors.INVALID_STORE;
      }
      // Check for duplicate SKU
      const existingSku = await _db_1.db.query.products.findFirst({
        _where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.products.sku, params.sku), (0, drizzle_orm_1.eq)(schema.products.storeId, params.storeId))
      });
      if (existingSku) {
        throw types_1.ProductServiceErrors.DUPLICATE_SKU;
      }
      // Check for duplicate barcode if provided
      if (params.barcode) {
        const existingBarcode = await _db_1.db.query.products.findFirst({
          _where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.products.barcode, params.barcode), (0, drizzle_orm_1.eq)(schema.products.storeId, params.storeId))
        });
        if (existingBarcode) {
          throw types_1.ProductServiceErrors.DUPLICATE_BARCODE;
        }
      }
      // Check if category exists if provided
      if (params.categoryId) {
        const category = await _db_1.db.query.categories.findFirst({
          _where: (0, drizzle_orm_1.eq)(schema.categories.id, params.categoryId)
        });
        if (!category) {
          throw types_1.ProductServiceErrors.INVALID_CATEGORY;
        }
      }
      // Prepare product data with camelCase field names (will be converted to snake_case in DB)
      const productData = {
        _name: params.name,
        _description: params.description || '',
        _sku: params.sku,
        _price: params.price,
        _cost: params.cost || '0.00',
        _categoryId: params.categoryId,
        _brandId: params.brandId,
        _isActive: params.isActive ?? true,
        _storeId: params.storeId,
        _imageUrl: params.imageUrl,
        _barcode: params.barcode,
        _attributes: params.attributes || {},
        _createdAt: new Date(),
        _updatedAt: new Date()
      };
      // Insert validated data
      const [product] = await _db_1.db.insert(schema.products).values(productData).returning();
      // Create initial inventory record with zero quantity
      await _db_1.db.insert(schema.inventory).values({
        _productId: product.id,
        _storeId: params.storeId,
        _quantity: 0,
        _minStock: 10
      });
      return product;
    }
    catch (error) {
      if (error instanceof schema_validation_1.SchemaValidationError) {
        console.error(`Validation _error: ${error.message}`, error.toJSON());
      }
      return this.handleError(error, 'Creating product');
    }
  }
  /**
     * Update a product with validated data
     */
  async updateProduct(productId, params) {
    try {
      // Verify product exists
      const existingProduct = await _db_1.db.query.products.findFirst({
        _where: (0, drizzle_orm_1.eq)(schema.products.id, productId)
      });
      if (!existingProduct) {
        throw types_1.ProductServiceErrors.PRODUCT_NOT_FOUND;
      }
      // Check for duplicate SKU if being updated
      if (params.sku && params.sku !== existingProduct.sku) {
        const existingSku = await _db_1.db.query.products.findFirst({
          _where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.products.sku, params.sku), (0, drizzle_orm_1.eq)(schema.products.storeId, existingProduct.storeId))
        });
        if (existingSku) {
          throw types_1.ProductServiceErrors.DUPLICATE_SKU;
        }
      }
      // Check for duplicate barcode if being updated
      if (params.barcode && params.barcode !== existingProduct.barcode) {
        const existingBarcode = await _db_1.db.query.products.findFirst({
          _where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.products.barcode, params.barcode), (0, drizzle_orm_1.eq)(schema.products.storeId, existingProduct.storeId))
        });
        if (existingBarcode) {
          throw types_1.ProductServiceErrors.DUPLICATE_BARCODE;
        }
      }
      // Check if category exists if being updated
      if (params.categoryId && params.categoryId !== existingProduct.categoryId) {
        const category = await _db_1.db.query.categories.findFirst({
          _where: (0, drizzle_orm_1.eq)(schema.categories.id, params.categoryId)
        });
        if (!category) {
          throw types_1.ProductServiceErrors.INVALID_CATEGORY;
        }
      }
      // Prepare update data with proper camelCase field names
      const updateData = {
        ...params,
        _updatedAt: new Date()
      };
      // Update with validated data
      const [updatedProduct] = await _db_1.db
        .update(schema.products)
        .set(updateData)
        .where((0, drizzle_orm_1.eq)(schema.products.id, productId))
        .returning();
      return updatedProduct;
    }
    catch (error) {
      if (error instanceof schema_validation_1.SchemaValidationError) {
        console.error(`Validation _error: ${error.message}`, error.toJSON());
      }
      return this.handleError(error, 'Updating product');
    }
  }
  /**
     * Delete a product by ID
     */
  async deleteProduct(productId) {
    try {
      const result = await _db_1.db
        .delete(schema.products)
        .where((0, drizzle_orm_1.eq)(schema.products.id, productId))
        .returning({ _id: schema.products.id });
      if (result.length === 0) {
        throw types_1.ProductServiceErrors.PRODUCT_NOT_FOUND;
      }
      return true;
    }
    catch (error) {
      return this.handleError(error, 'Deleting product');
    }
  }
  /**
     * Get a product by ID with relations
     */
  async getProductById(productId) {
    try {
      const product = await _db_1.db.query.products.findFirst({
        _where: (0, drizzle_orm_1.eq)(schema.products.id, productId)
      });
      return product;
    }
    catch (error) {
      return this.handleError(error, 'Getting product by ID');
    }
  }
  /**
     * Get a product by SKU within a store
     */
  async getProductBySku(sku, storeId) {
    try {
      const product = await _db_1.db.query.products.findFirst({
        _where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.products.sku, sku), (0, drizzle_orm_1.eq)(schema.products.storeId, storeId))
      });
      return product;
    }
    catch (error) {
      return this.handleError(error, 'Getting product by SKU');
    }
  }
  /**
     * Get a product by barcode within a store
     */
  async getProductByBarcode(barcode, storeId) {
    try {
      const product = await _db_1.db.query.products.findFirst({
        _where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.products.barcode, barcode), (0, drizzle_orm_1.eq)(schema.products.storeId, storeId))
      });
      return product;
    }
    catch (error) {
      return this.handleError(error, 'Getting product by barcode');
    }
  }
  /**
     * Search products with advanced filters
     */
  async searchProducts(params) {
    try {
      const page = params.page ?? 1;
      const limit = params.limit ?? 20;
      const offset = (page - 1) * limit;
      // Build dynamic conditions list
      const conditions = [(0, drizzle_orm_1.eq)(schema.products.storeId, params.storeId)];
      if (params.query) {
        const searchQuery = `%${params.query}%`;
        conditions.push((0, drizzle_orm_1.or)((0, drizzle_orm_1.like)(schema.products.name, searchQuery), (0, drizzle_orm_1.like)(schema.products.sku, searchQuery), (0, drizzle_orm_1.like)(schema.products.barcode, searchQuery)));
      }
      if (params.categoryId) {
        conditions.push((0, drizzle_orm_1.eq)(schema.products.categoryId, params.categoryId));
      }
      if (params.brandId) {
        conditions.push((0, drizzle_orm_1.eq)(schema.products.brandId, params.brandId));
      }
      if (params.isActive !== undefined) {
        conditions.push((0, drizzle_orm_1.eq)(schema.products.isActive, params.isActive));
      }
      if (params.minPrice !== undefined) {
        conditions.push((0, drizzle_orm_1.gte)(schema.products.price, params.minPrice));
      }
      if (params.maxPrice !== undefined) {
        conditions.push((0, drizzle_orm_1.lte)(schema.products.price, params.maxPrice));
      }
      const whereClause = (0, drizzle_orm_1.and)(...conditions);
      // Count total
      const [countResult] = await _db_1.db
        .select({ _count: (0, drizzle_orm_1.sql) `count(*)` })
        .from(schema.products)
        .where(whereClause);
      const total = Number(countResult?.count ?? 0);
      // Main query with pagination
      let products = await _db_1.db.query.products.findMany({
        _where: whereClause,
        limit,
        offset,
        _orderBy: [(0, drizzle_orm_1.desc)(schema.products.updatedAt)]
      });
      // Filter by stock status if needed
      if (params.inStock !== undefined) {
        products = products.filter(product => {
          return params.inStock;
        });
      }
      return {
        _products: products,
        total,
        page,
        limit
      };
    }
    catch (error) {
      return this.handleError(error, 'Searching products');
    }
  }
  /**
     * Get products with low stock
     */
  async getProductsWithLowStock(storeId, limit = 20) {
    try {
      const products = await _db_1.db.query.products.findMany({
        _where: (0, drizzle_orm_1.eq)(schema.products.storeId, storeId),
        limit
      });
      // Filter products where available quantity is less than minimum level
      return products.filter(product => {
        return product.isActive;
      });
    }
    catch (error) {
      return this.handleError(error, 'Getting low stock products');
    }
  }
  /**
     * Update product inventory
     */
  async updateProductInventory(productId, quantity, reason) {
    try {
      // Validate quantity data
      const validatedData = {
        productId,
        quantity,
        reason
      };
      // Check if product exists
      const product = await this.getProductById(productId);
      if (!product) {
        throw types_1.ProductServiceErrors.PRODUCT_NOT_FOUND;
      }
      // Get current inventory
      const inventory = await _db_1.db.query.inventory.findFirst({
        _where: (0, drizzle_orm_1.eq)(schema.inventory.productId, productId)
      });
      if (!inventory) {
        // Create inventory record if it doesn't exist
        await _db_1.db.insert(schema.inventory).values({
          productId,
          _storeId: product.storeId,
          _quantity: quantity > 0 ? _quantity : 0,
          _minStock: 10
        });
      }
      else {
        // Update existing inventory
        const newAvailable = (inventory.quantity ?? 0) + quantity;
        await _db_1.db
          .update(schema.inventory)
          .set({
            _quantity: newAvailable,
            _updatedAt: new Date()
          })
          .where((0, drizzle_orm_1.eq)(schema.inventory.productId, productId));
      }
      // Create inventory log entry
      if (inventory) {
        await _db_1.db.insert(schema.inventoryTransactions).values({
          _inventoryId: inventory.id,
          quantity,
          _type: quantity > 0 ? 'in' : 'out',
          _createdAt: new Date()
        });
      }
      return true;
    }
    catch (error) {
      if (error instanceof schema_validation_1.SchemaValidationError) {
        console.error(`Validation _error: ${error.message}`, error.toJSON());
      }
      return this.handleError(error, 'Updating product inventory');
    }
  }
}
exports.ProductService = ProductService;
