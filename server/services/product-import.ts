import { db } from '@db';
import * as schema from '@shared/schema';
import { categories } from '@shared/schema';
import { parse } from 'csv-parse';
import { eq } from 'drizzle-orm';

interface ProductImportRow {
  'Product Name': string;
  SKU: string;
  Category: string;
  Price: string;
  Stock: string;
  'Expiry Date'?: string;
  Description?: string;
  Barcode?: string;
  'Image URL'?: string;
  Supplier?: string;
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
      errors: [],
    };

    // Store category mapping (name -> id) to avoid duplicate lookups
    const categoryCache: Record<string, number> = {};

    // Parse CSV
    parse(
      csvContent,
      {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      },
      async (err, records: ProductImportRow[]) => {
        if (err) {
          return reject(new Error(`Failed to parse CSV: ${err.message}`));
        }

        summary.totalRows = records.length;

        try {
          // Fetch all existing categories for comparison
          const existingCategories = await db.query.categories.findMany();
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
                message: 'Product name is required',
              });
              summary.skippedRows++;
              continue;
            }

            if (!row['SKU'] || !row['SKU'].trim()) {
              summary.errors.push({
                row: rowIndex,
                field: 'SKU',
                value: row['SKU'] || '',
                message: 'SKU is required',
              });
              summary.skippedRows++;
              continue;
            }

            if (!row['Price'] || isNaN(parseFloat(row['Price']))) {
              summary.errors.push({
                row: rowIndex,
                field: 'Price',
                value: row['Price'] || '',
                message: 'Price must be a valid number',
              });
              summary.skippedRows++;
              continue;
            }

            if (!row['Stock'] || isNaN(parseInt(row['Stock']))) {
              summary.errors.push({
                row: rowIndex,
                field: 'Stock',
                value: row['Stock'] || '',
                message: 'Stock must be a valid number',
              });
              summary.skippedRows++;
              continue;
            }

            // Validate category and create if needed
            const categoryName = row['Category'] ? row['Category'].trim() : 'Uncategorized';
            let categoryId: number;

            if (categoryCache[categoryName.toLowerCase()]) {
              // Category exists, use cached ID
              categoryId = categoryCache[categoryName.toLowerCase()];
            } else {
              // Create new category
              try {
                const insertedCategory = await db
                  .insert(categories)
                  .values({ name: categoryName })
                  .returning();

                if (insertedCategory && insertedCategory[0]) {
                  categoryId = insertedCategory[0].id;
                  categoryCache[categoryName.toLowerCase()] = categoryId;
                  summary.newCategories.push(categoryName);
                } else {
                  // Fallback to Uncategorized if insertion failed
                  if (categoryCache['uncategorized']) {
                    categoryId = categoryCache['uncategorized'];
                  } else {
                    // Create Uncategorized category
                    const uncategorized = await db
                      .insert(categories)
                      .values({ name: 'Uncategorized' })
                      .returning();
                    categoryId = uncategorized[0].id;
                    categoryCache['uncategorized'] = categoryId;
                    summary.newCategories.push('Uncategorized');
                  }
                }
              } catch (error: unknown) {
                console.error(`Error creating category '${categoryName}':`, error);
                summary.errors.push({
                  row: rowIndex,
                  field: 'Category',
                  value: categoryName,
                  message: `Failed to create category: ${(error as Error).message}`,
                });
                summary.skippedRows++;
                continue;
              }
            }

            // Validate expiry date if provided
            let expiryDate: Date | null = null;
            if (row['Expiry Date'] && row['Expiry Date'].trim()) {
              try {
                expiryDate = new Date(row['Expiry Date']);
                if (isNaN(expiryDate.getTime())) {
                  throw new Error('Invalid date format');
                }
              } catch (error: unknown) {
                summary.errors.push({
                  row: rowIndex,
                  field: 'Expiry Date',
                  value: row['Expiry Date'],
                  message: 'Invalid date format. Use YYYY-MM-DD format.',
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
                message: 'Cost price must be a valid number',
              });
              // Don't skip, just don't include cost price
            }

            // Create validated product object
            const validProduct: ValidatedProduct = {
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
              costPrice:
                row['Cost Price'] && !isNaN(parseFloat(row['Cost Price']))
                  ? parseFloat(row['Cost Price']).toFixed(2)
                  : undefined,
            };

            validProducts.push(validProduct);
            summary.processedRows++;
          }

          resolve({ validProducts, summary });
        } catch (error: unknown) {
          reject(error);
        }
      }
    );
  });
}

export async function importProducts(
  validProducts: ValidatedProduct[],
  storeId: number
): Promise<{
  success: boolean;
  importedCount: number;
  failedProducts: Array<{ product: ValidatedProduct; error: string }>;
}> {
  const importedCount = 0;
  const failedProducts: Array<{ product: ValidatedProduct; error: string }> = [];

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
            where: eq(schema.products.sku, product.sku),
          });

          if (existingProduct) {
            // Update existing product
            await db
              .update(schema.products)
              .set({
                name: product.name,
                categoryId: product.categoryId,
                price: product.price,
                description: product.description || existingProduct.description,
                imageUrl: product.imageUrl || existingProduct.imageUrl,
                barcode: product.barcode || existingProduct.barcode,
                updatedAt: new Date(),
                // Don't update SKU as we're using it as the identifier
              })
              .where(eq(schema.products.id, existingProduct.id));

            // Update or create inventory for this store and product
            const inventory = await db.query.inventory.findFirst({
              where: inventory =>
                eq(inventory.productId, existingProduct.id) && eq(inventory.storeId, storeId),
            });

            if (inventory) {
              // Update existing inventory
              await db
                .update(schema.inventory)
                .set({
                  quantity: product.stock,
                  expiryDate: product.expiryDate || inventory.expiryDate,
                  updatedAt: new Date(),
                })
                .where(eq(schema.inventory.id, inventory.id));
            } else {
              // Create new inventory entry
              await db.insert(schema.inventory).values({
                productId: existingProduct.id,
                storeId,
                quantity: product.stock,
                expiryDate: product.expiryDate,
              });
            }
          } else {
            // Insert new product
            const [insertedProduct] = await db
              .insert(schema.products)
              .values({
                name: product.name,
                sku: product.sku,
                categoryId: product.categoryId,
                price: product.price,
                description: product.description,
                barcode: product.barcode,
                imageUrl: product.imageUrl,
              })
              .returning();

            if (insertedProduct) {
              // Create inventory for this store and product
              await db.insert(schema.inventory).values({
                productId: insertedProduct.id,
                storeId,
                quantity: product.stock,
                expiryDate: product.expiryDate,
              });
            }
          }
        } catch (error: unknown) {
          console.error(`Error importing product '${product.name}':`, error);
          failedProducts.push({
            product,
            error: (error as Error).message,
          });
          continue;
        }
      }
    }

    return {
      success: true,
      importedCount: validProducts.length - failedProducts.length,
      failedProducts,
    };
  } catch (error: unknown) {
    console.error('Error bulk importing products:', error);
    return {
      success: false,
      importedCount: validProducts.length - failedProducts.length,
      failedProducts: [
        ...failedProducts,
        ...validProducts.map(product => ({
          product,
          error: 'Bulk import failed',
        })),
      ],
    };
  }
}
