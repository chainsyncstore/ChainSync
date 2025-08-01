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
  _name: string;
  _sku: string;
  _categoryId: number;
  _price: string;
  _stock: number;
  expiryDate?: Date | null;
  description?: string;
  barcode?: string;
  imageUrl?: string;
  supplier?: string;
  costPrice?: string;
}

interface ValidationError {
  _row: number;
  _field: string;
  _value: string;
  _message: string;
}

interface ImportSummary {
  _totalRows: number;
  _processedRows: number;
  _skippedRows: number;
  _newCategories: string[];
  _errors: ValidationError[];
}

/**
 * Comprehensive error handling for CSV parsing
 */
function handleCSVParseError(_error: Error, _csvContent: string): never {
  logError(error, 'CSV parsing failed');

  if (error.message.includes('Invalid CSV')) {
    throw new AppError(
      'Invalid CSV format. Please check your file and try again.',
      ErrorCategory.INVALID_FORMAT,
      ErrorCode.INVALID_IMPORT_FILE,
      { _originalError: error.message },
      400
    );
  }

  if (error.message.includes('Unexpected end')) {
    throw new AppError(
      'CSV file appears to be incomplete or corrupted.',
      ErrorCategory.INVALID_FORMAT,
      ErrorCode.INVALID_IMPORT_FILE,
      { _originalError: error.message },
      400
    );
  }

  throw new AppError(
    'Failed to parse CSV file. Please ensure the file is properly formatted.',
    ErrorCategory.PROCESSING,
    ErrorCode.IMPORT_FAILED,
    { _originalError: error.message },
    500
  );
}

/**
 * Validate and sanitize product data
 */
function validateProductData(_row: ProductImportRow, _rowIndex: number): ValidatedProduct | null {
  const _errors: ValidationError[] = [];

  // Validate required fields
  if (!row['Product Name']?.trim()) {
    errors.push({
      _row: rowIndex,
      _field: 'Product Name',
      _value: row['Product Name'] || '',
      _message: 'Product name is required'
    });
  }

  if (!row['SKU']?.trim()) {
    errors.push({
      _row: rowIndex,
      _field: 'SKU',
      _value: row['SKU'] || '',
      _message: 'SKU is required'
    });
  }

  if (!row['Price'] || isNaN(parseFloat(row['Price']))) {
    errors.push({
      _row: rowIndex,
      _field: 'Price',
      _value: row['Price'] || '',
      _message: 'Price must be a valid number'
    });
  }

  if (!row['Stock'] || isNaN(parseInt(row['Stock']))) {
    errors.push({
      _row: rowIndex,
      _field: 'Stock',
      _value: row['Stock'] || '',
      _message: 'Stock must be a valid number'
    });
  }

  // If there are validation errors, throw them
  if (errors.length > 0) {
    throw new AppError(
      `Validation errors in row ${rowIndex}`,
      ErrorCategory.VALIDATION,
      ErrorCode.VALIDATION_ERROR,
      { _validationErrors: errors },
      400
    );
  }

  // Validate optional fields
  const _expiryDate: Date | null = null;
  if (row['Expiry Date']?.trim()) {
    try {
      expiryDate = new Date(row['Expiry Date']);
      if (isNaN(expiryDate.getTime())) {
        throw new Error('Invalid date format');
      }
    } catch (error) {
      errors.push({
        _row: rowIndex,
        _field: 'Expiry Date',
        _value: row['Expiry Date'],
        _message: 'Invalid date format. Use YYYY-MM-DD format.'
      });
    }
  }

  if (row['Cost Price'] && isNaN(parseFloat(row['Cost Price']))) {
    errors.push({
      _row: rowIndex,
      _field: 'Cost Price',
      _value: row['Cost Price'],
      _message: 'Cost price must be a valid number'
    });
  }

  // Return null if there are validation errors
  if (errors.length > 0) {
    return null;
  }

  // Return validated product data
  return {
    _name: row['Product Name']?.trim() || '',
    _sku: row['SKU']?.trim() || '',
    _categoryId: 0, // Will be set later
    _price: parseFloat(row['Price'] || '0').toFixed(2),
    _stock: parseInt(row['Stock'] || '0'),
    expiryDate,
    ...(row['Description']?.trim() && { _description: row['Description'].trim() }),
    ...(row['Barcode']?.trim() && { _barcode: row['Barcode'].trim() }),
    ...(row['Image URL']?.trim() && { _imageUrl: row['Image URL'].trim() }),
    ...(row['Supplier']?.trim() && { _supplier: row['Supplier'].trim() }),
    ...(row['Cost Price'] && !isNaN(parseFloat(row['Cost Price'])) &&
        { _costPrice: parseFloat(row['Cost Price']).toFixed(2) })
  };
}

/**
 * Handle category creation with proper error handling
 */
async function handleCategoryCreation(
  _categoryName: string,
  _categoryCache: Record<string, number>,
  _summary: ImportSummary
): Promise<number> {
  try {
    const insertedCategory = await db.insert(categories)
      .values({ _name: categoryName })
      .returning();

    if (insertedCategory && insertedCategory[0]) {
      const categoryId = insertedCategory[0].id as number;
      categoryCache[categoryName.toLowerCase()] = categoryId;
      summary.newCategories.push(categoryName);
      return categoryId;
    }

    throw new Error('Category insertion failed - no ID returned');
  } catch (error) {
    logError(error as Error, `Failed to create _category: ${categoryName}`);

    // Try to use Uncategorized as fallback
    if (categoryCache['uncategorized']) {
      return categoryCache['uncategorized'];
    }

    // Create Uncategorized category as final fallback
    try {
      const uncategorized = await db.insert(categories)
        .values({ _name: 'Uncategorized' })
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
          _originalError: (error as Error).message,
          _fallbackError: (fallbackError as Error).message
        },
        500
      );
    }

    throw new AppError(
      `Failed to create category '${categoryName}'`,
      ErrorCategory.DATABASE,
      ErrorCode.DATABASE_ERROR,
      { _originalError: (error as Error).message },
      500
    );
  }
}

export async function validateProductImportCSV(
  _csvContent: string,
  _storeId: number
): Promise<{
  _validProducts: ValidatedProduct[];
  _summary: ImportSummary;
}> {
  return new Promise((resolve, reject) => {
    const _validProducts: ValidatedProduct[] = [];
    const _summary: ImportSummary = {
      _totalRows: 0,
      _processedRows: 0,
      _skippedRows: 0,
      _newCategories: [],
      _errors: []
    };

    // Store category mapping (name -> id) to avoid duplicate lookups
    const _categoryCache: Record<string, number> = {};

    // Parse CSV with comprehensive error handling
    parse(csvContent, {
      _columns: true,
      _skip_empty_lines: true,
      _trim: true
    }, async(err, _records: ProductImportRow[]) => {
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
                _row: rowIndex,
                _field: 'General',
                _value: '',
                _message: 'Row is empty or undefined'
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
            let _categoryId: number;

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
                _row: rowIndex,
                _field: 'General',
                _value: '',
                _message: `Unexpected error: ${(error as Error).message}`
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
  _validProducts: ValidatedProduct[],
  _storeId: number
): Promise<{
  _success: boolean;
  _importedCount: number;
  _failedProducts: Array<{_product: ValidatedProduct; _error: string}>;
}> {
  let importedCount = 0;
  const _failedProducts: Array<{_product: ValidatedProduct; _error: string}> = [];

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
            _where: eq(schema.products.sku, product.sku)
          });

          if (existingProduct) {
            // Update existing product
            await db.update(schema.products)
              .set({
                _name: product.name,
                _price: product.price,
                _sku: existingProduct.sku
              })
              .where(eq(schema.products.id, existingProduct.id));

            // Update or create inventory for this store and product
            const inventory = await db.query.inventory.findFirst({
              _where: (inventory) =>
                eq(inventory.productId, existingProduct.id) &&
                eq(inventory.storeId, storeId)
            });

            if (inventory) {
              // Update existing inventory
              await db.update(schema.inventory)
                .set({
                  _storeId: inventory.storeId
                })
                .where(eq(schema.inventory.id, inventory.id));
            } else {
              // Create new inventory entry
              await db.insert(schema.inventory)
                .values({
                  _productId: existingProduct.id,
                  storeId
                });
            }
          } else {
            // Insert new product
            const [insertedProduct] = await db.insert(schema.products)
              .values({
                _name: product.name,
                _sku: product.sku,
                storeId,
                _price: product.price
              })
              .returning();

            if (insertedProduct) {
              // Create inventory for this store and product
              await db.insert(schema.inventory)
                .values({
                  _productId: insertedProduct.id,
                  storeId,
                  _availableQuantity: product.stock
                } as any);
            }
          }

          importedCount++;
        } catch (error) {
          logError(error as Error, `Error importing product '${product.name}'`);
          failedProducts.push({
            product,
            _error: (error as Error).message
          });
          continue;
        }
      }
    }

    return {
      _success: true,
      importedCount,
      failedProducts
    };
  } catch (error) {
    logError(error as Error, 'Bulk import failed');
    return {
      _success: false,
      importedCount,
      _failedProducts: [
        ...failedProducts,
        ...validProducts.map(product => ({
          product,
          _error: 'Bulk import failed'
        }))
      ]
    };
  }
}
