import { parse } from 'csv-parse';
import { db } from '../../db/index.js';
import { eq } from 'drizzle-orm';
import * as schema from '../../shared/schema.js';
import { categories } from '../../shared/schema.js';
import { AppError, ErrorCode, ErrorCategory } from '../../shared/types/errors.js';
import { logError } from '../../shared/utils/error-logger.js';

interface ProductImportRow {
  'Product Name': string;
  'SKU': string;
  'Category': string;
  'Price': string;
  'Stock': string;
  'Expiry Date'?: string;
  'Description'?: string;
  'Barcode'?: string;
  'Image URL'?: string;
  'Supplier'?: string;
  'Cost Price'?: string;
}

interface ValidatedProduct {
  name: string;
  sku: string;
  categoryId: number;
  price: string;
  stock: number;
  expiryDate?: Date | null;
  description?: string;
  barcode?: string;
  imageUrl?: string;
  supplier?: string;
  costPrice?: string;
}

interface ValidationError {
  row: number;
  field: string;
  value: string;
  message: string;
}

interface ImportSummary {
  totalRows: number;
  processedRows: number;
  skippedRows: number;
  newCategories: string[];
  errors: ValidationError[];
}

/**
 * Comprehensive error handling for CSV parsing
 */
function handleCSVParseError(error: Error, csvContent: string): never {
  logError(error, 'CSV parsing failed');
  
  if (error.message.includes('Invalid CSV')) {
    throw new AppError(
      'Invalid CSV format. Please check your file and try again.',
      ErrorCategory.INVALID_FORMAT,
      ErrorCode.INVALID_IMPORT_FILE,
      { originalError: error.message },
      400
    );
  }
  
  if (error.message.includes('Unexpected end')) {
    throw new AppError(
      'CSV file appears to be incomplete or corrupted.',
      ErrorCategory.INVALID_FORMAT,
      ErrorCode.INVALID_IMPORT_FILE,
      { originalError: error.message },
      400
    );
  }
  
  throw new AppError(
    'Failed to parse CSV file. Please ensure the file is properly formatted.',
    ErrorCategory.PROCESSING,
    ErrorCode.IMPORT_FAILED,
    { originalError: error.message },
    500
  );
}

/**
 * Validate and sanitize product data
 */
function validateProductData(row: ProductImportRow, rowIndex: number): ValidatedProduct | null {
  const errors: ValidationError[] = [];
  
  // Validate required fields
  if (!row['Product Name']?.trim()) {
    errors.push({
      row: rowIndex,
      field: 'Product Name',
      value: row['Product Name'] || '',
      message: 'Product name is required'
    });
  }
  
  if (!row['SKU']?.trim()) {
    errors.push({
      row: rowIndex,
      field: 'SKU',
      value: row['SKU'] || '',
      message: 'SKU is required'
    });
  }
  
  if (!row['Price'] || isNaN(parseFloat(row['Price']))) {
    errors.push({
      row: rowIndex,
      field: 'Price',
      value: row['Price'] || '',
      message: 'Price must be a valid number'
    });
  }
  
  if (!row['Stock'] || isNaN(parseInt(row['Stock']))) {
    errors.push({
      row: rowIndex,
      field: 'Stock',
      value: row['Stock'] || '',
      message: 'Stock must be a valid number'
    });
  }
  
  // If there are validation errors, throw them
  if (errors.length > 0) {
    throw new AppError(
      `Validation errors in row ${rowIndex}`,
      ErrorCategory.VALIDATION,
      ErrorCode.VALIDATION_ERROR,
      { validationErrors: errors },
      400
    );
  }
  
  // Validate optional fields
  let expiryDate: Date | null = null;
  if (row['Expiry Date']?.trim()) {
    try {
      expiryDate = new Date(row['Expiry Date']);
      if (isNaN(expiryDate.getTime())) {
        throw new Error('Invalid date format');
      }
    } catch (error) {
      errors.push({
        row: rowIndex,
        field: 'Expiry Date',
        value: row['Expiry Date'],
        message: 'Invalid date format. Use YYYY-MM-DD format.'
      });
    }
  }
  
  if (row['Cost Price'] && isNaN(parseFloat(row['Cost Price']))) {
    errors.push({
      row: rowIndex,
      field: 'Cost Price',
      value: row['Cost Price'],
      message: 'Cost price must be a valid number'
    });
  }
  
  // Return null if there are validation errors
  if (errors.length > 0) {
    return null;
  }
  
  // Return validated product data
  return {
    name: row['Product Name']?.trim() || '',
    sku: row['SKU']?.trim() || '',
    categoryId: 0, // Will be set later
    price: parseFloat(row['Price'] || '0').toFixed(2),
    stock: parseInt(row['Stock'] || '0'),
    expiryDate,
    ...(row['Description']?.trim() && { description: row['Description'].trim() }),
    ...(row['Barcode']?.trim() && { barcode: row['Barcode'].trim() }),
    ...(row['Image URL']?.trim() && { imageUrl: row['Image URL'].trim() }),
    ...(row['Supplier']?.trim() && { supplier: row['Supplier'].trim() }),
    ...(row['Cost Price'] && !isNaN(parseFloat(row['Cost Price'])) && 
        { costPrice: parseFloat(row['Cost Price']).toFixed(2) })
  };
}

/**
 * Handle category creation with proper error handling
 */
async function handleCategoryCreation(
  categoryName: string, 
  categoryCache: Record<string, number>,
  summary: ImportSummary
): Promise<number> {
  try {
    const insertedCategory = await db.insert(categories)
      .values({ name: categoryName })
      .returning();

    if (insertedCategory && insertedCategory[0]) {
      const categoryId = insertedCategory[0].id as number;
      categoryCache[categoryName.toLowerCase()] = categoryId;
      summary.newCategories.push(categoryName);
      return categoryId;
    }
    
    throw new Error('Category insertion failed - no ID returned');
  } catch (error) {
    logError(error as Error, `Failed to create category: ${categoryName}`);
    
    // Try to use Uncategorized as fallback
    if (categoryCache['uncategorized']) {
      return categoryCache['uncategorized'];
    }
    
    // Create Uncategorized category as final fallback
    try {
      const uncategorized = await db.insert(categories)
        .values({ name: 'Uncategorized' })
        .returning();
      
      if (uncategorized && uncategorized[0]) {
        const categoryId = uncategorized[0].id as number;
        categoryCache['uncategorized'] = categoryId;
        summary.newCategories.push('Uncategorized');
        return categoryId;
      }
    } catch (fallbackError) {
      logError(fallbackError as Error, 'Failed to create Uncategorized category');
      throw new AppError(
        'Failed to create category and fallback category creation also failed',
        ErrorCategory.DATABASE,
        ErrorCode.DATABASE_ERROR,
        { 
          originalError: (error as Error).message,
          fallbackError: (fallbackError as Error).message 
        },
        500
      );
    }
    
    throw new AppError(
      `Failed to create category '${categoryName}'`,
      ErrorCategory.DATABASE,
      ErrorCode.DATABASE_ERROR,
      { originalError: (error as Error).message },
      500
    );
  }
}

export async function validateProductImportCSV(
  csvContent: string,
  storeId: number
): Promise<{
  validProducts: ValidatedProduct[];
  summary: ImportSummary;
}> {
  return new Promise((resolve, reject) => {
    const validProducts: ValidatedProduct[] = [];
    const summary: ImportSummary = {
      totalRows: 0,
      processedRows: 0,
      skippedRows: 0,
      newCategories: [],
      errors: []
    };

    // Store category mapping (name -> id) to avoid duplicate lookups
    const categoryCache: Record<string, number> = {};

    // Parse CSV with comprehensive error handling
    parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    }, async(err, records: ProductImportRow[]) => {
      if (err) {
        return reject(handleCSVParseError(err, csvContent));
      }

      summary.totalRows = records.length;

      try {
        // Fetch all existing categories for comparison
        const existingCategories = await db.query.categories.findMany();
        existingCategories.forEach(category => {
          categoryCache[(category.name as string).toLowerCase()] = category.id as number;
        });

        // Process each row with comprehensive error handling
        for (let i = 0; i < records.length; i++) {
          const row = records[i];
          const rowIndex = i + 2; // +2 because 1-indexed and row 1 is headers

          try {
            // Add null check for row
            if (!row) {
              summary.errors.push({
                row: rowIndex,
                field: 'General',
                value: '',
                message: 'Row is empty or undefined'
              });
              summary.skippedRows++;
              continue;
            }

            // Validate product data
            const validatedProduct = validateProductData(row, rowIndex);
            if (!validatedProduct) {
              summary.skippedRows++;
              continue;
            }

            // Handle category assignment
            const categoryName = row['Category'] ? row['Category'].trim() : 'Uncategorized';
            let categoryId: number;

            if (categoryCache[categoryName.toLowerCase()]) {
              // Category exists, use cached ID
              categoryId = categoryCache[categoryName.toLowerCase()] || 0;
            } else {
              // Create new category
              categoryId = await handleCategoryCreation(categoryName, categoryCache, summary);
            }

            // Assign category ID to validated product
            validatedProduct.categoryId = categoryId;
            validProducts.push(validatedProduct);
            summary.processedRows++;

          } catch (error) {
            if (error instanceof AppError) {
              // Handle validation errors
              if (error.validationErrors) {
                summary.errors.push(...error.validationErrors);
                summary.skippedRows++;
              } else {
                // Re-throw other AppErrors
                throw error;
              }
            } else {
              // Log unexpected errors and continue
              logError(error as Error, `Unexpected error processing row ${rowIndex}`);
              summary.errors.push({
                row: rowIndex,
                field: 'General',
                value: '',
                message: `Unexpected error: ${(error as Error).message}`
              });
              summary.skippedRows++;
            }
          }
        }

        resolve({ validProducts, summary });
      } catch (error) {
        reject(error);
      }
    });
  });
}

export async function importProducts(
  validProducts: ValidatedProduct[],
  storeId: number
): Promise<{
  success: boolean;
  importedCount: number;
  failedProducts: Array<{product: ValidatedProduct; error: string}>;
}> {
  let importedCount = 0;
  const failedProducts: Array<{product: ValidatedProduct; error: string}> = [];

  try {
    // Insert products in batches to avoid overwhelming the database
    const BATCH_SIZE = 50;
    for (let i = 0; i < validProducts.length; i += BATCH_SIZE) {
      const batch = validProducts.slice(i, i + BATCH_SIZE);

      // Process each product in the batch
      for (const product of batch) {
        try {
          // Check if product with SKU already exists
          const existingProduct = await db.query.products.findFirst({
            where: eq(schema.products.sku, product.sku)
          });

          if (existingProduct) {
            // Update existing product
            await db.update(schema.products)
              .set({
                name: product.name,
                price: product.price,
                sku: existingProduct.sku
              })
              .where(eq(schema.products.id, existingProduct.id));

            // Update or create inventory for this store and product
            const inventory = await db.query.inventory.findFirst({
              where: (inventory) =>
                eq(inventory.productId, existingProduct.id) &&
                eq(inventory.storeId, storeId)
            });

            if (inventory) {
              // Update existing inventory
              await db.update(schema.inventory)
                .set({
                  storeId: inventory.storeId
                })
                .where(eq(schema.inventory.id, inventory.id));
            } else {
              // Create new inventory entry
              await db.insert(schema.inventory)
                .values({
                  productId: existingProduct.id,
                  storeId
                });
            }
          } else {
            // Insert new product
            const [insertedProduct] = await db.insert(schema.products)
              .values({
                name: product.name,
                sku: product.sku,
                storeId,
                price: product.price
              })
              .returning();

            if (insertedProduct) {
              // Create inventory for this store and product
              await db.insert(schema.inventory)
                .values({
                  productId: insertedProduct.id,
                  storeId,
                  availableQuantity: product.stock
                } as any);
            }
          }
          
          importedCount++;
        } catch (error) {
          logError(error as Error, `Error importing product '${product.name}'`);
          failedProducts.push({
            product,
            error: (error as Error).message
          });
          continue;
        }
      }
    }

    return {
      success: true,
      importedCount,
      failedProducts
    };
  } catch (error) {
    logError(error as Error, 'Bulk import failed');
    return {
      success: false,
      importedCount,
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
