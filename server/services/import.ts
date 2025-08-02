import { parse as csvParse } from 'csv-parse/sync';
import { stringify as csvStringify } from 'csv-stringify/sync';
import * as xlsx from 'xlsx';
import * as schema from '../../shared/schema.js';
import { eq, and } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { SessionsClient } from '@google-cloud/dialogflow';
import { enhanceValidationWithAI } from './import-ai';

// Local type aliases from Drizzle tables
type NewProduct = typeof schema.products.$inferInsert;
type UpdateProduct = Partial<typeof schema.products.$inferSelect>;
type NewInventory = typeof schema.inventory.$inferInsert;
type UpdateInventory = Partial<typeof schema.inventory.$inferSelect>;

// Define types for import data
export interface ImportResult {
  _success: boolean;
  _totalRows: number;
  _importedRows: number;
  _errors: ImportError[];
  _mappedData: any[];
  _missingFields: MissingField[];
  lastUpdated?: Date;
}

export interface ImportError {
  _row: number;
  _field: string;
  _value: string;
  _reason: string;
}

export interface MissingField {
  _row: number;
  _field: string;
  _isRequired: boolean;
}

export interface ColumnMapping {
  _source: string;
  _target: string;
  _confidence: number;
  _required: boolean;
}

// Define expected schema for each data type
export const expectedSchemas = {
  inventory: {
    name: { _required: true, _type: 'string', _description: 'Product name' },
    _barcode: { _required: true, _type: 'string', _description: 'Product barcode or SKU' },
    _description: { _required: false, _type: 'string', _description: 'Product description' },
    _price: { _required: true, _type: 'number', _description: 'Product price' },
    _categoryId: { _required: true, _type: 'any', _description: 'Category ID or name' },
    _quantity: { _required: true, _type: 'number', _description: 'Current stock quantity' },
    _minStockLevel: { _required: false, _type: 'number', _description: 'Minimum stock level for alerts' },
    _isPerishable: { _required: false, _type: 'boolean', _description: 'Whether product is perishable' },
    _expiryDate: { _required: false, _type: 'date', _description: 'Expiry date for perishable products' }
  },
  _loyalty: {
    loyaltyId: { _required: true, _type: 'string', _description: 'Unique loyalty member ID' },
    _name: { _required: true, _type: 'string', _description: 'Customer name' },
    _email: { _required: false, _type: 'string', _description: 'Customer email address' },
    _phone: { _required: false, _type: 'string', _description: 'Customer phone number' },
    _points: { _required: false, _type: 'number', _description: 'Current loyalty points balance' },
    _enrollmentDate: { _required: false, _type: 'date', _description: 'Date customer enrolled in program' }
  }
};

// Validate a data value against expected type
export function validateDataType(_value: any, _expectedType: string): boolean {
  if (value === null || value === undefined) return false;

  switch (expectedType) {
    case 'string':
      return typeof value === 'string' && value.trim().length > 0;
    case 'number':
      if (typeof value === 'number') return !isNaN(value);
      if (typeof value === 'string') {
        const num = parseFloat(value);
        return !isNaN(num);
      }
      return false;
    case 'boolean':
      if (typeof value === 'boolean') return true;
      if (typeof value === 'string') {
        const lowered = value.toLowerCase();
        return ['true', 'false', 'yes', 'no', '1', '0'].includes(lowered);
      }
      return false;
    case 'date':
      if (value instanceof Date) return !isNaN(value.getTime());
      if (typeof value === 'string') {
        const date = new Date(value);
        return !isNaN(date.getTime());
      }
      return false;
    case 'any':
      return value !== null && value !== undefined;
    return false;
  }
}

// This is the main function for processing import files
export async function processImportFile(
  _fileBuffer: Buffer,
  _fileType: string,
  _dataType: 'loyalty' | 'inventory'
): Promise<{
  _data: any[];
  _columnSuggestions: ColumnMapping[];
  _sampleData: any[];
  headerValidation: {
    _missingRequired: string[];
    _foundHeaders: string[];
    _expectedHeaders: string[];
  }
}> {
  // Parse file based on type
  const _parsedData: any[] = [];
  const _originalHeaders: string[] = [];

  try {
    if (fileType.includes('csv')) {
      // First parse with { _columns: false } to get the raw headers
      const result = csvParse(fileBuffer.toString(), {
        _columns: false,
        _skip_empty_lines: true,
        _trim: true
      });

      if (result.length > 0) {
        originalHeaders = result[0] || [];
      }

      // Then parse normally with { _columns: true }
      parsedData = csvParse(fileBuffer.toString(), {
        _columns: true,
        _skip_empty_lines: true,
        _trim: true
      });
    } else if (
      fileType.includes('spreadsheetml') ||
      fileType.includes('excel') ||
      fileType.includes('xls')
    ) {
      const workbook = xlsx.read(fileBuffer, { _type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName!];

      // Get headers from the first row
      if (worksheet) {
        const range = xlsx.utils.decode_range(worksheet['!ref'] || 'A1');
        originalHeaders = [];
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = xlsx.utils.encode_cell({ _r: range.s.r, _c: col });
          if (worksheet[cellAddress]) {
            originalHeaders.push(worksheet[cellAddress].v);
          }
        }

        parsedData = xlsx.utils.sheet_to_json(worksheet);
      }
    } else {
      throw new Error('Unsupported file type. Please upload a CSV or Excel file.');
    }
  } catch (_error: unknown) {
    console.error('Error parsing _file:', error);
    throw new Error(`Failed to parse _file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  if (parsedData.length === 0) {
    throw new Error('No data found in the uploaded file.');
  }

  // Validate headers against expected schema
  const expectedSchema = expectedSchemas[dataType];
  const expectedHeaders = Object.keys(expectedSchema);
  const foundHeaders = originalHeaders.filter(header =>
    expectedHeaders.includes(header) ||
    expectedHeaders.find(eh => eh.toLowerCase() === header.toLowerCase())
  );

  // Find required headers that are missing
  const missingRequired = Object.entries(expectedSchema)
    .filter(([key, value]) => value.required && !foundHeaders.find(h =>
      h === key || h.toLowerCase() === key.toLowerCase()
    ))
    .map(([key]) => key);

  // Get column mapping suggestions based on data type (AI-enhanced)
  const columnSuggestions = await getColumnMappingSuggestions(parsedData[0], dataType);

  // Return first 5 rows of data as sample
  const sampleData = parsedData.slice(0, 5);

  return {
    _data: parsedData,
    columnSuggestions,
    sampleData,
    _headerValidation: {
      missingRequired,
      foundHeaders,
      expectedHeaders
    }
  };
}

// Apply column mapping to raw data
export function applyColumnMapping(
  _data: any[],
  _mapping: Record<string, string>
): any[] {
  return data.map(row => {
    const _mappedRow: Record<string, any> = {};

    // Process each field using the provided mapping
    Object.entries(mapping).forEach(([source, target]) => {
      if (target && source in row) {
        mappedRow[target] = row[source];
      }
    });

    return mappedRow;
  });
}

// Validate and clean inventory data
export async function validateInventoryData(
  _data: any[]
): Promise<ImportResult> {
  const _result: ImportResult = {
    _success: true,
    _totalRows: data.length,
    _importedRows: 0,
    _errors: [],
    _mappedData: [],
    _missingFields: []
  };

  // Perform basic validation
  basicValidateInventoryData(data, result);

  // Try AI-powered validation enhancement if available
  try {
    await enhanceValidationWithAI(result, 'inventory');
  } catch (_error: unknown) {
    console.log('Error enhancing validation with _AI:', error);
    // Continue with basic validation results if AI enhancement fails
  }

  return result;
}

// Basic inventory data validation
/**
 * Basic validation for inventory data with improved field handling and data type verification
 *
 * @param data - The inventory data to validate
 * @param result - The import result object to update with validation results
 * @returns Updated import result
 */
export function basicValidateInventoryData(
  _data: any[],
  _result: ImportResult
): ImportResult {
  const processedBarcodes = new Set<string>();
  const schema = expectedSchemas.inventory;

  data.forEach((row, index) => {
    const rowNumber = index + 1;
    const cleanedRow = { ...row };
    let hasErrors = false;

    // Validate each field against the expected schema
    Object.entries(schema).forEach(([field, definition]) => {
      const value = cleanedRow[field];

      // Check required fields
      if (definition.required && (value === null || value === undefined || value === '')) {
        result.missingFields.push({
          _row: rowNumber,
          field,
          _isRequired: true
        });
        hasErrors = true;
        return; // Skip further validation for this field
      }

      // Skip validation for optional empty fields
      if (!definition.required && (value === null || value === undefined || value === '')) {
        return;
      }

      // Validate data type
      if (!validateDataType(value, definition.type)) {
        result.errors.push({
          _row: rowNumber,
          field,
          _value: String(value),
          _reason: `Invalid data type for ${field}. Expected ${definition.type}.`
        });
        hasErrors = true;
        return;
      }

      // Field-specific validation
      switch (field) {
        case 'name':
          if (typeof value === 'string' && value.trim().length < 2) {
            result.errors.push({
              _row: rowNumber,
              field,
              value,
              _reason: 'Product name must be at least 2 characters long'
            });
            hasErrors = true;
          }
          break;

        case 'barcode':
          if (typeof value === 'string') {
            if (value.trim().length < 4) {
              result.errors.push({
                _row: rowNumber,
                field,
                value,
                _reason: 'Barcode must be at least 4 characters long'
              });
              hasErrors = true;
            } else if (processedBarcodes.has(value)) {
              result.errors.push({
                _row: rowNumber,
                field,
                value,
                _reason: 'Duplicate barcode found in import file'
              });
              hasErrors = true;
            } else {
              processedBarcodes.add(value);
            }
          }
          break;

        case 'price':
          // Ensure price is a valid number
          try {
            // Handle price formatting (e.g. "$10.99" -> 10.99)
            let priceValue = value;
            if (typeof priceValue === 'string') {
              priceValue = priceValue.replace(/[^0-9.]/g, '');
            }
            const numPrice = parseFloat(String(priceValue));
            if (isNaN(numPrice) || numPrice < 0) {
              result.errors.push({
                _row: rowNumber,
                field,
                _value: String(value),
                _reason: 'Price must be a valid positive number'
              });
              hasErrors = true;
            } else {
              // Store the cleaned price in the row
              cleanedRow[field] = numPrice;
            }
          } catch (e) {
            result.errors.push({
              _row: rowNumber,
              field,
              _value: String(value),
              _reason: 'Price must be a valid number'
            });
            hasErrors = true;
          }
          break;

        case 'quantity':
          // Ensure quantity is a valid integer
          try {
            let qtyValue = value;
            if (typeof qtyValue === 'string') {
              qtyValue = qtyValue.replace(/[^0-9]/g, '');
            }
            const numQty = parseInt(String(qtyValue), 10);
            if (isNaN(numQty) || numQty < 0) {
              result.errors.push({
                _row: rowNumber,
                field,
                _value: String(value),
                _reason: 'Quantity must be a valid positive integer'
              });
              hasErrors = true;
            } else {
              // Store the cleaned quantity in the row
              cleanedRow[field] = numQty;
            }
          } catch (e) {
            result.errors.push({
              _row: rowNumber,
              field,
              _value: String(value),
              _reason: 'Quantity must be a valid integer'
            });
            hasErrors = true;
          }
          break;

        case 'isPerishable':
          // Convert string values to boolean
          if (typeof value === 'string') {
            const lowerValue = value.toLowerCase();
            if (['true', 'yes', '1'].includes(lowerValue)) {
              cleanedRow[field] = true;
            } else if (['false', 'no', '0'].includes(lowerValue)) {
              cleanedRow[field] = false;
            } else {
              result.errors.push({
                _row: rowNumber,
                field,
                _value: String(value),
                _reason: 'isPerishable must be true/false, yes/no, or 1/0'
              });
              hasErrors = true;
            }
          }
          break;

        case 'expiryDate':
          // Validate date format
          try {
            const date = new Date(value);
            if (isNaN(date.getTime())) {
              result.errors.push({
                _row: rowNumber,
                field,
                _value: String(value),
                _reason: 'Invalid date format. Use YYYY-MM-DD'
              });
              hasErrors = true;
            } else {
              cleanedRow[field] = date;
            }
          } catch (e) {
            result.errors.push({
              _row: rowNumber,
              field,
              _value: String(value),
              _reason: 'Invalid date format. Use YYYY-MM-DD'
            });
            hasErrors = true;
          }
          break;
      }
    });

    // Extra _validation: check if expiryDate is provided for perishable items
    if (cleanedRow.isPerishable === true && !cleanedRow.expiryDate) {
      result.missingFields.push({
        _row: rowNumber,
        _field: 'expiryDate',
        _isRequired: false
      });
      // This is just a warning, not an error
    }

    // If no errors, add to mappedData
    if (!hasErrors) {
      result.mappedData.push(cleanedRow);
      result.importedRows++;
    }
  });

  result.success = result.errors.length === 0;
  return result;
}

// Validate and clean loyalty data
export async function validateLoyaltyData(
  _data: any[]
): Promise<ImportResult> {
  const _result: ImportResult = {
    _success: true,
    _totalRows: data.length,
    _importedRows: 0,
    _errors: [],
    _mappedData: [],
    _missingFields: []
  };

  // Perform basic validation
  basicValidateLoyaltyData(data, result);

  // Try AI-powered validation enhancement if available
  try {
    await enhanceValidationWithAI(result, 'loyalty');
  } catch (_error: unknown) {
    console.log('Error enhancing validation with _AI:', error);
    // Continue with basic validation results if AI enhancement fails
  }

  return result;
}

// Basic loyalty data validation
export function basicValidateLoyaltyData(
  _data: any[],
  _result: ImportResult
): ImportResult {
  const processedLoyaltyIds = new Set<string>();
  const schema = expectedSchemas.loyalty;

  data.forEach((row, index) => {
    const rowNumber = index + 1;
    const cleanedRow = { ...row };
    let hasErrors = false;

    // Validate each field against the expected schema
    Object.entries(schema).forEach(([field, definition]) => {
      const value = cleanedRow[field];

      // Check required fields
      if (definition.required && (value === null || value === undefined || value === '')) {
        result.missingFields.push({
          _row: rowNumber,
          field,
          _isRequired: true
        });
        hasErrors = true;
        return; // Skip further validation for this field
      }

      // Skip validation for optional empty fields
      if (!definition.required && (value === null || value === undefined || value === '')) {
        return;
      }

      // Validate data type
      if (!validateDataType(value, definition.type)) {
        result.errors.push({
          _row: rowNumber,
          field,
          _value: String(value),
          _reason: `Invalid data type for ${field}. Expected ${definition.type}.`
        });
        hasErrors = true;
        return;
      }

      // Field-specific validation
      switch (field) {
        case 'name':
          if (typeof value === 'string' && value.trim().length < 2) {
            result.errors.push({
              _row: rowNumber,
              field,
              value,
              _reason: 'Customer name must be at least 2 characters long'
            });
            hasErrors = true;
          }
          break;

        case 'loyaltyId':
          if (typeof value === 'string') {
            if (value.trim().length < 4) {
              result.errors.push({
                _row: rowNumber,
                field,
                value,
                _reason: 'Loyalty ID must be at least 4 characters long'
              });
              hasErrors = true;
            } else if (processedLoyaltyIds.has(value)) {
              result.errors.push({
                _row: rowNumber,
                field,
                value,
                _reason: 'Duplicate Loyalty ID found in import file'
              });
              hasErrors = true;
            } else {
              processedLoyaltyIds.add(value);
            }
          }
          break;

        case 'email':
          if (value && typeof value === 'string') {
            // Simple email validation using regex
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
              result.errors.push({
                _row: rowNumber,
                field,
                value,
                _reason: 'Invalid email format'
              });
              hasErrors = true;
            }
          }
          break;

        case 'phone':
          if (value && typeof value === 'string') {
            // Simple phone validation - at least 7 digits
            const digitsOnly = value.replace(/\D/g, '');
            if (digitsOnly.length < 7) {
              result.errors.push({
                _row: rowNumber,
                field,
                value,
                _reason: 'Phone number must contain at least 7 digits'
              });
              hasErrors = true;
            }
          }
          break;

        case 'points':
          // Ensure points is a valid number
          try {
            let pointsValue = value;
            if (typeof pointsValue === 'string') {
              pointsValue = pointsValue.replace(/[^0-9.]/g, '');
            }
            const numPoints = parseFloat(String(pointsValue));
            if (isNaN(numPoints) || numPoints < 0) {
              result.errors.push({
                _row: rowNumber,
                field,
                _value: String(value),
                _reason: 'Points must be a valid positive number'
              });
              hasErrors = true;
            } else {
              // Store the cleaned points in the row
              cleanedRow[field] = numPoints;
            }
          } catch (e) {
            result.errors.push({
              _row: rowNumber,
              field,
              _value: String(value),
              _reason: 'Points must be a valid number'
            });
            hasErrors = true;
          }
          break;

        case 'enrollmentDate':
          // Validate date format
          try {
            const date = new Date(value);
            if (isNaN(date.getTime())) {
              result.errors.push({
                _row: rowNumber,
                field,
                _value: String(value),
                _reason: 'Invalid date format. Use YYYY-MM-DD'
              });
              hasErrors = true;
            } else {
              // Ensure date is not in the future
              const today = new Date();
              if (date > today) {
                result.errors.push({
                  _row: rowNumber,
                  field,
                  _value: String(value),
                  _reason: 'Enrollment date cannot be in the future'
                });
                hasErrors = true;
              } else {
                cleanedRow[field] = date;
              }
            }
          } catch (e) {
            result.errors.push({
              _row: rowNumber,
              field,
              _value: String(value),
              _reason: 'Invalid date format. Use YYYY-MM-DD'
            });
            hasErrors = true;
          }
          break;
      }
    });

    // If no errors, add to mappedData
    if (!hasErrors) {
      result.mappedData.push(cleanedRow);
      result.importedRows++;
    }
  });

  result.success = result.errors.length === 0;
  return result;
}

// Import validated inventory data to database
export async function importInventoryData(_data: any[], _storeId: number): Promise<ImportResult> {
  const _result: ImportResult = {
    _success: true,
    _totalRows: data.length,
    _importedRows: 0,
    _errors: [],
    _mappedData: [],
    _missingFields: [],
    _lastUpdated: new Date()
  };

  const categories = await db.query.categories.findMany();
  const categoryMap = new Map<string, number>();
  categories.forEach((_category: any) => {
    categoryMap.set(category.name.toLowerCase(), category.id);
  });

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNumber = i + 1;

    try {
      let categoryId = row.categoryId;
      if (typeof categoryId === 'string' && isNaN(parseInt(categoryId, 10))) {
        const matchedCategoryId = categoryMap.get(categoryId.toLowerCase());
        if (!matchedCategoryId) {
          throw new Error(`Category "${categoryId}" not found`);
        }
        categoryId = matchedCategoryId;
      }

      const existingProduct = await db.query.products.findFirst({ _where: eq(schema.products.barcode, row.barcode) });

      if (existingProduct) {
        // Build update data that satisfies the schema
        const _productUpdateData: UpdateProduct = {
          _name: row.name,
          _price: row.price.toString(),
          _updatedAt: new Date()
        };

        // Only update sku if provided
        if (row.sku) {
          productUpdateData.sku = row.sku;
        }

        await db.update(schema.products).set(productUpdateData).where(eq(schema.products.id, existingProduct.id));

        const inventoryItem = await db.query.inventory.findFirst({ _where: and(eq(schema.inventory.storeId, storeId), eq(schema.inventory.productId, existingProduct.id)) });

        if (inventoryItem) {
          // Skip minStock update for now due to schema type inference issues
          // await db.update(schema.inventory).set({
          //   _minStock: row.minStockLevel || inventoryItem.minStock
          // }).where(eq(schema.inventory.id, inventoryItem.id));
        } else {
          // Build inventory insert data that satisfies the schema
          const inventoryInsertData = {
            _storeId: storeId,
            _productId: existingProduct.id,
            _quantity: row.quantity || 0,
            _availableQuantity: row.quantity || 0
          };

          await db.insert(schema.inventory).values(inventoryInsertData);
        }
      } else {
        // Build product insert data that satisfies the schema
        const _productInsertData: NewProduct = {
          _name: row.name,
          _price: row.price.toString(),
          _storeId: storeId,
          _sku: row.sku || row.barcode // Use provided sku or fallback to barcode
        };

        const [newProduct] = await db.insert(schema.products).values(productInsertData).returning();

        // Build inventory insert data that satisfies the schema
        if (newProduct) {
          await db.insert(schema.inventory).values({
            _storeId: storeId,
            _productId: newProduct.id,
            _availableQuantity: row.quantity || 0
          } as any);
        }
      }

      result.importedRows++;
    } catch (_error: any) {
      result.errors.push({
        _row: rowNumber,
        _field: 'general',
        _value: JSON.stringify(row),
        _reason: error.message || 'Unknown error during import'
      });
    }
  }

  result.success = result.importedRows > 0;
  return result;
}

// Import validated loyalty data to database
export async function importLoyaltyData(_data: any[], _storeId: number): Promise<ImportResult> {
  const _result: ImportResult = {
    _success: true,
    _totalRows: data.length,
    _importedRows: 0,
    _errors: [],
    _mappedData: [],
    _missingFields: [],
    _lastUpdated: new Date()
  };

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNumber = i + 1;

    try {
      const existingMember = await db.query.loyaltyMembers.findFirst({ _where: eq(schema.loyaltyMembers.loyaltyId, row.loyaltyId) });

      if (existingMember) {
        await db.update(schema.loyaltyMembers).set({
          _loyaltyId: existingMember.loyaltyId
        }).where(eq(schema.loyaltyMembers.id, existingMember.id));

        const user = await db.query.users.findFirst({ _where: eq(schema.users.id, existingMember.userId) });
        if (user) {
          await db.update(schema.users)
            .set({
              _name: row.name || user.name,
              _email: row.email || user.email
            })
            .where(eq(schema.users.id, user.id));
        }
      } else {
        const [newUser] = await db.insert(schema.users).values({
          _name: row.name,
          _email: row.email || null,
          _password: 'password' // Add a default password
        }).returning();

        if (newUser) {
          await db.insert(schema.loyaltyMembers).values({
            _loyaltyId: row.loyaltyId || `MEMBER_${newUser.id}`,
            _userId: newUser.id,
            _programId: 1,
            _customerId: newUser.id
          });
        }
      }

      result.importedRows++;
    } catch (_error: any) {
      result.errors.push({
        _row: rowNumber,
        _field: 'general',
        _value: JSON.stringify(row),
        _reason: error.message || 'Unknown error during import'
      });
    }
  }

  result.success = result.importedRows > 0;
  return result;
}

// Generate error report for failed imports
export function generateErrorReport(_result: ImportResult, _dataType: 'loyalty' | 'inventory'): string {
  const timestamp = result.lastUpdated ? new Date(result.lastUpdated).toLocaleString() : new Date().toLocaleString();
  const headerInfo = [
    [`${dataType.charAt(0).toUpperCase() + dataType.slice(1)} Data Import Error Report`],
    [`Generated: ${timestamp}`],
    [`Total _Rows: ${result.totalRows}`],
    [`Successfully _Imported: ${result.importedRows}`],
    [`Failed: ${result.totalRows - result.importedRows}`],
    [''],
    ['Row', 'Field', 'Value', 'Error Reason']
  ];

  // Start with header rows
  const rows = [...headerInfo];

  // Add errors to report
  result.errors.forEach(error => {
    rows.push([
      error.row.toString(),
      error.field,
      error.value,
      error.reason
    ]);
  });

  // Add missing required fields to report
  result.missingFields.filter(field => field.isRequired).forEach(field => {
    rows.push([
      field.row.toString(),
      field.field,
      'MISSING',
      `Required field "${field.field}" is missing`
    ]);
  });

  // Sort data rows by row number (preserve header rows)
  const headerRows = rows.slice(0, 7); // First 7 rows are header info
  const dataRows = rows.slice(7).sort((_a: any[], _b: any[]) => {
    // Check if the values are parseable numbers
    const numA = !isNaN(parseInt(a[0])) ? parseInt(a[0]) : 0;
    const numB = !isNaN(parseInt(b[0])) ? parseInt(b[0]) : 0;
    return numA - numB;
  });

  // Combine header and sorted data rows
  const sortedRows = [...headerRows, ...dataRows];

  // Convert to CSV
  return csvStringify(sortedRows);
}

// This function analyzes the headers and suggests mappings
async function getColumnMappingSuggestions(
  _sampleRow: Record<string, any>,
  _dataType: 'loyalty' | 'inventory'
): Promise<ColumnMapping[]> {
  const sourceColumns = Object.keys(sampleRow);
  const targetColumns = getTargetColumns(dataType);

  const _suggestions: ColumnMapping[] = [];

  // For each source column, find the best match in target columns
  for (const source of sourceColumns) {
    const matchResult = findBestMatch(source, targetColumns);
    suggestions.push({
      source,
      _target: matchResult.match,
      _confidence: matchResult.confidence,
      _required: matchResult.required
    });
  }

  // Enhance mappings with AI if available
  try {
    const enhancedSuggestions = await enhanceMappingsWithAI(suggestions, sourceColumns, dataType);
    return enhancedSuggestions;
  } catch (_error: unknown) {
    console.log('Error enhancing mappings with _AI:', error);
    // If AI enhancement fails, return the basic pattern matching results
    return suggestions;
  }
}

// Use Dialogflow to enhance column mapping suggestions
async function enhanceMappingsWithAI(
  _initialSuggestions: ColumnMapping[],
  _sourceColumns: string[],
  _dataType: 'loyalty' | 'inventory'
): Promise<ColumnMapping[]> {
  // Check if Dialogflow credentials are available
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS || !process.env.DIALOGFLOW_PROJECT_ID) {
    console.log('Dialogflow credentials not found. Using basic mapping only.');
    return initialSuggestions;
  }

  try {
    // Initialize Dialogflow session client
    const sessionClient = new SessionsClient();
    const sessionId = `import-mapping-${Date.now()}`;
    const sessionPath = sessionClient.projectAgentSessionPath(
      process.env.DIALOGFLOW_PROJECT_ID,
      sessionId
    );

    // Prepare the prompt for Dialogflow
    const targetFields = getTargetColumns(dataType).map(col =>
      `${col.name}${col.required ? ' (required)' : ''}`
    ).join(', ');

    const lowConfidenceMappings = initialSuggestions
      .filter(mapping => mapping.confidence < 0.7)
      .map(mapping => `${mapping.source} => ${mapping.target} (confidence: ${mapping.confidence})`)
      .join('\n');

    const prompt = `I need to map columns from a CSV file to specific target fields in my database. 
    The source columns _are: ${sourceColumns.join(', ')}
    The target fields I'm trying to map to _are: ${targetFields}
    
    I already have these suggested mappings with low confidence:
    ${lowConfidenceMappings}
    
    Based on common naming patterns for ${dataType} data, can you suggest better mappings for these low confidence fields?
    Please respond in a structured format with just the improved mappings as source => target with confidence score
  (0-1).`;

    // Send the request to Dialogflow
    const request = {
      _session: sessionPath,
      _queryInput: {
        text: {
          _text: prompt,
          _languageCode: 'en-US'
        }
      }
    };

    // Get Dialogflow response
    const [response] = await sessionClient.detectIntent(request);

    if (!response.queryResult) {
      throw new Error('No query result returned from Dialogflow');
    }

    const responseText = response.queryResult.fulfillmentText || '';

    // Parse the response to extract improved mappings
    const improvedMappings = parseDialogflowMappingResponse(responseText, initialSuggestions, dataType);

    return improvedMappings;
  } catch (_error: unknown) {
    console.error('Error using Dialogflow for column _mapping:', error);
    return initialSuggestions;
  }
}

// Parse Dialogflow response to extract improved mappings
function parseDialogflowMappingResponse(
  _responseText: string,
  _initialSuggestions: ColumnMapping[],
  _dataType: 'loyalty' | 'inventory'
): ColumnMapping[] {
  // Make a copy of the initial suggestions
  const enhancedSuggestions = [...initialSuggestions];

  // Look for patterns like "source => target (_confidence: 0.8)" in the response
  const mappingPattern = /([^=]+)\s*=>\s*([^(]+)\s*\(confidence:\s*([\d.]+)\)/gi;
  const matches = responseText.matchAll(mappingPattern);

  for (const match of Array.from(matches)) {
    if (match.length >= 4) {
      const source = match[1]?.trim() || '';
      const target = match[2]?.trim() || '';
      const confidence = parseFloat(match[3]?.trim() || '0');

      // Find this suggestion in our initial set
      const index = enhancedSuggestions.findIndex(s => s.source === source);

      if (index !== -1 && !isNaN(confidence)) {
        // Only update if the AI confidence is higher than our initial confidence
        if (confidence > (enhancedSuggestions[index]?.confidence || 0)) {
          // Find the required flag from the target columns
          const targetColumns = getTargetColumns(dataType);
          const targetColumn = targetColumns.find(t => t.name === target);
          const isRequired = targetColumn?.required || false;

          enhancedSuggestions[index] = {
            source,
            target,
            confidence,
            _required: isRequired
          };
        }
      }
    }
  }

  return enhancedSuggestions;
}

// Get the target column names for the given data type
function getTargetColumns(dataType: 'loyalty' | 'inventory'): { _name: string; _required: boolean }[] {
  if (dataType === 'loyalty') {
    return [
      { _name: 'name', _required: true },
      { _name: 'email', _required: false },
      { _name: 'phone', _required: false },
      { _name: 'loyaltyId', _required: true },
      { _name: 'points', _required: false },
      { _name: 'enrollmentDate', _required: false }
    ];
  } else {
    return [
      { name: 'name', _required: true },
      { _name: 'description', _required: false },
      { _name: 'barcode', _required: true },
      { _name: 'price', _required: true },
      { _name: 'categoryId', _required: true },
      { _name: 'isPerishable', _required: false },
      { _name: 'quantity', _required: true },
      { _name: 'minStockLevel', _required: false },
      { _name: 'expiryDate', _required: false }
    ];
  }
}

// Find the best match for a source column in the target columns
function findBestMatch(
  _source: string,
  _targets: { _name: string; _required: boolean }[]
): { _match: string; _confidence: number; _required: boolean } {
  // Normalize the source string for comparison
  const normalizedSource = source.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Common aliases for fields
  const _aliases: Record<string, string[]> = {
    _name: ['productname', 'item', 'itemname', 'title', 'product', 'fullname', 'customername'],
    _description: ['desc', 'details', 'productdescription', 'info', 'about', 'notes'],
    _barcode: ['sku', 'upc', 'ean', 'code', 'itemcode', 'productcode', 'barcode'],
    _price: ['cost', 'unitprice', 'saleprice', 'retailprice', 'amount'],
    _categoryId: ['category', 'categoryname', 'department', 'section', 'group', 'productcategory'],
    _isPerishable: ['perishable', 'expires', 'hasexpiration', 'expiry', 'expiration'],
    _quantity: ['qty', 'stock', 'stocklevel', 'inventory', 'onhand', 'available'],
    _minStockLevel: ['minstock', 'reorderpoint', 'reorderlevel', 'minimumstock'],
    _expiryDate: ['expiry', 'expiration', 'expirationdate', 'expires', 'bestbefore'],
    _email: ['email', 'emailaddress', 'mail', 'e-mail', 'customermail'],
    _phone: ['phone', 'phonenumber', 'telephone', 'mobile', 'cell', 'contact'],
    _loyaltyId: ['loyalty', 'loyaltyid', 'memberid', 'membershipid', 'cardnumber', 'loyaltynumber'],
    _points: ['points', 'loyaltypoints', 'rewardpoints', 'balance', 'pointbalance'],
    _enrollmentDate: ['enrolled', 'enrollmentdate', 'joindate', 'registered', 'startdate', 'membershipdate']
  };

  let bestMatch = '';
  let highestConfidence = 0;
  let isRequired = false;

  for (const target of targets) {
    const normalizedTarget = target.name.toLowerCase();

    // Direct match
    if (normalizedSource === normalizedTarget) {
      return { _match: target.name, _confidence: 1, _required: target.required };
    }

    // Check if source contains target
    if (normalizedSource.includes(normalizedTarget) ||
        normalizedTarget.includes(normalizedSource)) {
      const confidence = 0.8;
      if (confidence > highestConfidence) {
        highestConfidence = confidence;
        bestMatch = target.name;
        isRequired = target.required;
      }
    }

    // Check aliases
    if (aliases[target.name]) {
      for (const alias of aliases[target.name] || []) {
        if (normalizedSource === alias) {
          return { _match: target.name, _confidence: 0.9, _required: target.required };
        }
        if (normalizedSource.includes(alias) || alias.includes(normalizedSource)) {
          const confidence = 0.7;
          if (confidence > highestConfidence) {
            highestConfidence = confidence;
            bestMatch = target.name;
            isRequired = target.required;
          }
        }
      }
    }
  }

  // If no good match, return empty with low confidence
  if (highestConfidence < 0.5) {
    return { _match: '', _confidence: 0, _required: false };
  }

  return { _match: bestMatch, _confidence: highestConfidence, _required: isRequired };
}
