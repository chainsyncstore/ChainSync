'use strict';
const __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  let desc = Object.getOwnPropertyDescriptor(m, k);
  if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
    desc = { enumerable: true, get: function() { return m[k]; } };
  }
  Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  o[k2] = m[k];
}));
const __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
  Object.defineProperty(o, 'default', { enumerable: true, value: v });
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
Object.defineProperty(exports, '__esModule', { value: true });
exports.validateProductImportCSV = validateProductImportCSV;
exports.importProducts = importProducts;
const csv_parse_1 = require('csv-parse');
const db_1 = require('../../db');
const drizzle_orm_1 = require('drizzle-orm');
const schema = __importStar(require('../../shared/schema'));
const schema_1 = require('../../shared/schema');
async function validateProductImportCSV(csvContent, storeId) {
  return new Promise((resolve, reject) => {
    const validProducts = [];
    const summary = {
      totalRows: 0,
      processedRows: 0,
      skippedRows: 0,
      newCategories: [],
      errors: []
    };
    // Store category mapping (name -> id) to avoid duplicate lookups
    const categoryCache = {};
    // Parse CSV
    (0, csv_parse_1.parse)(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    }, async(err, records) => {
      if (err) {
        return reject(new Error(`Failed to parse CSV: ${err.message}`));
      }
      summary.totalRows = records.length;
      try {
        // Fetch all existing categories for comparison
        const existingCategories = await db_1.db.query.categories.findMany();
        existingCategories.forEach(category => {
          categoryCache[category.name.toLowerCase()] = category.id;
        });
        // Process each row
        for (let i = 0; i < records.length; i++) {
          const row = records[i];
          const rowIndex = i + 2; // +2 because 1-indexed and row 1 is headers
          // Validate required fields
          if (!row['Product Name'] || !row['Product Name'].trim()) {
            summary.errors.push({
              row: rowIndex,
              field: 'Product Name',
              value: row['Product Name'] || '',
              message: 'Product name is required'
            });
            summary.skippedRows++;
            continue;
          }
          if (!row['SKU'] || !row['SKU'].trim()) {
            summary.errors.push({
              row: rowIndex,
              field: 'SKU',
              value: row['SKU'] || '',
              message: 'SKU is required'
            });
            summary.skippedRows++;
            continue;
          }
          if (!row['Price'] || isNaN(parseFloat(row['Price']))) {
            summary.errors.push({
              row: rowIndex,
              field: 'Price',
              value: row['Price'] || '',
              message: 'Price must be a valid number'
            });
            summary.skippedRows++;
            continue;
          }
          if (!row['Stock'] || isNaN(parseInt(row['Stock']))) {
            summary.errors.push({
              row: rowIndex,
              field: 'Stock',
              value: row['Stock'] || '',
              message: 'Stock must be a valid number'
            });
            summary.skippedRows++;
            continue;
          }
          // Validate category and create if needed
          const categoryName = row['Category'] ? row['Category'].trim() : 'Uncategorized';
          let categoryId;
          if (categoryCache[categoryName.toLowerCase()]) {
            // Category exists, use cached ID
            categoryId = categoryCache[categoryName.toLowerCase()];
          }
          else {
            // Create new category
            try {
              const insertedCategory = await db_1.db.insert(schema_1.categories)
                .values({ name: categoryName })
                .returning();
              if (insertedCategory && insertedCategory[0]) {
                categoryId = insertedCategory[0].id;
                categoryCache[categoryName.toLowerCase()] = categoryId;
                summary.newCategories.push(categoryName);
              }
              else {
                // Fallback to Uncategorized if insertion failed
                if (categoryCache['uncategorized']) {
                  categoryId = categoryCache['uncategorized'];
                }
                else {
                  // Create Uncategorized category
                  const uncategorized = await db_1.db.insert(schema_1.categories)
                    .values({ name: 'Uncategorized' })
                    .returning();
                  categoryId = uncategorized[0].id;
                  categoryCache['uncategorized'] = categoryId;
                  summary.newCategories.push('Uncategorized');
                }
              }
            }
            catch (error) {
              console.error(`Error creating category '${categoryName}':`, error);
              summary.errors.push({
                row: rowIndex,
                field: 'Category',
                value: categoryName,
                message: `Failed to create category: ${error.message}`
              });
              summary.skippedRows++;
              continue;
            }
          }
          // Validate expiry date if provided
          let expiryDate = null;
          if (row['Expiry Date'] && row['Expiry Date'].trim()) {
            try {
              expiryDate = new Date(row['Expiry Date']);
              if (isNaN(expiryDate.getTime())) {
                throw new Error('Invalid date format');
              }
            }
            catch (error) {
              summary.errors.push({
                row: rowIndex,
                field: 'Expiry Date',
                value: row['Expiry Date'],
                message: 'Invalid date format. Use YYYY-MM-DD format.'
              });
              // Don't skip the row, just leave expiryDate as null
            }
          }
          // Validate cost price if provided
          if (row['Cost Price'] && isNaN(parseFloat(row['Cost Price']))) {
            summary.errors.push({
              row: rowIndex,
              field: 'Cost Price',
              value: row['Cost Price'],
              message: 'Cost price must be a valid number'
            });
            // Don't skip, just don't include cost price
          }
          // Create validated product object
          const validProduct = {
            name: row['Product Name'].trim(),
            sku: row['SKU'].trim(),
            categoryId,
            price: parseFloat(row['Price']).toFixed(2),
            stock: parseInt(row['Stock']),
            expiryDate,
            description: row['Description'] ? row['Description'].trim() : undefined,
            barcode: row['Barcode'] ? row['Barcode'].trim() : undefined,
            imageUrl: row['Image URL'] ? row['Image URL'].trim() : undefined,
            supplier: row['Supplier'] ? row['Supplier'].trim() : undefined,
            costPrice: row['Cost Price'] && !isNaN(parseFloat(row['Cost Price'])) ?
              parseFloat(row['Cost Price']).toFixed(2) : undefined
          };
          validProducts.push(validProduct);
          summary.processedRows++;
        }
        resolve({ validProducts, summary });
      }
      catch (error) {
        reject(error);
      }
    });
  });
}
async function importProducts(validProducts, storeId) {
  const importedCount = 0;
  const failedProducts = [];
  try {
    // Insert products in batches to avoid overwhelming the database
    const BATCH_SIZE = 50;
    for (let i = 0; i < validProducts.length; i += BATCH_SIZE) {
      const batch = validProducts.slice(i, i + BATCH_SIZE);
      // Process each product in the batch
      for (const product of batch) {
        try {
          // Check if product with SKU already exists
          const existingProduct = await db_1.db.query.products.findFirst({
            where: (0, drizzle_orm_1.eq)(schema.products.sku, product.sku)
          });
          if (existingProduct) {
            // Update existing product
            await db_1.db.update(schema.products)
              .set({
                name: product.name,
                categoryId: product.categoryId,
                price: product.price,
                description: product.description || existingProduct.description,
                imageUrl: product.imageUrl || existingProduct.imageUrl,
                barcode: product.barcode || existingProduct.barcode,
                updatedAt: new Date()
                // Don't update SKU as we're using it as the identifier
              })
              .where((0, drizzle_orm_1.eq)(schema.products.id, existingProduct.id));
            // Update or create inventory for this store and product
            const inventory = await db_1.db.query.inventory.findFirst({
              where: (inventory) => (0, drizzle_orm_1.eq)(inventory.productId, existingProduct.id) &&
                                (0, drizzle_orm_1.eq)(inventory.storeId, storeId)
            });
            if (inventory) {
              // Update existing inventory
              await db_1.db.update(schema.inventory)
                .set({
                  quantity: product.stock,
                  updatedAt: new Date()
                })
                .where((0, drizzle_orm_1.eq)(schema.inventory.id, inventory.id));
            }
            else {
              // Create new inventory entry
              await db_1.db.insert(schema.inventory)
                .values({
                  productId: existingProduct.id,
                  storeId,
                  quantity: product.stock
                });
            }
          }
          else {
            // Insert new product
            const [insertedProduct] = await db_1.db.insert(schema.products)
              .values({
                name: product.name,
                sku: product.sku,
                storeId,
                categoryId: product.categoryId,
                price: product.price,
                description: product.description,
                barcode: product.barcode,
                imageUrl: product.imageUrl
              })
              .returning();
            if (insertedProduct) {
              // Create inventory for this store and product
              await db_1.db.insert(schema.inventory)
                .values({
                  productId: insertedProduct.id,
                  storeId,
                  quantity: product.stock
                });
            }
          }
        }
        catch (error) {
          console.error(`Error importing product '${product.name}':`, error);
          failedProducts.push({
            product,
            error: error.message
          });
          continue;
        }
      }
    }
    return {
      success: true,
      importedCount: validProducts.length - failedProducts.length,
      failedProducts
    };
  }
  catch (error) {
    console.error('Error bulk importing products:', error);
    return {
      success: false,
      importedCount: validProducts.length - failedProducts.length,
      failedProducts: [
        ...failedProducts,
        ...validProducts.map(product => ({
          product,
          error: 'Bulk import failed'
        }))
      ]
    };
  }
}
