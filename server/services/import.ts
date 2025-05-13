import { parse as csvParse } from 'csv-parse/sync';
import { stringify as csvStringify } from 'csv-stringify/sync';
import * as xlsx from 'xlsx';
import { storage } from '../storage';
import * as schema from '@shared/schema';
import { eq } from 'drizzle-orm';
import { db } from '@db/index';
import { SessionsClient } from '@google-cloud/dialogflow';

// Define types for import data
interface ImportResult {
  success: boolean;
  totalRows: number;
  importedRows: number;
  errors: ImportError[];
  mappedData: any[];
  missingFields: MissingField[];
}

interface ImportError {
  row: number;
  field: string;
  value: string;
  reason: string;
}

interface MissingField {
  row: number;
  field: string;
  isRequired: boolean;
}

interface ColumnMapping {
  source: string;
  target: string;
  confidence: number;
  required: boolean;
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
}> {
  // Parse file based on type
  let parsedData: any[] = [];
  
  if (fileType.includes('csv')) {
    parsedData = csvParse(fileBuffer, {
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
    parsedData = xlsx.utils.sheet_to_json(worksheet);
  } else {
    throw new Error('Unsupported file type. Please upload a CSV or Excel file.');
  }

  if (parsedData.length === 0) {
    throw new Error('No data found in the uploaded file.');
  }

  // Get column mapping suggestions based on data type (AI-enhanced)
  const columnSuggestions = await getColumnMappingSuggestions(parsedData[0], dataType);
  
  // Return first 5 rows of data as sample
  const sampleData = parsedData.slice(0, 5);
  
  return {
    data: parsedData,
    columnSuggestions,
    sampleData,
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
  } catch (error) {
    console.log("Error enhancing validation with AI:", error);
    // Continue with basic validation results if AI enhancement fails
  }
  
  return result;
}

// Basic loyalty data validation
function basicValidateLoyaltyData(
  data: any[],
  result: ImportResult
): void {
  
  const processedLoyaltyIds = new Set<string>();
  
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
    }
    
    if (!cleanedRow.loyaltyId) {
      result.missingFields.push({
        row: rowNumber,
        field: 'loyaltyId',
        isRequired: true
      });
      hasErrors = true;
    } else {
      // Check duplicate loyalty IDs
      if (processedLoyaltyIds.has(cleanedRow.loyaltyId)) {
        result.errors.push({
          row: rowNumber,
          field: 'loyaltyId',
          value: cleanedRow.loyaltyId,
          reason: 'Duplicate loyalty ID found'
        });
        hasErrors = true;
      }
      processedLoyaltyIds.add(cleanedRow.loyaltyId);
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
      } catch (error) {
        result.errors.push({
          row: rowNumber,
          field: 'storeId',
          value: row.storeId,
          reason: 'Store ID must be a valid number'
        });
        hasErrors = true;
      }
    }
    
    // Clean and validate points - convert various formats
    if (cleanedRow.points !== undefined) {
      try {
        cleanedRow.points = parseInt(cleanedRow.points, 10);
        if (isNaN(cleanedRow.points) || cleanedRow.points < 0) {
          throw new Error('Invalid points value');
        }
      } catch (error) {
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
    
    // Clean and validate enrollmentDate
    if (cleanedRow.enrollmentDate) {
      try {
        const date = new Date(cleanedRow.enrollmentDate);
        if (isNaN(date.getTime())) throw new Error('Invalid date');
        cleanedRow.enrollmentDate = date.toISOString();
      } catch (error) {
        result.errors.push({
          row: rowNumber,
          field: 'enrollmentDate',
          value: row.enrollmentDate,
          reason: 'Invalid date format'
        });
        hasErrors = true;
      }
    } else {
      // Default to current date if not provided
      cleanedRow.enrollmentDate = new Date().toISOString();
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
export function validateInventoryData(
  data: any[]
): ImportResult {
  const result: ImportResult = {
    success: true,
    totalRows: data.length,
    importedRows: 0,
    errors: [],
    mappedData: [],
    missingFields: []
  };
  
  const processedBarcodes = new Set<string>();
  
  data.forEach((row, index) => {
    const rowNumber = index + 1;
    const cleanedRow = { ...row };
    let hasErrors = false;
    
    // Check required fields
    if (!cleanedRow.name) {
      result.missingFields.push({
        row: rowNumber,
        field: 'name',
        isRequired: true
      });
      hasErrors = true;
    }
    
    if (!cleanedRow.barcode) {
      result.missingFields.push({
        row: rowNumber,
        field: 'barcode',
        isRequired: true
      });
      hasErrors = true;
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
      } catch (error) {
        result.errors.push({
          row: rowNumber,
          field: 'price',
          value: row.price,
          reason: 'Price must be a valid positive number'
        });
        hasErrors = true;
      }
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
      } catch (error) {
        result.errors.push({
          row: rowNumber,
          field: 'quantity',
          value: row.quantity,
          reason: 'Quantity must be a valid positive number'
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
      } catch (error) {
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
        // Update existing member
        await storage.updateLoyaltyMember(existingMember.id, {
          fullName: row.fullName,
          email: row.email || existingMember.email,
          phone: row.phone || existingMember.phone,
          points: row.points !== undefined ? row.points : existingMember.points,
          tierId: row.tierId || existingMember.tierId,
          enrollmentDate: row.enrollmentDate ? new Date(row.enrollmentDate) : existingMember.enrollmentDate,
          lastActivityDate: new Date(),
        });
      } else {
        // Create new member
        const memberData: schema.LoyaltyMemberInsert = {
          loyaltyId: row.loyaltyId,
          fullName: row.fullName,
          email: row.email || null,
          phone: row.phone || null,
          programId: loyaltyProgram.id,
          tierId: null, // Default tier - can be updated later
          points: row.points || 0,
          enrollmentDate: row.enrollmentDate ? new Date(row.enrollmentDate) : new Date(),
          lastActivityDate: new Date(),
          isActive: true,
        };
        
        await storage.createLoyaltyMember(memberData);
      }
      
      result.importedRows++;
    } catch (error) {
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
            lastUpdated: new Date()
          });
        }
      } else {
        // Create new product
        const productData: schema.ProductInsert = {
          name: row.name,
          description: row.description || '',
          barcode: row.barcode,
          price: row.price.toString(),
          categoryId: categoryId,
          isPerishable: row.isPerishable || false,
        };
        
        const newProduct = await storage.createProduct(productData);
        
        // Create inventory record
        await db.insert(schema.inventory).values({
          storeId: storeId,
          productId: newProduct.id,
          quantity: row.quantity,
          lastUpdated: new Date()
        });
      }
      
      result.importedRows++;
    } catch (error) {
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