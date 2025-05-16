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
  mappedData: any[];
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
    categoryId: { required: true, type: 'any', description: 'Category ID or name' },
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
export function validateDataType(value: any, expectedType: string): boolean {
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
  }
}

// This is the main function for processing import files
export async function processImportFile(
  fileBuffer: Buffer,
  fileType: string,
  dataType: 'loyalty' | 'inventory'
): Promise<{ 
  data: any[]; 
  columnSuggestions: ColumnMapping[];
  sampleData: any[];
  headerValidation: {
    missingRequired: string[];
    foundHeaders: string[];
    expectedHeaders: string[];
  }
}> {
  // Parse file based on type
  let parsedData: any[] = [];
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
        if (worksheet[cellAddress]) {
          originalHeaders.push(worksheet[cellAddress].v);
        }
      }
      
      parsedData = xlsx.utils.sheet_to_json(worksheet);
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
      required: matchResult.required
    });
  }
  
  // Enhance mappings with AI if available
  try {
    const enhancedSuggestions = await enhanceMappingsWithAI(suggestions, sourceColumns, dataType);
    return enhancedSuggestions;
  } catch (error: any) {
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
  } catch (error: any) {
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
  data: any[],
  mapping: Record<string, string>
): any[] {
  return data.map(row => {
    const transformedRow: Record<string, any> = {};
    
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
  data: any[]
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
  } catch (error: any) {
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
export function basicValidateLoyaltyData(
  data: any[],
  result: ImportResult
): ImportResult {
  
  const processedLoyaltyIds = new Set<string>();
  const processedEmails = new Set<string>();
  const processedPhones = new Set<string>();
  
  data.forEach((row, index) => {
    const rowNumber = index + 1;
    const cleanedRow = { ...row };
    let hasErrors = false;
    
    // Check required fields
    if (!cleanedRow.fullName) {
      result.missingFields.push({
        row: rowNumber,
        field: 'fullName',
        isRequired: true
      });
      hasErrors = true;
    } else if (typeof cleanedRow.fullName === 'string' && cleanedRow.fullName.trim().length < 3) {
      result.errors.push({
        row: rowNumber,
        field: 'fullName',
        value: cleanedRow.fullName,
        reason: 'Full name must be at least 3 characters long'
      });
      hasErrors = true;
    }
    
    // Validate email if present
    if (cleanedRow.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanedRow.email)) {
        result.errors.push({
          row: rowNumber,
          field: 'email',
          value: cleanedRow.email,
          reason: 'Invalid email format'
        });
        hasErrors = true;
      } else if (processedEmails.has(cleanedRow.email.toLowerCase())) {
        result.errors.push({
          row: rowNumber,
          field: 'email',
          value: cleanedRow.email,
          reason: 'Duplicate email found'
        });
        hasErrors = true;
      } else {
        // Store normalized email for duplicate checking
        processedEmails.add(cleanedRow.email.toLowerCase());
      }
    }
    
    // Validate phone if present
    if (cleanedRow.phone) {
      // Remove non-numeric characters for validation
      const cleanPhone = cleanedRow.phone.toString().replace(/\D/g, '');
      
      if (cleanPhone.length < 10 || cleanPhone.length > 15) {
        result.errors.push({
          row: rowNumber,
          field: 'phone',
          value: cleanedRow.phone,
          reason: 'Phone number should be between 10-15 digits'
        });
        hasErrors = true;
      } else if (processedPhones.has(cleanPhone)) {
        result.errors.push({
          row: rowNumber,
          field: 'phone',
          value: cleanedRow.phone,
          reason: 'Duplicate phone number found'
        });
        hasErrors = true;
      } else {
        // Store normalized phone for duplicate checking and update the value
        processedPhones.add(cleanPhone);
        cleanedRow.phone = cleanPhone;
      }
    }
    
    // Validate loyalty ID
    if (!cleanedRow.loyaltyId) {
      result.missingFields.push({
        row: rowNumber,
        field: 'loyaltyId',
        isRequired: true
      });
      hasErrors = true;
    } else {
      const loyaltyId = String(cleanedRow.loyaltyId).trim();
      
      // Check if loyalty ID format is valid (alphanumeric and at least 4 chars)
      if (!/^[a-zA-Z0-9]{4,}$/.test(loyaltyId)) {
        result.errors.push({
          row: rowNumber,
          field: 'loyaltyId',
          value: loyaltyId,
          reason: 'Loyalty ID must be at least 4 alphanumeric characters'
        });
        hasErrors = true;
      }
      
      // Check duplicate loyalty IDs
      else if (processedLoyaltyIds.has(loyaltyId.toLowerCase())) {
        result.errors.push({
          row: rowNumber,
          field: 'loyaltyId',
          value: loyaltyId,
          reason: 'Duplicate loyalty ID found'
        });
        hasErrors = true;
      } else {
        processedLoyaltyIds.add(loyaltyId.toLowerCase());
        cleanedRow.loyaltyId = loyaltyId;
      }
    }
    
    // Validate store ID
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
        cleanedRow.storeId = parseInt(cleanedRow.storeId, 10);
        if (isNaN(cleanedRow.storeId)) throw new Error('Invalid store ID');
      } catch (error: any) {
        result.errors.push({
          row: rowNumber,
          field: 'storeId',
          value: row.storeId,
          reason: 'Store ID must be a valid number'
        });
        hasErrors = true;
      }
    }
    
    // Validate tier if present
    if (cleanedRow.tier) {
      const validTiers = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
      const normalizedTier = cleanedRow.tier.toString().toLowerCase().trim();
      
      if (!validTiers.includes(normalizedTier)) {
        result.errors.push({
          row: rowNumber,
          field: 'tier',
          value: cleanedRow.tier,
          reason: 'Invalid tier. Valid tiers are: Bronze, Silver, Gold, Platinum, Diamond'
        });
        hasErrors = true;
      } else {
        // Capitalize first letter for consistency
        cleanedRow.tier = normalizedTier.charAt(0).toUpperCase() + normalizedTier.slice(1);
      }
    }
    
    // Validate points
    if (cleanedRow.points !== undefined && cleanedRow.points !== null && cleanedRow.points !== '') {
      try {
        cleanedRow.points = parseInt(String(cleanedRow.points).replace(/[^\d.]/g, ''), 10);
        if (isNaN(cleanedRow.points) || cleanedRow.points < 0) {
          throw new Error('Invalid points value');
        }
      } catch (error: any) {
        result.errors.push({
          row: rowNumber,
          field: 'points',
          value: row.points,
          reason: 'Points must be a valid positive number'
        });
        hasErrors = true;
      }
    } else {
      // Default points to 0 if not provided
      cleanedRow.points = 0;
    }
    
    // Validate status if present
    if (cleanedRow.status) {
      const validStatuses = ['active', 'inactive', 'pending', 'suspended'];
      const normalizedStatus = cleanedRow.status.toString().toLowerCase().trim();
      
      if (!validStatuses.includes(normalizedStatus)) {
        result.errors.push({
          row: rowNumber,
          field: 'status',
          value: cleanedRow.status,
          reason: 'Invalid status. Valid statuses are: Active, Inactive, Pending, Suspended'
        });
        hasErrors = true;
      } else {
        // Capitalize first letter for consistency
        cleanedRow.status = normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1);
      }
    } else {
      // Default status to Active if not provided
      cleanedRow.status = 'Active';
    }
    
    // Validate enrollment date
    if (cleanedRow.enrollmentDate) {
      try {
        const date = new Date(cleanedRow.enrollmentDate);
        if (isNaN(date.getTime())) throw new Error('Invalid date');
        
        // Ensure enrollment date is not in the future
        if (date > new Date()) {
          result.errors.push({
            row: rowNumber,
            field: 'enrollmentDate',
            value: cleanedRow.enrollmentDate,
            reason: 'Enrollment date cannot be in the future'
          });
          hasErrors = true;
        } else {
          cleanedRow.enrollmentDate = date.toISOString().split('T')[0]; // Store as YYYY-MM-DD
        }
      } catch (error: any) {
        result.errors.push({
          row: rowNumber,
          field: 'enrollmentDate',
          value: row.enrollmentDate,
          reason: 'Invalid date format. Use YYYY-MM-DD'
        });
        hasErrors = true;
      }
    } else {
      // Default to current date if not provided
      cleanedRow.enrollmentDate = new Date().toISOString().split('T')[0];
    }
    
    if (!hasErrors) {
      result.mappedData.push(cleanedRow);
      result.importedRows++;
    }
  });
  
  result.success = result.errors.length === 0;
  return result;
}

// Validate and clean inventory data
export async function validateInventoryData(
  data: any[]
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
  } catch (error: any) {
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
  data: any[],
  result: ImportResult
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
          row: rowNumber,
          field,
          isRequired: true
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
          
        case 'barcode':
          if (typeof value === 'string') {
            if (value.trim().length < 4) {
              result.errors.push({
                row: rowNumber,
                field,
                value,
                reason: 'Barcode must be at least 4 characters long'
              });
              hasErrors = true;
            } else if (processedBarcodes.has(value)) {
              result.errors.push({
                row: rowNumber,
                field,
                value,
                reason: 'Duplicate barcode found in import file'
              });
              hasErrors = true;
            } else {
              processedBarcodes.add(value);
            }
          }
          break;
    } else {
      // Check duplicate barcodes
      if (processedBarcodes.has(cleanedRow.barcode)) {
        result.errors.push({
          row: rowNumber,
          field: 'barcode',
          value: cleanedRow.barcode,
          reason: 'Duplicate barcode found'
        });
        hasErrors = true;
      }
      processedBarcodes.add(cleanedRow.barcode);
    }
    
    if (!cleanedRow.price) {
      result.missingFields.push({
        row: rowNumber,
        field: 'price',
        isRequired: true
      });
      hasErrors = true;
    } else {
      // Ensure price is a valid number
      try {
        // Handle price formatting (e.g. "$10.99" -> 10.99)
        if (typeof cleanedRow.price === 'string') {
          cleanedRow.price = cleanedRow.price.replace(/[^0-9.]/g, '');
        }
        cleanedRow.price = parseFloat(cleanedRow.price);
        if (isNaN(cleanedRow.price) || cleanedRow.price < 0) {
          throw new Error('Invalid price');
        }
      } catch (error: any) {
        result.errors.push({
          row: rowNumber,
          field: 'price',
          value: row.price,
          reason: 'Price must be a valid positive number'
        });
        hasErrors = true;
      }
    }
    
    // Validate cost field if present (optional)
    if (cleanedRow.cost !== undefined && cleanedRow.cost !== null && cleanedRow.cost !== '') {
      try {
        // Handle cost formatting (e.g. "$8.50" -> 8.50)
        if (typeof cleanedRow.cost === 'string') {
          cleanedRow.cost = cleanedRow.cost.replace(/[^0-9.]/g, '');
        }
        cleanedRow.cost = parseFloat(cleanedRow.cost);
        if (isNaN(cleanedRow.cost) || cleanedRow.cost < 0) {
          throw new Error('Invalid cost');
        }
      } catch (error: any) {
        result.errors.push({
          row: rowNumber,
          field: 'cost',
          value: row.cost,
          reason: 'Cost must be a valid positive number'
        });
        hasErrors = true;
      }
    } else {
      // Default cost can be set in the defaults function in import-ai.ts
      cleanedRow.cost = 0;
    }
    
    if (!cleanedRow.categoryId) {
      result.missingFields.push({
        row: rowNumber,
        field: 'categoryId',
        isRequired: true
      });
      hasErrors = true;
    } else {
      // Try to match category by name if it's not a number
      if (isNaN(parseInt(cleanedRow.categoryId, 10))) {
        // We'll let the import process handle category name matching
      } else {
        // Ensure categoryId is a number if it looks like one
        cleanedRow.categoryId = parseInt(cleanedRow.categoryId, 10);
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
        cleanedRow.quantity = parseInt(cleanedRow.quantity, 10);
        if (isNaN(cleanedRow.quantity) || cleanedRow.quantity < 0) {
          throw new Error('Invalid quantity');
        }
      } catch (error: any) {
        result.errors.push({
          row: rowNumber,
          field: 'quantity',
          value: row.quantity,
          reason: 'Quantity must be a valid positive number'
        });
        hasErrors = true;
      }
    }
    
    // Validate reorderLevel field if present
    if (cleanedRow.reorderLevel !== undefined && cleanedRow.reorderLevel !== null && cleanedRow.reorderLevel !== '') {
      try {
        cleanedRow.reorderLevel = parseInt(cleanedRow.reorderLevel, 10);
        if (isNaN(cleanedRow.reorderLevel) || cleanedRow.reorderLevel < 0) {
          throw new Error('Invalid reorder level');
        }
      } catch (error: any) {
        result.errors.push({
          row: rowNumber,
          field: 'reorderLevel',
          value: row.reorderLevel,
          reason: 'Reorder level must be a valid positive number'
        });
        hasErrors = true;
      }
    }
    
    // Validate reorderQuantity field if present
    if (cleanedRow.reorderQuantity !== undefined && cleanedRow.reorderQuantity !== null && cleanedRow.reorderQuantity !== '') {
      try {
        cleanedRow.reorderQuantity = parseInt(cleanedRow.reorderQuantity, 10);
        if (isNaN(cleanedRow.reorderQuantity) || cleanedRow.reorderQuantity < 0) {
          throw new Error('Invalid reorder quantity');
        }
      } catch (error: any) {
        result.errors.push({
          row: rowNumber,
          field: 'reorderQuantity',
          value: row.reorderQuantity,
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
        cleanedRow.storeId = parseInt(cleanedRow.storeId, 10);
        if (isNaN(cleanedRow.storeId)) throw new Error('Invalid store ID');
      } catch (error: any) {
        result.errors.push({
          row: rowNumber,
          field: 'storeId',
          value: row.storeId,
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
            value: row.isPerishable,
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
    if (cleanedRow.expiryDate !== undefined && cleanedRow.expiryDate !== null && cleanedRow.expiryDate !== '') {
      try {
        const date = new Date(cleanedRow.expiryDate);
        if (isNaN(date.getTime())) {
          throw new Error('Invalid date format');
        }
        
        // For perishable items, expiry date should be in the future
        if (cleanedRow.isPerishable && date < new Date()) {
          result.errors.push({
            row: rowNumber,
            field: 'expiryDate',
            value: cleanedRow.expiryDate,
            reason: 'Expiry date must be in the future for perishable items'
          });
          hasErrors = true;
        } else {
          cleanedRow.expiryDate = date.toISOString().split('T')[0]; // Store as YYYY-MM-DD
        }
      } catch (error: any) {
        result.errors.push({
          row: rowNumber,
          field: 'expiryDate',
          value: cleanedRow.expiryDate,
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
      });
    }
    
    if (!hasErrors) {
      result.mappedData.push(cleanedRow);
      result.importedRows++;
    }
  });
  
  result.success = result.errors.length === 0;
  return result;
}

// Import validated loyalty data to database
export async function importLoyaltyData(data: any[], storeId: number): Promise<ImportResult> {
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
      const existingMember = await storage.getLoyaltyMemberByLoyaltyId(row.loyaltyId);
      
      if (existingMember) {
        // Update existing member with valid fields
        await storage.updateLoyaltyMember(existingMember.id, {
          // We don't store fullName directly on loyaltyMember but should update customer
          // Any customer updates would need to be handled separately
          currentPoints: row.points !== undefined ? row.points.toString() : existingMember.currentPoints,
          tierId: row.tierId || existingMember.tierId,
          enrollmentDate: row.enrollmentDate ? new Date(row.enrollmentDate) : existingMember.enrollmentDate,
          lastActivity: new Date(),
        });
      } else {
        // Create new customer first
        const customerData: schema.CustomerInsert = {
          fullName: row.fullName, 
          email: row.email || null,
          phone: row.phone || null,
          storeId: storeId
        };
        
        // Create customer first, then loyalty member
        const customer = await storage.createCustomer(customerData);
        
        // Create new loyalty member linked to customer
        const memberData: schema.LoyaltyMemberInsert = {
          loyaltyId: row.loyaltyId,
          customerId: customer.id,
          tierId: null, // Default tier - can be updated later
          currentPoints: row.points ? row.points.toString() : "0",
          enrollmentDate: row.enrollmentDate ? new Date(row.enrollmentDate) : new Date()
        };
        
        await storage.createLoyaltyMember(memberData);
      }
      
      result.importedRows++;
    } catch (error: any) {
      result.errors.push({
        row: rowNumber,
        field: 'general',
        value: JSON.stringify(row),
        reason: error.message || 'Unknown error during import'
      });
    }
  }
  
  result.success = result.importedRows > 0;
  return result;
}

// Import validated inventory data to database
export async function importInventoryData(data: any[], storeId: number): Promise<ImportResult> {
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
          isPerishable: row.isPerishable !== undefined ? row.isPerishable : existingProduct.isPerishable,
        });
        
        // Update inventory quantity
        const inventory = await storage.getStoreProductInventory(storeId, existingProduct.id);
        if (inventory) {
          await storage.updateInventory(inventory.id, {
            quantity: row.quantity
          });
        } else {
          // Create inventory record if it doesn't exist
          await db.insert(schema.inventory).values({
            storeId: storeId,
            productId: existingProduct.id,
            quantity: row.quantity,
            minimumLevel: row.minimumLevel || 10,
            batchNumber: row.batchNumber || null,
            expiryDate: row.expiryDate ? new Date(row.expiryDate) : null,
            lastStockUpdate: new Date()
          });
        }
      } else {
        // Create new product
        const productData: schema.ProductInsert = {
          name: row.name,
          description: row.description || '',
          barcode: row.barcode,
          price: row.price.toString(),
          cost: row.cost ? row.cost.toString() : '0',
          categoryId: categoryId,
          isPerishable: row.isPerishable || false,
        };
        
        const newProduct = await storage.createProduct(productData);
        
        // Create inventory record
        await db.insert(schema.inventory).values({
          storeId: storeId,
          productId: newProduct.id,
          quantity: row.quantity,
          minimumLevel: row.minimumLevel || 10,
          batchNumber: row.batchNumber || null,
          expiryDate: row.expiryDate ? new Date(row.expiryDate) : null,
          lastStockUpdate: new Date()
        });
      }
      
      result.importedRows++;
    } catch (error: any) {
      result.errors.push({
        row: rowNumber,
        field: 'general',
        value: JSON.stringify(row),
        reason: error.message || 'Unknown error during import'
      });
    }
  }
  
  result.success = result.importedRows > 0;
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