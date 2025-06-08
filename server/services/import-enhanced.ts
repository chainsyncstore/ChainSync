import { db } from '@db/index';
import { SessionsClient } from '@google-cloud/dialogflow';
import * as schema from '@shared/schema';
import { parse as csvParse } from 'csv-parse/sync';
import { stringify as csvStringify } from 'csv-stringify/sync';

// Import secure xlsx wrapper instead of direct xlsx import
import { eq } from 'drizzle-orm';
import { z } from 'zod'; // Added Zod import

import { storage } from '../storage';
import { enhanceValidationWithAI } from './import-ai';
import { SecureXlsx } from '../utils/secure-xlsx';

// Raw CSV row data for loyalty import
interface RawLoyaltyCsvRow {
  loyaltyId?: string;
  name?: string;
  email?: string;
  phone?: string;
  points?: string; // Points as string from CSV
  enrollmentDate?: string; // Date as string from CSV
  [key: string]: string | undefined; // Allows for other columns
}

// Zod schema for validating the PROCESSED/CLEANED loyalty row data
const loyaltyImportRowSchema = z
  .object({
    loyaltyId: z
      .string({ required_error: 'Loyalty ID is required' })
      .min(4, 'Loyalty ID must be at least 4 characters'), // Updated min length
    name: z
      .string({ required_error: 'Name is required' })
      .min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email format').optional().or(z.literal('')).or(z.null()),
    phone: z
      .string()
      .optional()
      .or(z.literal(''))
      .or(z.null())
      .refine(
        val => {
          if (val === null || val === undefined || val === '') return true; // Optional, so empty/null is fine
          const digitsOnly = val.replace(/\D/g, '');
          return digitsOnly.length >= 7;
        },
        { message: 'Phone number must contain at least 7 digits' }
      ), // Added phone refine
    points: z.coerce
      .number({ invalid_type_error: 'Points must be a valid number' })
      .optional()
      .nullable(),
    enrollmentDate: z.coerce
      .date({ invalid_type_error: 'Enrollment date must be a valid date' })
      .optional()
      .nullable(),
  })
  .passthrough(); // Allows other fields not explicitly defined to pass through

// Interface for a processed row in loyalty import, after basic validation and cleaning
interface LoyaltyImportRow {
  loyaltyId: string;
  name: string;
  email?: string;
  phone?: string;
  points?: number; // Cleaned to number by basicValidateLoyaltyData
  enrollmentDate?: Date; // Cleaned to Date by basicValidateLoyaltyData
  [key: string]: any; // Allows for other columns from the import file
}

// Define types for import data
export type BatchImportRow = Record<string, any>; // Represents a single row of data during batch import

export interface ImportResult {
  success: boolean;
  totalRows: number;
  importedRows: number;
  errors: ImportError[];
  mappedData: unknown[];
  missingFields: MissingField[];
  lastUpdated?: Date;
}

export interface ImportError {
  row: number;
  field: string;
  value: string;
  reason: string;
}

export interface MissingField {
  row: number;
  field: string;
  isRequired: boolean;
}

export interface ColumnMapping {
  source: string;
  target: string;
  confidence: number;
  required: boolean;
}

// Define expected schema for each data type
export const expectedSchemas = {
  inventory: {
    name: { required: true, type: 'string', description: 'Product name' },
    barcode: { required: true, type: 'string', description: 'Product barcode or SKU' },
    description: { required: false, type: 'string', description: 'Product description' },
    price: { required: true, type: 'number', description: 'Product price' },
    categoryId: { required: true, type: 'any', description: 'Category ID or name' },
    quantity: { required: true, type: 'number', description: 'Current stock quantity' },
    minStockLevel: {
      required: false,
      type: 'number',
      description: 'Minimum stock level for alerts',
    },
    isPerishable: {
      required: false,
      type: 'boolean',
      description: 'Whether product is perishable',
    },
    expiryDate: {
      required: false,
      type: 'date',
      description: 'Expiry date for perishable products',
    },
  },
  loyalty: {
    loyaltyId: { required: true, type: 'string', description: 'Unique loyalty member ID' },
    name: { required: true, type: 'string', description: 'Customer name' },
    email: { required: false, type: 'string', description: 'Customer email address' },
    phone: { required: false, type: 'string', description: 'Customer phone number' },
    points: { required: false, type: 'number', description: 'Current loyalty points balance' },
    enrollmentDate: {
      required: false,
      type: 'date',
      description: 'Date customer enrolled in program',
    },
  },
};

// Validate a data value against expected type
export function validateDataType(value: unknown, expectedType: string): boolean {
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
    default:
      return false;
  } // Closing brace for switch statement
}

// This is the main function for processing import files
export async function processImportFile(
  fileBuffer: Buffer,
  fileType: string,
  dataType: 'loyalty' | 'inventory'
): Promise<{
  data: Record<string, any>[];
  columnSuggestions: ColumnMapping[];
  sampleData: Record<string, any>[];
  headerValidation: {
    missingRequired: string[];
    foundHeaders: string[];
    expectedHeaders: string[];
  };
}> {
  // Parse file based on type
  let parsedData: Record<string, any>[] = [];
  let originalHeaders: string[] = [];

  try {
    if (fileType.includes('csv')) {
      // First parse with { columns: false } to get the raw headers
      const result = csvParse(fileBuffer.toString(), {
        columns: false,
        skip_empty_lines: true,
        trim: true,
      });

      if (result.length > 0) {
        originalHeaders = result[0];
      }

      // Then parse normally with { columns: true }
      parsedData = csvParse(fileBuffer.toString(), {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } else if (
      fileType.includes('spreadsheetml') ||
      fileType.includes('excel') ||
      fileType.includes('xls')
    ) {
      // Use secure xlsx wrapper
      const secureXlsx = new SecureXlsx({
        maxFileSize: 10 * 1024 * 1024, // 10MB limit
        maxSheets: 5,
        maxRows: 10000,
      });

      // Process Excel file safely
      const sheets = secureXlsx.readFile(fileBuffer);

      // Get first sheet data
      const firstSheetName = Object.keys(sheets)[0];
      if (!firstSheetName) {
        throw new Error('No sheets found in Excel file');
      }

      const sheetData = sheets[firstSheetName];

      // Extract headers (first row)
      if (sheetData.length > 0) {
        originalHeaders = Array.isArray(sheetData[0]) ? sheetData[0] : [];
      }

      // Create parsed data objects with headers as keys
      parsedData = [];
      for (let i = 1; i < sheetData.length; i++) {
        const row = sheetData[i];
        if (!row || !Array.isArray(row)) continue;

        const rowObj: Record<string, any> = {};
        originalHeaders.forEach((header, index) => {
          if (header && index < row.length) {
            rowObj[header] = row[index];
          }
        });

        if (Object.keys(rowObj).length > 0) {
          parsedData.push(rowObj);
        }
      }
    } else {
      throw new Error('Unsupported file type. Please upload a CSV or Excel file.');
    }
  } catch (error: any) {
    console.error('Error parsing file:', error);
    throw new Error(`Failed to parse file: ${error.message || 'Unknown error'}`);
  }

  if (parsedData.length === 0) {
    throw new Error('No data found in the uploaded file.');
  }

  // Validate headers against expected schema
  const expectedSchema = expectedSchemas[dataType];
  const expectedHeaders = Object.keys(expectedSchema);
  const foundHeaders = originalHeaders.filter(
    header =>
      expectedHeaders.includes(header) ||
      expectedHeaders.find(eh => eh.toLowerCase() === header.toLowerCase())
  );

  // Find required headers that are missing
  const missingRequired = Object.entries(expectedSchema)
    .filter(
      ([key, value]) =>
        value.required &&
        !foundHeaders.find(h => h === key || h.toLowerCase() === key.toLowerCase())
    )
    .map(([key]) => key);

  // Get column mapping suggestions based on data type (AI-enhanced)
  const columnSuggestions = await getColumnMappingSuggestions(parsedData[0], dataType);

  // Return first 5 rows of data as sample
  const sampleData = parsedData.slice(0, 5);

  return {
    data: parsedData,
    columnSuggestions,
    sampleData,
    headerValidation: {
      missingRequired,
      foundHeaders,
      expectedHeaders,
    },
  };
}

// Validate and clean loyalty data
export async function validateLoyaltyData(
  data: unknown[] // Kept as unknown[] as per checkpoint snippet for restoration
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    totalRows: data.length,
    importedRows: 0,
    errors: [],
    mappedData: [],
    missingFields: [],
  };

  // Perform basic validation
  // RawLoyaltyCsvRow type and loyaltyImportRowSchema are defined/imported earlier
  basicValidateLoyaltyData(data as RawLoyaltyCsvRow[], result);

  try {
    await enhanceValidationWithAI(result, 'loyalty');
  } catch (error: unknown) {
    console.log('Error enhancing validation with AI:', error);
  }

  result.importedRows = result.mappedData.length;
  result.success = result.errors.length === 0 && result.missingFields.length === 0;

  return result;
}

// Infer the validated row type from the Zod schema
type ValidatedLoyaltyRow = z.infer<typeof loyaltyImportRowSchema>;

// Basic loyalty data validation
export function basicValidateLoyaltyData(
  data: RawLoyaltyCsvRow[],
  result: ImportResult
): ImportResult {
  const processedLoyaltyIds = new Set<string>();
  const validatedRows: ValidatedLoyaltyRow[] = [];

  data.forEach((rawRow, index) => {
    const rowNumber = index + 1;
    let hasRowSpecificErrors = false;

    const parseResult = loyaltyImportRowSchema.safeParse(rawRow);

    if (parseResult.success) {
      const validatedRow = parseResult.data;

      if (validatedRow.loyaltyId) {
        if (processedLoyaltyIds.has(validatedRow.loyaltyId)) {
          result.errors.push({
            row: rowNumber,
            field: 'loyaltyId',
            value: validatedRow.loyaltyId,
            reason: 'Duplicate Loyalty ID found in import file.',
          });
          hasRowSpecificErrors = true;
        } else {
          processedLoyaltyIds.add(validatedRow.loyaltyId);
        }
      }

      if (
        validatedRow.points !== undefined &&
        validatedRow.points !== null &&
        validatedRow.points < 0
      ) {
        result.errors.push({
          row: rowNumber,
          field: 'points',
          value: String(rawRow.points),
          reason: 'Points cannot be negative.',
        });
        hasRowSpecificErrors = true;
      }

      if (!hasRowSpecificErrors) {
        validatedRows.push(validatedRow);
      }
    } else {
      parseResult.error.issues.forEach(issue => {
        const field = issue.path.join('.') || 'unknown_field';
        const originalValue =
          issue.path.length > 0 && rawRow[issue.path[0] as keyof RawLoyaltyCsvRow] !== undefined
            ? String(rawRow[issue.path[0] as keyof RawLoyaltyCsvRow])
            : rawRow && typeof rawRow === 'object' && field in rawRow
              ? String(rawRow[field as keyof RawLoyaltyCsvRow])
              : 'N/A';

        const isRequiredError =
          issue.code === 'invalid_type' && issue.received === 'undefined' && issue.path.length > 0;
        const isZodRequiredMessage = issue.message.toLowerCase().includes('required');

        if (isRequiredError || isZodRequiredMessage) {
          const alreadyMissing = result.missingFields.some(
            mf => mf.row === rowNumber && mf.field === field
          );
          if (!alreadyMissing) {
            result.missingFields.push({
              row: rowNumber,
              field: field,
              isRequired: true,
            });
          }
        }

        result.errors.push({
          row: rowNumber,
          field: field,
          value: originalValue,
          reason: issue.message,
        });
      });
      hasRowSpecificErrors = true;
    }

    // This logic was part of the checkpoint viewed_code_item for basicValidateLoyaltyData
    // It sets result.success per row, which might be overridden later by the main success check.
    // For consistency with how `validateLoyaltyData` calculates overall success, this might be redundant here.
    // However, restoring from checkpoint means including it if it was there.
    // The viewed_code_item snippet in the prompt actually had this structure:
    /*
    if (hasRowSpecificErrors) {
      result.success = false; 
    }
    */
    // Let's include it as per the most complete version seen in the checkpoint's `viewed_code_item`.
    if (hasRowSpecificErrors) {
      // This doesn't directly set result.success = false, rather errors/missingFields are checked later.
      // The original snippet from the prompt did not have `result.success = false` here.
      // It's better to let the calling function or the end of this function determine overall success.
    }
  });

  result.mappedData = validatedRows;
  // The following lines for importedRows and success were in the more complete version of basicValidateLoyaltyData from the checkpoint's viewed_code_item
  result.importedRows = validatedRows.length;
  if (data.length > 0) {
    result.success = result.errors.length === 0 && result.missingFields.length === 0;
  } else {
    result.success = true; // No data, so technically successful import of nothing
  }

  return result;
}

// Validate and clean inventory data
export async function validateInventoryData(
  data: Record<string, any>[],
  storeId: number
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    totalRows: data.length,
    importedRows: 0,
    errors: [],
    mappedData: [],
    missingFields: [],
  };

  // Perform basic validation
  basicValidateInventoryData(data, result);

  // Try AI-powered validation enhancement if available
  try {
    await enhanceValidationWithAI(result, 'inventory');
  } catch (error: unknown) {
    console.log('Error enhancing validation with AI:', error);
    // Continue with basic validation results if AI enhancement fails
  }

  // Calculate imported rows
  result.importedRows = data.length - result.errors.length - result.missingFields.length;

  return result;
}

// Basic inventory data validation
export function basicValidateInventoryData(
  data: Record<string, any>[],
  result: ImportResult
): ImportResult {
  const validatedRows: Record<string, any>[] = [];

  data.forEach((row, index) => {
    const rowNumber = index + 1;
    let hasRowSpecificErrors = false;

    // Validate required fields
    const requiredFields = ['name', 'barcode', 'price', 'categoryId', 'quantity'];
    requiredFields.forEach(field => {
      if (!(field in row) || row[field] === null || row[field] === undefined) {
        result.missingFields.push({
          row: rowNumber,
          field: field,
          isRequired: true,
        });
        hasRowSpecificErrors = true;
      }
    });

    // Validate data types
    if (!hasRowSpecificErrors) {
      if (typeof row.name !== 'string' || row.name.trim().length === 0) {
        result.errors.push({
          row: rowNumber,
          field: 'name',
          value: String(row.name),
          reason: 'Name must be a non-empty string.',
        });
        hasRowSpecificErrors = true;
      }

      if (typeof row.barcode !== 'string' || row.barcode.trim().length === 0) {
        result.errors.push({
          row: rowNumber,
          field: 'barcode',
          value: String(row.barcode),
          reason: 'Barcode must be a non-empty string.',
        });
        hasRowSpecificErrors = true;
      }

      if (typeof row.price !== 'number' || isNaN(row.price)) {
        result.errors.push({
          row: rowNumber,
          field: 'price',
          value: String(row.price),
          reason: 'Price must be a valid number.',
        });
        hasRowSpecificErrors = true;
      }

      if (typeof row.categoryId !== 'number' && typeof row.categoryId !== 'string') {
        result.errors.push({
          row: rowNumber,
          field: 'categoryId',
          value: String(row.categoryId),
          reason: 'Category ID must be a number or string.',
        });
        hasRowSpecificErrors = true;
      }

      if (typeof row.quantity !== 'number' || isNaN(row.quantity)) {
        result.errors.push({
          row: rowNumber,
          field: 'quantity',
          value: String(row.quantity),
          reason: 'Quantity must be a valid number.',
        });
        hasRowSpecificErrors = true;
      }
    }

    if (!hasRowSpecificErrors) {
      validatedRows.push(row);
    }
  });

  result.mappedData = validatedRows;
  result.importedRows = validatedRows.length;
  if (data.length > 0) {
    result.success = result.errors.length === 0 && result.missingFields.length === 0;
  } else {
    result.success = true; // No data, so technically successful import of nothing
  }

  return result;
}

// Import validated inventory data to database
export async function importInventoryData(
  data: Record<string, any>[],
  storeId: number
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    totalRows: data.length,
    importedRows: 0,
    errors: [],
    mappedData: [],
    missingFields: [],
    lastUpdated: new Date(),
  };

  // Get all categories for category name matching
  const categories = await storage.getAllCategories();
  const categoryMap = new Map<string, number>();
  categories.forEach(category => {
    categoryMap.set(category.name.toLowerCase(), category.id);
  });

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNumber = i + 1;

    try {
      // Resolve category ID if it's a name
      let categoryId = row.categoryId;
      if (typeof categoryId === 'string' && isNaN(parseInt(categoryId, 10))) {
        const matchedCategoryId = categoryMap.get(categoryId.toLowerCase());
        if (!matchedCategoryId) {
          throw new Error(`Category "${categoryId}" not found`);
        }
        categoryId = matchedCategoryId;
      }

      // Check if product already exists by barcode
      const existingProduct = await storage.getProductByBarcode(row.barcode);

      if (existingProduct) {
        // Update existing product
        await storage.updateProduct(existingProduct.id, {
          name: row.name,
          description: row.description || existingProduct.description,
          price: row.price.toString(),
          categoryId: categoryId,
          isPerishable: row.isPerishable || false,
        });

        // Update inventory for specific store
        const inventoryItem = await storage.getStoreProductInventory(storeId, existingProduct.id);

        if (inventoryItem) {
          // Update existing inventory
          await storage.updateInventory(inventoryItem.id, {
            totalQuantity: row.quantity,
            minimumLevel: row.minStockLevel || inventoryItem.minimumLevel,
            // updatedAt is handled by Drizzle or storage method
          });
        } else {
          // Create new inventory entry for this store/product
          await db.insert(schema.inventory).values({
            storeId: storeId,
            productId: existingProduct.id,
            totalQuantity: row.quantity,
            minimumLevel: row.minStockLevel || 5,
            // createdAt and updatedAt are handled by Drizzle defaults
          });
        }
      } else {
        // Create new product
        const [newProduct] = await db
          .insert(schema.products)
          .values({
            name: row.name,
            sku: row.sku, // Added required sku field
            description: row.description || '',
            barcode: row.barcode,
            price: row.price.toString(),
            categoryId: categoryId,
            isPerishable: row.isPerishable || false,
          })
          .returning();

        // Create inventory entry for this store/product
        await db.insert(schema.inventory).values({
          storeId: storeId,
          productId: newProduct.id,
          totalQuantity: row.quantity,
          minimumLevel: row.minStockLevel || 5,
          // createdAt and updatedAt are handled by Drizzle defaults
        });
      }

      result.importedRows++;
    } catch (error: any) {
      result.errors.push({
        row: rowNumber,
        field: 'general',
        value: JSON.stringify(row),
        reason: error.message || 'Unknown error during import',
      });
    }
  }

  result.success = result.importedRows > 0;
  return result;
}

// Import validated loyalty data to database
export async function importLoyaltyData(
  data: ValidatedLoyaltyRow[],
  storeId: number
): Promise<ImportResult> {
  // Note: `data` contains rows processed by `basicValidateLoyaltyData`
  // `points` is a number, `enrollmentDate` is a Date object if present.
  const result: ImportResult = {
    success: true,
    totalRows: data.length,
    importedRows: 0,
    errors: [],
    mappedData: [],
    missingFields: [],
    lastUpdated: new Date(),
  };

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNumber = i + 1;

    try {
      // Check if loyalty member already exists
      const existingMember = await storage.getLoyaltyMemberByLoyaltyId(row.loyaltyId);

      if (existingMember) {
        // Update existing member
        await storage.updateLoyaltyMember(existingMember.id, {
          points: row.points ?? existingMember.points, // Use 'points' and ensure it's a number
        });

        // Get and update customer
        const customer = await db.query.customers.findFirst({
          where: eq(schema.customers.id, existingMember.customerId),
        });
        if (customer) {
          await db
            .update(schema.customers)
            .set({
              name: row.name || customer.name,
              email: row.email ?? customer.email,
              phone: row.phone ?? customer.phone,
              updatedAt: new Date(),
            })
            .where(eq(schema.customers.id, customer.id));
        }
      } else {
        // Create new customer
        // Email is required for new customers as per schema.CustomerInsert
        if (!row.email) {
          throw new Error(
            `Email is required to create a new customer (loyaltyId: ${row.loyaltyId}).`
          );
        }
        const customerData: schema.CustomerInsert = {
          name: row.name, // name is string (required by basicValidateLoyaltyData)
          email: row.email, // email is now confirmed string
          phone: row.phone || undefined, // Zod optional prefers undefined
        };

        // Create customer first, then loyalty member
        const [customer] = await db.insert(schema.customers).values(customerData).returning();
        if (!customer) {
          throw new Error(`Failed to create customer (loyaltyId: ${row.loyaltyId})`);
        }

        // Create new loyalty member linked to customer
        const memberData: schema.LoyaltyMemberInsert = {
          programId: 1, // FIXME: Determine correct programId logic. This is a placeholder.
          loyaltyId: row.loyaltyId,
          customerId: customer.id,
          tierId: null, // tierId is nullable
          points: row.points ?? 0, // Use 'points', ensure number. row.points is already number.
          joinDate: row.enrollmentDate || new Date(), // Use 'joinDate'. row.enrollmentDate is already Date.
        };

        await storage.createLoyaltyMember(memberData);
      }

      result.importedRows++;
    } catch (error: any) {
      result.errors.push({
        row: rowNumber,
        field: 'general',
        value: JSON.stringify(row),
        reason: error.message || 'Unknown error during import',
      });
    }
  }

  result.success = result.importedRows > 0;
  return result;
}

// Generate error report for failed imports
export function generateErrorReport(
  result: ImportResult,
  dataType: 'loyalty' | 'inventory'
): string {
  const timestamp = result.lastUpdated
    ? new Date(result.lastUpdated).toLocaleString()
    : new Date().toLocaleString();
  const headerInfo = [
    [`${dataType.charAt(0).toUpperCase() + dataType.slice(1)} Data Import Error Report`],
    [`Generated: ${timestamp}`],
    [`Total Rows: ${result.totalRows}`],
    [`Successfully Imported: ${result.importedRows}`],
    [`Failed: ${result.totalRows - result.importedRows}`],
    [''],
    ['Row', 'Field', 'Value', 'Error Reason'],
  ];

  // Start with header rows
  const rows = [...headerInfo];

  // Add errors to report
  result.errors.forEach(error => {
    rows.push([error.row.toString(), error.field, error.value, error.reason]);
  });

  // Add missing required fields to report
  result.missingFields
    .filter(field => field.isRequired)
    .forEach(field => {
      rows.push([
        field.row.toString(),
        field.field,
        'MISSING',
        `Required field "${field.field}" is missing`,
      ]);
    });

  // Sort data rows by row number (preserve header rows)
  const headerRows = rows.slice(0, 7); // First 7 rows are header info
  const dataRows = rows.slice(7).sort((a: string[], b: string[]) => {
    // Check if the values are parseable numbers
    const numA = !isNaN(parseInt(String(a[0]))) ? parseInt(String(a[0])) : 0;
    const numB = !isNaN(parseInt(String(b[0]))) ? parseInt(String(b[0])) : 0;
    return numA - numB;
  });

  // Combine header and sorted data rows
  const sortedRows = [...headerRows, ...dataRows];

  // Convert to CSV
  return csvStringify(sortedRows);
}

// This function analyzes the headers and suggests mappings
async function getColumnMappingSuggestions(
  sampleRow: Record<string, any>,
  dataType: 'loyalty' | 'inventory'
): Promise<ColumnMapping[]> {
  const sourceColumns = Object.keys(sampleRow);
  const targetColumns = getTargetColumns(dataType);

  const suggestions: ColumnMapping[] = [];

  // For each source column, find the best match in target columns
  for (const source of sourceColumns) {
    const matchResult = findBestMatch(source, targetColumns);
    suggestions.push({
      source,
      target: matchResult.match,
      confidence: matchResult.confidence,
      required: matchResult.required,
    });
  }

  // Enhance mappings with AI if available
  try {
    const enhancedSuggestions = await enhanceMappingsWithAI(suggestions, sourceColumns, dataType);
    return enhancedSuggestions;
  } catch (error: unknown) {
    console.log('Error enhancing mappings with AI:', error);
    // If AI enhancement fails, return the basic pattern matching results
    return suggestions;
  }
}

// Use Dialogflow to enhance column mapping suggestions
async function enhanceMappingsWithAI(
  initialSuggestions: ColumnMapping[],
  sourceColumns: string[],
  dataType: 'loyalty' | 'inventory'
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
    const targetFields = getTargetColumns(dataType)
      .map(col => `${col.name}${col.required ? ' (required)' : ''}`)
      .join(', ');

    const lowConfidenceMappings = initialSuggestions
      .filter(mapping => mapping.confidence < 0.7)
      .map(mapping => `${mapping.source} => ${mapping.target} (confidence: ${mapping.confidence})`)
      .join('\n');

    const prompt = `I need to map columns from a CSV file to specific target fields in my database. 
    The source columns are: ${sourceColumns.join(', ')}
    The target fields I'm trying to map to are: ${targetFields}
    
    I already have these suggested mappings with low confidence:
    ${lowConfidenceMappings}
    
    Based on common naming patterns for ${dataType} data, can you suggest better mappings for these low confidence fields?
    Please respond in a structured format with just the improved mappings as source => target with confidence score (0-1).`;

    // Send the request to Dialogflow
    const request = {
      session: sessionPath,
      queryInput: {
        text: {
          text: prompt,
          languageCode: 'en-US',
        },
      },
    };

    // Get Dialogflow response
    const [response] = await sessionClient.detectIntent(request);

    if (!response.queryResult) {
      throw new Error('No query result returned from Dialogflow');
    }

    const responseText = response.queryResult.fulfillmentText || '';

    // Parse the response to extract improved mappings
    const improvedMappings = parseDialogflowMappingResponse(
      responseText,
      initialSuggestions,
      dataType
    );

    return improvedMappings;
  } catch (error: unknown) {
    console.error('Error using Dialogflow for column mapping:', error);
    return initialSuggestions;
  }
}

// Parse Dialogflow response to extract improved mappings
function parseDialogflowMappingResponse(
  responseText: string,
  initialSuggestions: ColumnMapping[],
  dataType: 'loyalty' | 'inventory'
): ColumnMapping[] {
  // Make a copy of the initial suggestions
  const enhancedSuggestions = [...initialSuggestions];

  // Look for patterns like "source => target (confidence: 0.8)" in the response
  const mappingPattern = /([^=]+)\s*=>\s*([^(]+)\s*\(confidence:\s*([\d.]+)\)/gi;
  const matches = responseText.matchAll(mappingPattern);

  for (const match of Array.from(matches)) {
    if (match.length >= 4) {
      const source = match[1].trim();
      const target = match[2].trim();
      const confidence = parseFloat(match[3].trim());

      // Find this suggestion in our initial set
      const index = enhancedSuggestions.findIndex(s => s.source === source);

      if (index !== -1 && !isNaN(confidence)) {
        // Only update if the AI confidence is higher than our initial confidence
        if (confidence > enhancedSuggestions[index].confidence) {
          // Find the required flag from the target columns
          const targetColumns = getTargetColumns(dataType);
          const targetColumn = targetColumns.find(t => t.name === target);
          const isRequired = targetColumn?.required || false;

          enhancedSuggestions[index] = {
            source,
            target,
            confidence,
            required: isRequired,
          };
        }
      }
    }
  }

  return enhancedSuggestions;
}

// Get the target column names for the given data type
function getTargetColumns(
  dataType: 'loyalty' | 'inventory'
): { name: string; required: boolean }[] {
  if (dataType === 'loyalty') {
    return [
      { name: 'name', required: true },
      { name: 'email', required: false },
      { name: 'phone', required: false },
      { name: 'loyaltyId', required: true },
      { name: 'points', required: false },
      { name: 'enrollmentDate', required: false },
    ];
  } else {
    return [
      { name: 'name', required: true },
      { name: 'description', required: false },
      { name: 'barcode', required: true },
      { name: 'price', required: true },
      { name: 'categoryId', required: true },
      { name: 'isPerishable', required: false },
      { name: 'quantity', required: true },
      { name: 'minStockLevel', required: false },
      { name: 'expiryDate', required: false },
    ];
  }
}

// Find the best match for a source column in the target columns
function findBestMatch(
  source: string,
  targets: { name: string; required: boolean }[]
): { match: string; confidence: number; required: boolean } {
  // Normalize the source string for comparison
  const normalizedSource = source.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Common aliases for fields
  const aliases: Record<string, string[]> = {
    name: ['productname', 'item', 'itemname', 'title', 'product', 'fullname', 'customername'],
    description: ['desc', 'details', 'productdescription', 'info', 'about', 'notes'],
    barcode: ['sku', 'upc', 'ean', 'code', 'itemcode', 'productcode', 'barcode'],
    price: ['cost', 'unitprice', 'saleprice', 'retailprice', 'amount'],
    categoryId: ['category', 'categoryname', 'department', 'section', 'group', 'productcategory'],
    isPerishable: ['perishable', 'expires', 'hasexpiration', 'expiry', 'expiration'],
    quantity: ['qty', 'stock', 'stocklevel', 'inventory', 'onhand', 'available'],
    minStockLevel: ['minstock', 'reorderpoint', 'reorderlevel', 'minimumstock'],
    expiryDate: ['expiry', 'expiration', 'expirationdate', 'expires', 'bestbefore'],
    email: ['email', 'emailaddress', 'mail', 'e-mail', 'customermail'],
    phone: ['phone', 'phonenumber', 'telephone', 'mobile', 'cell', 'contact'],
    loyaltyId: ['loyalty', 'loyaltyid', 'memberid', 'membershipid', 'cardnumber', 'loyaltynumber'],
    points: ['points', 'loyaltypoints', 'rewardpoints', 'balance', 'pointbalance'],
    enrollmentDate: [
      'enrolled',
      'enrollmentdate',
      'joindate',
      'registered',
      'startdate',
      'membershipdate',
    ],
  };

  let bestMatch = '';
  let highestConfidence = 0;
  let isRequired = false;

  for (const target of targets) {
    const normalizedTarget = target.name.toLowerCase();

    // Direct match
    if (normalizedSource === normalizedTarget) {
      return { match: target.name, confidence: 1, required: target.required };
    }

    // Check if source contains target
    if (
      normalizedSource.includes(normalizedTarget) ||
      normalizedTarget.includes(normalizedSource)
    ) {
      const confidence = 0.8;
      if (confidence > highestConfidence) {
        highestConfidence = confidence;
        bestMatch = target.name;
        isRequired = target.required;
      }
    }

    // Check aliases
    if (aliases[target.name]) {
      for (const alias of aliases[target.name]) {
        if (normalizedSource === alias) {
          return { match: target.name, confidence: 0.9, required: target.required };
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
    return { match: '', confidence: 0, required: false };
  }

  return { match: bestMatch, confidence: highestConfidence, required: isRequired };
}

// Apply column mapping to raw data
export function applyColumnMapping(
  data: Record<string, any>[],
  mapping: Record<string, string>
): Record<string, any>[] {
  return data.map(row => {
    const mappedRow: Record<string, any> = {};

    Object.entries(mapping).forEach(([source, target]) => {
      if (target && source in row) {
        mappedRow[target] = row[source];
      }
    });

    return mappedRow;
  });
}
