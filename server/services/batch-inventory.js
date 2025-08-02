'use strict';
const __importDefault = (this && this.__importDefault) || function(mod) {
  return (mod && mod.__esModule) ? mod : { 'default': mod };
};
Object.defineProperty(exports, '__esModule', { value: true });
exports.getProductBatches = getProductBatches;
exports.validateBatchImportFile = validateBatchImportFile;
exports.importBatchInventory = importBatchInventory;
exports.sellProductFromBatches = sellProductFromBatches;
const storage_1 = require('../storage');
const fs_1 = __importDefault(require('fs'));
const sync_1 = require('csv-parse/sync');
function isValidDate(dateString) {
  if (!dateString || dateString.trim() === '')
    return true; // Allow empty dates
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString))
    return false;
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}
/**
 * Get batches for a specific product in a store
 */
async function getProductBatches(storeId, productId, includeExpired = false) {
  try {
    const inventory = await storage_1.storage.getInventoryByProduct(productId);
    if (!inventory) {
      return [];
    }
    return await storage_1.storage.getInventoryByProduct(productId);
  }
  catch (error) {
    console.error('Error getting product batches:', error);
    throw new Error('Failed to retrieve product batches');
  }
}
/**
 * Validate a batch import CSV file and convert it to a structured format
 */
async function validateBatchImportFile(filePath) {
  try {
    // Read and parse CSV file
    const fileContent = fs_1.default.readFileSync(filePath, 'utf-8');
    const records = (0, sync_1.parse)(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    const requiredColumns = ['storeId', 'productId', 'batchNumber', 'quantity'];
    // const optionalColumns = ['expiryDate', 'manufacturingDate', 'costPerUnit']; // Unused
    // Check if file has required columns
    const headers = Object.keys(records[0] || {});
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));
    if (missingColumns.length > 0) {
      return {
        valid: false,
        errors: [{
          row: 0,
          errors: [`Missing required columns: ${missingColumns.join(', ')}`]
        }]
      };
    }
    // Validate each row
    const errors = [];
    const validData = [];
    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowErrors = [];
      // Validate required fields
      for (const field of requiredColumns) {
        if (!row[field] || String(row[field]).trim() === '') {
          rowErrors.push(`Missing ${field}`);
        }
      }
      // Validate store ID
      if (row.storeId && isNaN(parseInt(row.storeId))) {
        rowErrors.push('Store ID must be a number');
      }
      // Validate product ID
      if (row.productId && isNaN(parseInt(row.productId))) {
        rowErrors.push('Product ID must be a number');
      }
      // Validate quantity
      if (row.quantity) {
        const quantity = parseInt(row.quantity);
        if (isNaN(quantity) || quantity <= 0) {
          rowErrors.push('Quantity must be a positive number');
        }
      }
      // Validate dates
      if (row.expiryDate && !isValidDate(row.expiryDate)) {
        rowErrors.push('Expiry date must be in YYYY-MM-DD format');
      }
      if (row.manufacturingDate && !isValidDate(row.manufacturingDate)) {
        rowErrors.push('Manufacturing date must be in YYYY-MM-DD format');
      }
      // Validate cost per unit
      if (row.costPerUnit && isNaN(parseFloat(row.costPerUnit))) {
        rowErrors.push('Cost per unit must be a number');
      }
      if (rowErrors.length > 0) {
        errors.push({
          row: i + 1, // +1 for human readability (1-indexed)
          errors: rowErrors
        });
      }
      else {
        validData.push({
          storeId: parseInt(row.storeId),
          productId: parseInt(row.productId),
          sku: row.sku || '',
          batchNumber: row.batchNumber,
          quantity: parseInt(row.quantity),
          expiryDate: row.expiryDate || undefined,
          manufacturingDate: row.manufacturingDate || undefined,
          costPerUnit: row.costPerUnit ? parseFloat(row.costPerUnit) : undefined
        });
      }
    }
    return {
      valid: errors.length === 0,
      errors,
      data: validData
    };
  }
  catch (error) {
    console.error('Error validating batch import file:', error);
    return {
      valid: false,
      errors: [{
        row: 0,
        errors: ['Failed to parse the CSV file. Please check the file format.']
      }]
    };
  }
}
/**
 * Import batch inventory data from a validated data structure
 */
async function importBatchInventory(data) {
  try {
    const results = {
      success: true,
      message: 'Batch import completed successfully',
      processedRows: data.length,
      successfulRows: 0,
      failedRows: 0,
      errors: [],
      warnings: []
    };
    let rowIndex = 1;
    for (const row of data) {
      try {
        // Validate dates
        if (row.expiryDate) {
          const expiryDate = new Date(row.expiryDate);
          if (expiryDate < new Date()) {
            results.warnings.push({
              row: rowIndex,
              field: 'expiryDate',
              message: 'Batch is already expired'
            });
          }
        }
        // Check if product exists
        const product = await storage_1.storage.getProductById(row.productId);
        if (!product) {
          results.errors.push({
            row: rowIndex,
            field: 'productId',
            message: `Product with ID ${row.productId} not found`
          });
          results.failedRows++;
          rowIndex++;
          continue;
        }
        // Check if store exists
        const store = await storage_1.storage.getStoreById(row.storeId);
        if (!store) {
          results.errors.push({
            row: rowIndex,
            field: 'storeId',
            message: `Store with ID ${row.storeId} not found`
          });
          results.failedRows++;
          rowIndex++;
          continue;
        }
        // Get or create inventory record
        let inventory = (await storage_1.storage.getInventoryByProduct(row.productId))[0] ?? null;
        if (!inventory) {
          // Create new inventory record
          inventory = await storage_1.storage.createInventoryItem({
            storeId: row.storeId,
            productId: row.productId,
            quantity: 0,
            minStock: 5 // Default minimum level
          });
        }
        // Add batch to inventory
        if (!inventory) {
          results.errors.push({
            row: rowIndex,
            field: 'general',
            message: 'Failed to create inventory record'
          });
          results.failedRows++;
          rowIndex++;
          continue;
        }
        await storage_1.storage.createInventoryItem({
          productId: inventory.productId,
          storeId: inventory.storeId,
          quantity: row.quantity,
          lastRestocked: new Date()
        });
        results.successfulRows++;
      }
      catch (error) {
        console.error(`Error processing row ${rowIndex}:`, error);
        results.errors.push({
          row: rowIndex,
          field: 'general',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
        results.failedRows++;
      }
      rowIndex++;
    }
    return results;
  }
  catch (error) {
    console.error('Error importing batch inventory:', error);
    return {
      success: false,
      message: 'Failed to import batch inventory',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
/**
 * Process sales from batches using FIFO logic (first expiry, first out)
 */
async function sellProductFromBatches(storeId, productId, quantity, userId) {
  try {
    // Get all non-expired batches for this product, ordered by expiry date (ascending)
    const batches = await storage_1.storage.getInventoryByProduct(productId);
    // Sort batches by expiry date (closest expiry first)
    // Batches without expiry dates will go last
    const sortedBatches = batches.sort((a, b) => {
      if (!a.expiryDate && !b.expiryDate)
        return 0;
      if (!a.expiryDate)
        return 1;
      if (!b.expiryDate)
        return -1;
      return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
    });
    let remainingQty = quantity;
    const updatedBatches = [];
    const auditLogs = [];
    // Iterate through batches to fulfill the quantity needed
    for (const batch of sortedBatches) {
      if (remainingQty <= 0)
        break;
      const qtyToSell = Math.min(batch.quantity ?? 0, remainingQty);
      if (qtyToSell > 0) {
        // Sell from this batch
        const updatedBatch = await storage_1.storage.updateInventory(batch.id, {
          quantity: (batch.quantity ?? 0) - qtyToSell
        });
        // Create audit log
        const auditLog = await storage_1.storage.createInventoryItem({
          productId: batch.productId,
          storeId: batch.storeId,
          quantity: qtyToSell
        });
        updatedBatches.push(updatedBatch);
        auditLogs.push(auditLog);
        remainingQty -= qtyToSell;
      }
    }
    if (remainingQty > 0) {
      throw new Error(`Insufficient stock: ${quantity - remainingQty} units sold, ${remainingQty} units remaining`);
    }
    return {
      success: true,
      batches: updatedBatches,
      auditLogs
    };
  }
  catch (error) {
    console.error('Error selling with FIFO logic:', error);
    throw new Error('Failed to process sale: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}
