import { parse as csvParse } from 'csv-parse/sync';
import { stringify as csvStringify } from 'csv-stringify/sync';
import * as xlsx from 'xlsx';
import { storage } from '../storage';
import * as schema from '@shared/schema';
import { eq } from 'drizzle-orm';
import { db } from '@db/index';
import { SessionsClient } from '@google-cloud/dialogflow';
import { enhanceValidationWithAI } from './import-ai';

// Define types for import data
export interface ImportResult {
  success: boolean;
  totalRows: number;
  importedRows: number;
  errors: ImportError[];
  mappedData: Record<string, unknown>[];
  missingFields: MissingField[];
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
    categoryId: { required: true, type: 'string', description: 'Category ID or name' }, // Changed type to string
    quantity: { required: true, type: 'number', description: 'Current stock quantity' },
    minStockLevel: { required: false, type: 'number', description: 'Minimum stock level for alerts' },
    isPerishable: { required: false, type: 'boolean', description: 'Whether product is perishable' },
    expiryDate: { required: false, type: 'date', description: 'Expiry date for perishable products' }
  },
  loyalty: {
    loyaltyId: { required: true, type: 'string', description: 'Unique loyalty member ID' },
    name: { required: true, type: 'string', description: 'Customer name' },
    email: { required: false, type: 'string', description: 'Customer email address' },
    phone: { required: false, type: 'string', description: 'Customer phone number' },
    points: { required: false, type: 'number', description: 'Current loyalty points balance' },
    enrollmentDate: { required: false, type: 'date', description: 'Date customer enrolled in program' }
  }
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
        const lowered = String(value).toLowerCase();
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
    default:
      return false;
  }
}

// This is the main function for processing import files
export async function processImportFile(
  fileBuffer: Buffer,
  fileType: string,
  dataType: 'loyalty' | 'inventory'
): Promise<{ 
  data: Record<string, unknown>[];
  columnSuggestions: ColumnMapping[];
  sampleData: Record<string, unknown>[];
  headerValidation: {
    missingRequired: string[];
    foundHeaders: string[];
    expectedHeaders: string[];
  }
}> {
  // Parse file based on type
  let parsedData: Record<string, unknown>[] = [];
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
      const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Get headers from the first row
      const range = xlsx.utils.decode_range(worksheet['!ref'] || 'A1');
      originalHeaders = [];
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = xlsx.utils.encode_cell({ r: range.s.r, c: col });
        if (worksheet[cellAddress] && worksheet[cellAddress].v !== undefined) {
          originalHeaders.push(String(worksheet[cellAddress].v));
        }
      }
      
      parsedData = xlsx.utils.sheet_to_json(worksheet) as Record<string, unknown>[];
    } else {
      throw new Error('Unsupported file type. Please upload a CSV or Excel file.');
    }
  } catch (error) {
    console.error('Error parsing file:', error);
    throw new Error(`Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    data: parsedData,
    columnSuggestions,
    sampleData,
    headerValidation: {
      missingRequired,
      foundHeaders,
      expectedHeaders
    }
  };
}

// This function analyzes the headers and suggests mappings
async function getColumnMappingSuggestions(
  sampleRow: Record<string, unknown>,
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
      required: matchResult.required
    });
  }
  
  // Enhance mappings with AI if available
  try {
    const enhancedSuggestions = await enhanceMappingsWithAI(suggestions, sourceColumns, dataType);
    return enhancedSuggestions;
  } catch (error) {
    console.log("Error enhancing mappings with AI:", error);
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
    console.log("Dialogflow credentials not found. Using basic mapping only.");
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
    ).join(", ");
    
    const lowConfidenceMappings = initialSuggestions
      .filter(mapping => mapping.confidence < 0.7)
      .map(mapping => `${mapping.source} => ${mapping.target} (confidence: ${mapping.confidence})`)
      .join("\n");
    
    let prompt = `I need to map columns from a CSV file to specific target fields in my database. 
    The source columns are: ${sourceColumns.join(", ")}
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
      throw new Error("No query result returned from Dialogflow");
    }
    
    const responseText = response.queryResult.fulfillmentText || "";
    
    // Parse the response to extract improved mappings
    const improvedMappings = parseDialogflowMappingResponse(responseText, initialSuggestions, dataType);
    
    return improvedMappings;
  } catch (error) {
    console.error("Error using Dialogflow for column mapping:", error);
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
            required: isRequired
          };
        }
      }
    }
  }
  
  return enhancedSuggestions;
}

// Get the target column names for the given data type
function getTargetColumns(dataType: 'loyalty' | 'inventory'): { name: string; required: boolean }[] {
  if (dataType === 'loyalty') {
    return [
      { name: 'fullName', required: true },
      { name: 'email', required: false },
      { name: 'phone', required: false },
      { name: 'loyaltyId', required: true },
      { name: 'points', required: false },
      { name: 'tier', required: false },
      { name: 'enrollmentDate', required: false },
      { name: 'storeId', required: true },
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
      { name: 'storeId', required: true },
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
    fullName: ['name', 'customername', 'customer', 'fullname', 'contact', 'contactname'],
    email: ['email', 'emailaddress', 'mail', 'e-mail', 'customermail'],
    phone: ['phone', 'phonenumber', 'telephone', 'mobile', 'cell', 'contact'],
    loyaltyId: ['loyalty', 'loyaltyid', 'memberid', 'membershipid', 'cardnumber', 'loyaltynumber'],
    points: ['points', 'loyaltypoints', 'rewardpoints', 'balance', 'pointbalance'],
    tier: ['tier', 'level', 'loyaltytier', 'membertier', 'status', 'rank'],
    enrollmentDate: ['enrolled', 'enrollmentdate', 'joindate', 'registered', 'startdate', 'membershipdate'],
    name: ['productname', 'item', 'itemname', 'title', 'product'],
    description: ['desc', 'details', 'productdescription', 'info', 'about', 'notes'],
    barcode: ['sku', 'upc', 'ean', 'code', 'itemcode', 'productcode', 'barcode'],
    price: ['cost', 'unitprice', 'saleprice', 'retailprice', 'amount'],
    categoryId: ['category', 'categoryname', 'department', 'section', 'group', 'productcategory'],
    isPerishable: ['perishable', 'expires', 'hasexpiration', 'expiry', 'expiration'],
    quantity: ['qty', 'stock', 'stocklevel', 'inventory', 'onhand', 'available'],
    storeId: ['store', 'location', 'branch', 'storeid', 'storelocation', 'outlet']
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

// Apply column mapping to transform imported data
export function applyColumnMapping(
  data: Record<string, unknown>[],
  mapping: Record<string, string>
): Record<string, unknown>[] {
  return data.map(row => {
    const transformedRow: Record<string, unknown> = {};
    
    for (const [source, target] of Object.entries(mapping)) {
      if (target && row[source] !== undefined) {
        transformedRow[target] = row[source];
      }
    }
    
    return transformedRow;
  });
}

// Validate and clean loyalty data with AI enhancement
export async function validateLoyaltyData(
  data: Record<string, unknown>[]
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    totalRows: data.length,
    importedRows: 0,
    errors: [],
    mappedData: [],
    missingFields: []
  };
  
  // Perform basic validation
  basicValidateLoyaltyData(data, result);
  
  // Try AI-powered validation enhancement if available
  try {
    await enhanceValidationWithAI(result, 'loyalty');
  } catch (error) {
    console.log("Error enhancing validation with AI:", error);
    // Continue with basic validation results if AI enhancement fails
  }
  
  return result;
}

// Basic loyalty data validation
/**
 * Basic validation for loyalty data with improved field handling and data type validation
 * 
 * @param data - The loyalty data to validate
 * @param result - The import result object to update with validation results
 * @returns Updated import result
 */
function validateLoyaltyRow(
  cleanedRow: Record<string, unknown>,
  rowNumber: number,
  result: ImportResult,
  processedEmails: Set<string>
): boolean {
  let hasErrors = false;

  // Full name validation
  if (!cleanedRow.fullName || String(cleanedRow.fullName).trim().length < 3) {
    result.missingFields.push({
      row: rowNumber,
      field: 'fullName',
      isRequired: true
    });
    hasErrors = true;
  }

  // Email validation
  if (cleanedRow.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(cleanedRow.email))) {
      result.errors.push({
        row: rowNumber,
        field: 'email',
        value: String(cleanedRow.email),
        reason: 'Invalid email format'
      });
      hasErrors = true;
    } else if (processedEmails.has(String(cleanedRow.email).toLowerCase())) {
      result.errors.push({
        row: rowNumber,
        field: 'email',
        value: String(cleanedRow.email),
        reason: 'Duplicate email found'
      });
      hasErrors = true;
    } else {
      processedEmails.add(String(cleanedRow.email).toLowerCase());
    }
  } else {
    result.missingFields.push({
      row: rowNumber,
      field: 'email',
      isRequired: true
    });
    hasErrors = true;
  }

  // Phone validation (optional but example shown)
  if (cleanedRow.phone) {
    const cleanPhone = String(cleanedRow.phone).replace(/\D/g, '');
    if (cleanPhone.length < 7) {
      result.errors.push({
        row: rowNumber,
        field: 'phone',
        value: String(cleanedRow.phone),
        reason: 'Phone number must be at least 7 digits'
      });
      hasErrors = true;
    }
  }

  // Add any additional field or row-level validation here

  return hasErrors;
}

export function basicValidateLoyaltyData(
  data: Record<string, unknown>[],
  result: ImportResult
): ImportResult {
  const processedEmails = new Set<string>();
  data.forEach((row, idx) => {
    const rowNumber = idx + 2; // +2 if header is row 1
    const cleanedRow: Record<string, unknown> = { ...row };
    const hasErrors = validateLoyaltyRow(cleanedRow, rowNumber, result, processedEmails);
    if (!hasErrors) {
      result.mappedData.push(cleanedRow);
      result.importedRows++;
    }
  });
  result.success = result.importedRows > 0;
  return result;
}

// Validate and clean inventory data
export async function validateInventoryData(
  data: Record<string, unknown>[]
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    totalRows: data.length,
    importedRows: 0,
    errors: [],
    mappedData: [],
    missingFields: []
  };
  
  // Perform basic validation
  basicValidateInventoryData(data, result);
  
  // Try AI-powered validation enhancement if available
  try {
    await enhanceValidationWithAI(result, 'inventory');
  } catch (error) {
    console.log("Error enhancing validation with AI:", error);
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
  data: Record<string, unknown>[],
  result: ImportResult
): ImportResult {
  const processedBarcodes = new Set<string>();
  const schema = expectedSchemas.inventory;
  
  data.forEach((row, index) => {
    const rowNumber = index + 1;
    const cleanedRow: Record<string, unknown> = { ...row };
    let hasErrors = false;
    
    // Validate each field against the expected schema
    Object.entries(schema).forEach(([field, definition]) => {
      const value = cleanedRow[field];
      
      // Check required fields
      if (definition.required && (value === null || value === undefined || String(value).trim() === '')) {
        result.missingFields.push({
          row: rowNumber,
          field,
          isRequired: true
        });
        hasErrors = true;
        return; // Skip further validation for this field
      }
      
      // Skip validation for optional empty fields
      if (!definition.required && (value === null || value === undefined || String(value).trim() === '')) {
        return;
      }
      
      // Validate data type
      if (!validateDataType(value, definition.type)) {
        result.errors.push({
          row: rowNumber,
          field,
          value: String(value),
          reason: `Invalid data type for ${field}. Expected ${definition.type}.`
        });
        hasErrors = true;
        return;
      }
      
      // Field-specific validation
      switch (field) {
        case 'name':
          if (typeof value === 'string' && value.trim().length < 2) {
            result.errors.push({
              row: rowNumber,
              field,
              value,
              reason: 'Product name must be at least 2 characters long'
            });
            hasErrors = true;
          }
          break;
        // ... other cases ...
      }
    });

    // CategoryId logic should be outside the switch and field loop
    if (!cleanedRow.categoryId) {
      result.missingFields.push({
        row: rowNumber,
        field: 'categoryId',
        isRequired: true
      });
      hasErrors = true;
    } else {
      // Try to match category by name if it's not a number
      if (isNaN(parseInt(String(cleanedRow.categoryId), 10))) {
        // We'll let the import process handle category name matching
      } else {
        cleanedRow.categoryId = parseInt(String(cleanedRow.categoryId), 10);
      }
    }

    if (!cleanedRow.quantity) {
      result.missingFields.push({
        row: rowNumber,
        field: 'quantity',
        isRequired: true
      });
      hasErrors = true;
    } else {
      // Ensure quantity is a valid number
      try {
        cleanedRow.quantity = parseInt(String(cleanedRow.quantity), 10);
        if (isNaN(cleanedRow.quantity as number) || (cleanedRow.quantity as number) < 0) {
          throw new Error('Invalid quantity');
        }
      } catch (error) {
        result.errors.push({
          row: rowNumber,
          field: 'quantity',
          value: String(row.quantity),
          reason: 'Quantity must be a valid positive number'
        });
        hasErrors = true;
      }
    }
    
    // Validate reorderLevel field if present
    if (cleanedRow.reorderLevel !== undefined && cleanedRow.reorderLevel !== null && String(cleanedRow.reorderLevel).trim() !== '') {
      try {
        cleanedRow.reorderLevel = parseInt(String(cleanedRow.reorderLevel), 10);
        if (isNaN(cleanedRow.reorderLevel as number) || (cleanedRow.reorderLevel as number) < 0) {
          throw new Error('Invalid reorder level');
        }
      } catch (error) {
        result.errors.push({
          row: rowNumber,
          field: 'reorderLevel',
          value: String(row.reorderLevel),
          reason: 'Reorder level must be a valid positive number'
        });
        hasErrors = true;
      }
    }
    
    // Validate reorderQuantity field if present
    if (cleanedRow.reorderQuantity !== undefined && cleanedRow.reorderQuantity !== null && String(cleanedRow.reorderQuantity).trim() !== '') {
      try {
        cleanedRow.reorderQuantity = parseInt(String(cleanedRow.reorderQuantity), 10);
        if (isNaN(cleanedRow.reorderQuantity as number) || (cleanedRow.reorderQuantity as number) < 0) {
          throw new Error('Invalid reorder quantity');
        }
      } catch (error) {
        result.errors.push({
          row: rowNumber,
          field: 'reorderQuantity',
          value: String(row.reorderQuantity),
          reason: 'Reorder quantity must be a valid positive number'
        });
        hasErrors = true;
      }
    }
    
    if (!cleanedRow.storeId) {
      result.missingFields.push({
        row: rowNumber,
        field: 'storeId',
        isRequired: true
      });
      hasErrors = true;
    } else {
      // Ensure storeId is a number
      try {
        cleanedRow.storeId = parseInt(String(cleanedRow.storeId), 10);
        if (isNaN(cleanedRow.storeId as number)) throw new Error('Invalid store ID');
      } catch (error) {
        result.errors.push({
          row: rowNumber,
          field: 'storeId',
          value: String(row.storeId),
          reason: 'Store ID must be a valid number'
        });
        hasErrors = true;
      }
    }
    
    // Handle isPerishable field - convert various string formats to boolean
    if (cleanedRow.isPerishable !== undefined) {
      if (typeof cleanedRow.isPerishable === 'string') {
        const value = cleanedRow.isPerishable.toLowerCase().trim();
        
        if (['yes', 'y', 'true', '1', 't'].includes(value)) {
          cleanedRow.isPerishable = true;
        } else if (['no', 'n', 'false', '0', 'f'].includes(value)) {
          cleanedRow.isPerishable = false;
        } else {
          result.errors.push({
            row: rowNumber,
            field: 'isPerishable',
            value: String(row.isPerishable),
            reason: 'Invalid value for perishable flag. Use Yes/No, True/False, 1/0, etc.'
          });
          hasErrors = true;
        }
      } else if (typeof cleanedRow.isPerishable === 'number') {
        cleanedRow.isPerishable = cleanedRow.isPerishable !== 0;
      }
    } else {
      // Default to false if not provided
      cleanedRow.isPerishable = false;
    }
    
    // Validate batch number if present
    if (cleanedRow.batchNumber !== undefined && cleanedRow.batchNumber !== null) {
      if (typeof cleanedRow.batchNumber === 'string' && cleanedRow.batchNumber.trim() === '') {
        cleanedRow.batchNumber = null;
      }
    }
    
    // Validate expiry date if present
    if (cleanedRow.expiryDate !== undefined && cleanedRow.expiryDate !== null && String(cleanedRow.expiryDate).trim() !== '') {
      try {
        const date = new Date(String(cleanedRow.expiryDate));
        if (isNaN(date.getTime())) {
          throw new Error('Invalid date format');
        }
        
        // For perishable items, expiry date should be in the future
        if (cleanedRow.isPerishable && date < new Date()) {
          result.errors.push({
            row: rowNumber,
            field: 'expiryDate',
            value: String(cleanedRow.expiryDate),
            reason: 'Expiry date must be in the future for perishable items'
          });
          hasErrors = true;
        } else {
          cleanedRow.expiryDate = date.toISOString().split('T')[0]; // Store as YYYY-MM-DD
        }
      } catch (error) {
        result.errors.push({
          row: rowNumber,
          field: 'expiryDate',
          value: String(cleanedRow.expiryDate),
          reason: 'Invalid date format. Use YYYY-MM-DD'
        });
        hasErrors = true;
      }
    } else if (cleanedRow.isPerishable === true) {
      // For perishable items, warn if no expiry date provided
      result.missingFields.push({
        row: rowNumber,
        field: 'expiryDate',
        isRequired: false
      }); // Closes the push to missingFields
    } // Closes 'else if (cleanedRow.isPerishable === true)'

    if (!hasErrors) {
      result.mappedData.push(cleanedRow);
      result.importedRows++;
    }
  }); // Closes the data.forEach loop

  result.success = result.errors.length === 0 && result.missingFields.length === 0;
  return result;
} // Closes basicValidateInventoryData function

// Import validated loyalty data to database
export async function importLoyaltyData(data: Record<string, unknown>[], storeId: number): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    totalRows: data.length,
    importedRows: 0,
    errors: [],
    mappedData: [],
    missingFields: []
  };

  // Get loyalty program ID for the store
  const loyaltyProgram = await storage.getLoyaltyProgram(storeId);
  if (!loyaltyProgram) {
    throw new Error(`No loyalty program found for store ID ${storeId}`);
  }

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNumber = i + 1;

    try {
      // Check if loyalty ID already exists
      const existingMember = await storage.getLoyaltyMemberByLoyaltyId(String(row.loyaltyId));
      
      if (existingMember) {
        // Update existing member with valid fields
        const updatePayload: Partial<schema.LoyaltyMember> = {};
        if (row.points !== undefined) {
          updatePayload.currentPoints = String(row.points);
        }
        if (row.tierId !== undefined) { // Use tierId from row if present
          updatePayload.tierId = row.tierId as number | null;
        }
        if (row.enrollmentDate !== undefined) {
          updatePayload.enrollmentDate = new Date(String(row.enrollmentDate));
        }
        updatePayload.lastActivity = new Date(); // Corrected property name

        await storage.updateLoyaltyMember(existingMember.id, updatePayload);
      } else {
        // Create new user (customer) first
        const userData: schema.UserInsert = {
          fullName: String(row.fullName),
          email: String(row.email) || null,
          // phone: String(row.phone) || null, // Removed as 'phone' is not in UserInsert schema
          // storeId: storeId // Removed as UserInsert schema does not currently accept it
          // Add other relevant fields for user creation if necessary
        };
        
        const user = await storage.createUser(userData); // Assuming createUser replaces createCustomer
        
        // Create new loyalty member linked to user
        const memberData: schema.LoyaltyMemberInsert = {
          loyaltyId: String(row.loyaltyId),
          userId: user.id, // Link to user.id, assuming LoyaltyMember links to User now
          loyaltyProgramId: loyaltyProgram.id, // Link to the loyalty program
          tierId: row.tierId as number | null || null, // Default tier or from row
          currentPoints: row.points ? String(row.points) : "0",
          enrollmentDate: row.enrollmentDate ? new Date(String(row.enrollmentDate)) : new Date(),
          lastActivity: new Date() // Corrected property name here too
        };
        
        await storage.createLoyaltyMember(memberData);
      }
      
      result.importedRows++;
    } catch (error) {
      result.errors.push({
        row: rowNumber, // Ensure rowNumber is defined in this scope
        field: 'general',
        value: JSON.stringify(row), // Ensure row is defined in this scope
        reason: error instanceof Error ? error.message : 'Unknown error during import'
      });
    }
  }

  result.success = result.errors.length === 0 && result.missingFields.length === 0;
  return result;
}

// Import validated inventory data to database
export async function importInventoryData(data: Record<string, unknown>[], storeId: number): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    totalRows: data.length,
    importedRows: 0,
    errors: [],
    mappedData: [],
    missingFields: []
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
      let categoryId = row.categoryId as string | number;
      if (typeof categoryId === 'string' && isNaN(parseInt(categoryId, 10))) {
        const matchedCategoryId = categoryMap.get(categoryId.toLowerCase());
        if (!matchedCategoryId) {
          throw new Error(`Category "${categoryId}" not found`);
        }
        categoryId = matchedCategoryId;
      }
      
      // Check if product already exists by barcode
      const existingProduct = await storage.getProductByBarcode(String(row.barcode));
      
      if (existingProduct) {
        // Update existing product
        await storage.updateProduct(existingProduct.id, {
          name: String(row.name),
          // TODO: Add 'description' to ProductUpdate schema if it's a valid updatable field
          // description: String(row.description) || existingProduct.description,
          price: String(row.price),
          // TODO: Add 'categoryId' to ProductUpdate schema if it's a valid updatable field
          // categoryId: categoryId as number,
          isPerishable: row.isPerishable !== undefined ? Boolean(row.isPerishable) : existingProduct.isPerishable,
        });
        
        // Update inventory quantity
        const inventory = await storage.getStoreProductInventory(storeId, existingProduct.id);
        if (inventory) {
          await storage.updateInventory(inventory.id, {
            totalQuantity: Number(row.quantity)
          });
        } else {
          // Create inventory record if it doesn't exist
          await db.insert(schema.inventory).values({
            storeId: storeId,
            productId: existingProduct.id,
            totalQuantity: Number(row.quantity),
            minimumLevel: Number(row.minimumLevel) || 10,
            batchNumber: String(row.batchNumber) || null,
            expiryDate: row.expiryDate ? new Date(String(row.expiryDate)) : null,
            lastStockUpdate: new Date()
          });
        }
      } else {
        // Create new product
        const productData: schema.ProductInsert = {
          name: String(row.name),
          description: String(row.description) || '',
          barcode: String(row.barcode),
          price: String(row.price),
          cost: row.cost ? String(row.cost) : '0',
          categoryId: categoryId as number,
          isPerishable: Boolean(row.isPerishable) || false,
        };
        
        const newProduct = await storage.createProduct(productData);
        
        // Create inventory record
        await db.insert(schema.inventory).values({
          storeId: storeId,
          productId: newProduct.id,
          totalQuantity: Number(row.quantity),
          minimumLevel: Number(row.minimumLevel) || 10,
          batchNumber: String(row.batchNumber) || null,
          expiryDate: row.expiryDate ? new Date(String(row.expiryDate)) : null,
          lastStockUpdate: new Date()
        } as typeof schema.inventory.$inferInsert); // Added explicit cast
      }
      
      result.importedRows++;
    } catch (error) {
      result.errors.push({
        row: rowNumber,
        field: 'general',
        value: JSON.stringify(row),
        reason: error instanceof Error ? error.message : 'Unknown error during import'
      });
    }
  }
  
  result.success = result.errors.length === 0 && result.missingFields.length === 0;
  return result;
}

// Format validation errors as CSV string
export function formatErrorsAsCsv(errors: ImportError[]): string {
  if (errors.length === 0) return '';
  
  const rows = [
    ['Row', 'Field', 'Value', 'Error']
  ];
  
  errors.forEach(error => {
    rows.push([
      error.row.toString(), 
      error.field, 
      error.value, 
      error.reason
    ]);
  });
  
  return csvStringify(rows);
}

// Format missing fields as CSV string
export function formatMissingFieldsAsCsv(missingFields: MissingField[]): string {
  if (missingFields.length === 0) return '';
  
  const rows = [
    ['Row', 'Field', 'Required']
  ];
  
  missingFields.forEach(field => {
    rows.push([
      field.row.toString(), 
      field.field, 
      field.isRequired ? 'Yes' : 'No'
    ]);
  });
  
  return csvStringify(rows);
}