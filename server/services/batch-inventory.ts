import { parse } from 'csv-parse/sync';
import { storage } from '../storage';
import * as schema from '@shared/schema';
import { db } from '@db';
import { eq, and } from 'drizzle-orm';
import * as fs from 'fs';

interface BatchImportData {
  product_name: string;
  sku: string;
  category: string;
  batch_id: string;
  quantity: string;
  expiry_date?: string;
  unit_price?: string;
  store_id: string;
  manufacturing_date?: string;
}

interface ValidationError {
  row: number;
  errors: string[];
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  data: BatchImportData[];
}

interface ImportResult {
  success: boolean;
  message: string;
  errors?: string[];
  results?: {
    imported: number;
    failed: number;
  };
}

/**
 * Parse and validate a CSV file for batch inventory import
 * @param filePath Path to the CSV file
 */
export async function validateBatchImportFile(filePath: string): Promise<ValidationResult> {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    const requiredFields = ['product_name', 'sku', 'batch_id', 'quantity', 'store_id'];
    const errors: ValidationError[] = [];
    const validRecords: BatchImportData[] = [];

    records.forEach((record: any, index: number) => {
      const rowErrors: string[] = [];

      // Check required fields
      requiredFields.forEach(field => {
        if (!record[field] || record[field].trim() === '') {
          rowErrors.push(`Missing required field: ${field}`);
        }
      });

      // Validate quantity is a positive number
      if (record.quantity && !/^\d+$/.test(record.quantity)) {
        rowErrors.push('Quantity must be a positive number');
      } else if (record.quantity && parseInt(record.quantity) <= 0) {
        rowErrors.push('Quantity must be greater than zero');
      }

      // Validate expiry_date format if present
      if (record.expiry_date && !isValidDate(record.expiry_date)) {
        rowErrors.push('Invalid expiry date format (should be YYYY-MM-DD)');
      }

      // Validate manufacturing_date format if present
      if (record.manufacturing_date && !isValidDate(record.manufacturing_date)) {
        rowErrors.push('Invalid manufacturing date format (should be YYYY-MM-DD)');
      }

      // Validate unit_price is a valid decimal if present
      if (record.unit_price && !/^\d+(\.\d{1,2})?$/.test(record.unit_price)) {
        rowErrors.push('Unit price must be a valid decimal number (e.g., 10.99)');
      }

      // Validate store_id is a number
      if (record.store_id && !/^\d+$/.test(record.store_id)) {
        rowErrors.push('Store ID must be a number');
      }

      if (rowErrors.length > 0) {
        errors.push({
          row: index + 2, // +2 because index is 0-based and we have a header row
          errors: rowErrors
        });
      } else {
        validRecords.push(record as BatchImportData);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      data: validRecords
    };
  } catch (error) {
    console.error('Error validating batch import file:', error);
    return {
      valid: false,
      errors: [{
        row: 0,
        errors: ['Failed to parse CSV file. Make sure it has the correct format.']
      }],
      data: []
    };
  }
}

/**
 * Import batch inventory data from validated records
 * @param data Validated batch data records
 */
export async function importBatchInventory(data: BatchImportData[]): Promise<ImportResult> {
  let imported = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const record of data) {
    try {
      // Find or create product
      let product = await db.query.products.findFirst({
        where: and(
          eq(schema.products.sku, record.sku)
        )
      });

      if (!product) {
        // Find or create category
        let category = await db.query.categories.findFirst({
          where: eq(schema.categories.name, record.category)
        });

        if (!category) {
          const [newCategory] = await db.insert(schema.categories)
            .values({ name: record.category })
            .returning();
          category = newCategory;
        }

        // Create product
        const [newProduct] = await db.insert(schema.products)
          .values({
            name: record.product_name,
            sku: record.sku,
            price: record.unit_price || '0',
            categoryId: category.id
          })
          .returning();
        product = newProduct;
      }

      // Find or create inventory
      let inventory = await storage.getStoreProductInventory(
        parseInt(record.store_id),
        product.id
      );

      if (!inventory) {
        inventory = await storage.createInventory({
          storeId: parseInt(record.store_id),
          productId: product.id,
          totalQuantity: 0,
          minimumLevel: 5
        });
      }

      // Create batch
      await storage.createInventoryBatch({
        inventoryId: inventory.id,
        batchNumber: record.batch_id,
        quantity: parseInt(record.quantity),
        expiryDate: record.expiry_date || null,
        receivedDate: new Date().toISOString(),
        manufacturingDate: record.manufacturing_date || null,
        costPerUnit: record.unit_price || null
      });

      // Update inventory total quantity
      await storage.updateInventoryTotalQuantity(inventory.id);
      
      imported++;
    } catch (error) {
      failed++;
      errors.push(`Row with product ${record.product_name} (SKU: ${record.sku}): ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  if (failed === 0) {
    return {
      success: true,
      message: `Successfully imported ${imported} batch records.`,
      results: { imported, failed }
    };
  } else {
    return {
      success: imported > 0,
      message: `Imported ${imported} records with ${failed} failures.`,
      errors,
      results: { imported, failed }
    };
  }
}

/**
 * Check if a string is a valid date in YYYY-MM-DD format
 */
function isValidDate(dateString: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false;
  
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

/**
 * Get batches for a specific product in a store
 */
export async function getProductBatches(storeId: number, productId: number, includeExpired: boolean = false) {
  try {
    const inventory = await storage.getStoreProductInventory(storeId, productId);
    if (!inventory) {
      return [];
    }
    
    return await storage.getInventoryBatchesByProduct(storeId, productId, includeExpired);
  } catch (error) {
    console.error('Error getting product batches:', error);
    throw new Error('Failed to retrieve product batches');
  }
}