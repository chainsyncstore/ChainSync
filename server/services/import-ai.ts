import { SessionsClient } from '@google-cloud/dialogflow';

import type { ImportResult, ImportError, MissingField } from './import';

/**
 * Use Dialogflow to enhance data validation with AI insights
 * This function analyzes validation errors and missing fields, then uses AI to suggest fixes
 *
 * @param result - The ImportResult object containing validation results and import data
 * @param dataType - The type of data being imported ('loyalty' or 'inventory')
 * @returns A Promise that resolves when AI enhancement is complete
 */
export async function enhanceValidationWithAI(
  result: ImportResult,
  dataType: 'loyalty' | 'inventory'
): Promise<void> {
  console.log(`Starting AI validation enhancement for ${dataType} data...`);

  // Skip if there are no errors or if all rows are already valid
  if (result.errors.length === 0 && result.missingFields.length === 0) {
    console.log('No validation issues found. Skipping AI enhancement.');
    return;
  }

  console.log(
    `Found ${result.errors.length} validation errors and ${result.missingFields.length} missing fields`
  );

  // Check if Dialogflow credentials are available
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS || !process.env.DIALOGFLOW_PROJECT_ID) {
    console.log('Dialogflow credentials not found. Using basic validation only.');
    return;
  }

  try {
    // Initialize Dialogflow session client
    const sessionClient = new SessionsClient();
    const sessionId = `import-validation-${Date.now()}`;
    const sessionPath = sessionClient.projectAgentSessionPath(
      process.env.DIALOGFLOW_PROJECT_ID,
      sessionId
    );

    console.log(`Dialogflow session initialized: ${sessionId}`);

    // Prepare a sample of validation issues for Dialogflow to analyze
    const errorSample = result.errors
      .slice(0, 5)
      .map((err: unknown) => `Row ${err.row}: ${err.field} = "${err.value}" (${err.reason})`)
      .join('\n');

    const missingSample = result.missingFields
      .slice(0, 5)
      .map(
        (field: unknown) =>
          `Row ${field.row}: ${field.field} is missing ${field.isRequired ? '(required)' : '(optional)'}`
      )
      .join('\n');

    // Prepare the prompt for Dialogflow with more context based on data type
    const prompt = `I'm trying to validate imported ${dataType} data and have encountered validation issues.
    
    Here are some examples of the errors:
    ${errorSample}
    
    And missing fields:
    ${missingSample}
    
    ${
      dataType === 'inventory'
        ? `For inventory data, please consider:
      - Barcodes should be at least 4 characters
      - Prices and costs should be positive numbers
      - Product names should be at least 2 characters
      - Quantities should be positive integers
      - isPerishable field should be a boolean (true/false, yes/no, 1/0)
      - Expiry dates should be in a valid date format (YYYY-MM-DD)`
        : `For loyalty data, please consider:
      - Loyalty IDs should be unique
      - Email addresses should be in a valid format
      - Phone numbers should follow a consistent format
      - Points should be numeric values
      - Enrollment dates should be in a valid date format`
    }
    
    Based on your understanding of ${dataType} data, can you suggest:
    1. Specific corrections for each of the errors above (Row X: change "value" to "corrected_value")
    2. Alternative valid formats for problematic fields
    3. How to handle the missing fields (default values or data requirements)
    
    Please format your response as actionable suggestions that could be directly applied to the data.`;

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
    console.log('Sending request to Dialogflow with validation data...');
    const [response] = await sessionClient.detectIntent(request);

    if (!response.queryResult) {
      throw new Error('No query result returned from Dialogflow');
    }

    const responseText = response.queryResult.fulfillmentText || '';
    console.log('Received Dialogflow response with suggested fixes');

    // Log a summary of the response (not the full response to avoid cluttering logs)
    const responsePreview =
      responseText.length > 150 ? responseText.substring(0, 147) + '...' : responseText;
    console.log(`AI response preview: "${responsePreview}"`);

    // Analyze the response to find potential fixes
    console.log('Analyzing AI response for fix suggestions...');
    applyAISuggestedFixes(result, responseText, dataType);

    // Log a summary of applied changes
    const fixedErrorCount = result.errors.length > 0 ? result.totalRows - result.errors.length : 0;
    const fixedMissingFieldCount =
      result.missingFields.length > 0 ? result.totalRows - result.missingFields.length : 0;

    console.log(
      `AI enhancement complete. Fixed ${fixedErrorCount} validation errors and ${fixedMissingFieldCount} missing fields.`
    );
    console.log(
      `Updated import success status: ${result.success ? 'Success' : 'Validation issues remain'}`
    );
    console.log(`Importable rows: ${result.importedRows} of ${result.totalRows}`);
  } catch (error: unknown) {
    console.error('Error using Dialogflow for validation enhancement:', error);
    // Just log the error and continue with basic validation
  }
}

// Parse and apply AI-suggested fixes to validation results
function applyAISuggestedFixes(
  result: ImportResult,
  aiResponse: string,
  dataType: 'loyalty' | 'inventory'
): void {
  // Extract key phrases that might indicate fixes with more pattern variations
  const fixPatterns = [
    // Patterns with row numbers
    /Row\s+(\d+).*?["']([^"']+)["'].*?change to.*?["']([^"']+)["']/gi,
    /Row\s+(\d+).*?["']([^"']+)["'].*?should be.*?["']([^"']+)["']/gi,
    /Row\s+(\d+).*?["']([^"']+)["'].*?correct to.*?["']([^"']+)["']/gi,
    /Row\s+(\d+).*?["']([^"']+)["'].*?update to.*?["']([^"']+)["']/gi,
    /Row\s+(\d+).*?["']([^"']+)["'].*?convert to.*?["']([^"']+)["']/gi,
    /For row\s+(\d+).*?change.*?["']([^"']+)["'].*?to.*?["']([^"']+)["']/gi,

    // General fix patterns without row numbers
    /suggest changing\s+["']([^"']+)["']\s+to\s+["']([^"']+)["']/gi,
    /replace\s+["']([^"']+)["']\s+with\s+["']([^"']+)["']/gi,
    /update\s+["']([^"']+)["']\s+to\s+["']([^"']+)["']/gi,
    /convert\s+["']([^"']+)["']\s+to\s+["']([^"']+)["']/gi,
    /correct\s+["']([^"']+)["']\s+to\s+["']([^"']+)["']/gi,
  ];

  // Patterns for missing field suggestions
  const missingFieldPatterns = [
    /for missing (?:field|column) ["']?([^"',]+)["']?,? use ["']([^"']+)["']/gi,
    /set default for ["']?([^"',]+)["']? to ["']([^"']+)["']/gi,
    /default value for ["']?([^"',]+)["']? should be ["']([^"']+)["']/gi,
    /missing ["']?([^"',]+)["']? can be set to ["']([^"']+)["']/gi,
    /use ["']([^"']+)["'] as the default for ["']?([^"',]+)["']?/gi,
  ];

  // Create a map to track rows that have been fixed
  const fixedRows = new Map<number, Set<string>>();
  const fixedMissingFields = new Map<number, Set<string>>();

  // Try to extract fix suggestions from AI response
  for (const pattern of fixPatterns) {
    const matches = Array.from(aiResponse.matchAll(pattern));

    for (const match of matches) {
      if (match.length >= 3) {
        // For the first pattern which includes row numbers
        if (match.length === 4) {
          const rowNum = parseInt(match[1]);
          const oldValue = match[2];
          const newValue = match[3];

          if (!isNaN(rowNum) && rowNum > 0 && rowNum <= result.totalRows) {
            applyFix(result, rowNum - 1, oldValue, newValue);

            // Track that we fixed this field in this row
            if (!fixedRows.has(rowNum)) {
              fixedRows.set(rowNum, new Set<string>());
            }

            // We don't know the exact field name but we track that a fix was applied
            fixedRows.get(rowNum)?.add('value');
          }
        }
        // For patterns that don't include row numbers, try to match to errors
        else {
          const oldValue = match[1];
          const newValue = match[2];

          // Try to find errors with this value and fix them
          result.errors.forEach((error: unknown) => {
            if (error.value === oldValue) {
              applyFix(result, error.row - 1, oldValue, newValue);

              // Track that we fixed this field in this row
              if (!fixedRows.has(error.row)) {
                fixedRows.set(error.row, new Set<string>());
              }
              fixedRows.get(error.row)?.add(error.field);
            }
          });
        }
      }
    }
  }

  // Process missing field suggestions
  for (const pattern of missingFieldPatterns) {
    const matches = Array.from(aiResponse.matchAll(pattern));

    for (const match of matches) {
      if (match.length >= 3) {
        let fieldName, defaultValue;

        // Check if the pattern is reversed (some patterns capture field first, others value first)
        if (pattern.toString().includes('as the default for')) {
          defaultValue = match[1];
          fieldName = match[2];
        } else {
          fieldName = match[1];
          defaultValue = match[2];
        }

        // Apply default value to missing fields
        const missingFields = result.missingFields.filter(
          (field: unknown) => field.field === fieldName
        );

        missingFields.forEach((missingField: unknown) => {
          const rowIndex = missingField.row - 1;
          if (result.mappedData[rowIndex]) {
            result.mappedData[rowIndex][fieldName] = defaultValue;
            console.log(
              `Applied default value for missing field: row ${missingField.row}, field ${fieldName} = "${defaultValue}"`
            );

            // Track that we fixed this missing field
            if (!fixedMissingFields.has(missingField.row)) {
              fixedMissingFields.set(missingField.row, new Set<string>());
            }
            fixedMissingFields.get(missingField.row)?.add(fieldName);
          }
        });
      }
    }
  }

  // Handle specific default values based on data type
  const dataTypeDefaults = getDefaultValuesForDataType(dataType);

  // Apply data type specific defaults to remaining missing fields
  result.missingFields.forEach((missingField: unknown) => {
    const rowIndex = missingField.row - 1;
    const fieldName = missingField.field;

    // Skip if we already fixed this field
    if (
      fixedMissingFields.has(missingField.row) &&
      fixedMissingFields.get(missingField.row)?.has(fieldName)
    ) {
      return;
    }

    // Try to apply a default value if available
    if (dataTypeDefaults[fieldName] && result.mappedData[rowIndex]) {
      result.mappedData[rowIndex][fieldName] = dataTypeDefaults[fieldName];
      console.log(
        `Applied predefined default value: row ${missingField.row}, field ${fieldName} = "${dataTypeDefaults[fieldName]}"`
      );

      // Track that we fixed this missing field
      if (!fixedMissingFields.has(missingField.row)) {
        fixedMissingFields.set(missingField.row, new Set<string>());
      }
      fixedMissingFields.get(missingField.row)?.add(fieldName);
    }
  });

  // Remove fixed errors from the error list
  result.errors = result.errors.filter(
    (error: unknown) => !fixedRows.has(error.row) || !fixedRows.get(error.row)?.has(error.field)
  );

  // Remove fixed missing fields
  result.missingFields = result.missingFields.filter(
    (field: unknown) =>
      !fixedMissingFields.has(field.row) || !fixedMissingFields.get(field.row)?.has(field.field)
  );

  // Update success and importedRows based on remaining errors
  if (result.errors.length === 0 && result.missingFields.length === 0) {
    result.success = true;
    result.importedRows = result.totalRows;
  } else {
    result.success = result.errors.length === 0;
    result.importedRows =
      result.totalRows -
      new Set(result.errors.map((e: unknown) => e.row)).size -
      new Set(result.missingFields.map((m: unknown) => m.row)).size;
  }
}

// Get default values for different data types
function getDefaultValuesForDataType(dataType: 'loyalty' | 'inventory'): Record<string, any> {
  if (dataType === 'inventory') {
    return {
      quantity: 0,
      isPerishable: false,
      cost: 0,
      price: 0,
      reorderLevel: 5,
      reorderQuantity: 10,
    };
  } else if (dataType === 'loyalty') {
    return {
      points: 0,
      tier: 'Bronze',
      status: 'active',
      enrollmentDate: new Date().toISOString().split('T')[0],
    };
  }

  return {};
}

// Apply a specific fix to a row in the data
function applyFix(
  result: ImportResult,
  rowIndex: number,
  oldValue: string,
  newValue: string
): void {
  // Apply the fix to the mapped data
  if (result.mappedData[rowIndex]) {
    // First, try to find the field by matching error messages
    const relatedError = result.errors.find(
      err => err.row - 1 === rowIndex && err.value === oldValue
    );

    if (relatedError) {
      // If we found an error with this value, update the specific field
      result.mappedData[rowIndex][relatedError.field] = newValue;
      console.log(
        `Applied fix for row ${rowIndex + 1}, field ${relatedError.field}: "${oldValue}" -> "${newValue}"`
      );
      return;
    }

    // If no specific error found, check all fields
    let fixApplied = false;
    for (const field in result.mappedData[rowIndex]) {
      if (result.mappedData[rowIndex][field] === oldValue) {
        result.mappedData[rowIndex][field] = newValue;
        console.log(
          `Applied fix for row ${rowIndex + 1}, field ${field}: "${oldValue}" -> "${newValue}"`
        );
        fixApplied = true;
      }
    }

    // Special handling for boolean conversions like "Yes" to true
    if (!fixApplied && ['true', 'false', 'yes', 'no', '1', '0'].includes(newValue.toLowerCase())) {
      // Check for fields that might be boolean
      const booleanFields = ['isPerishable', 'active', 'enabled', 'available'];
      for (const field of booleanFields) {
        if (field in result.mappedData[rowIndex]) {
          const currentValue = String(result.mappedData[rowIndex][field]).toLowerCase();
          // If the current value looks like what we're trying to replace
          if (
            currentValue === oldValue.toLowerCase() ||
            (oldValue.toLowerCase() === 'yes' && currentValue === 'true') ||
            (oldValue.toLowerCase() === 'no' && currentValue === 'false')
          ) {
            // Convert newValue to proper boolean
            const boolValue = ['true', 'yes', '1'].includes(newValue.toLowerCase());
            result.mappedData[rowIndex][field] = boolValue;
            console.log(
              `Applied boolean fix for row ${rowIndex + 1}, field ${field}: "${oldValue}" -> ${boolValue}`
            );
          }
        }
      }
    }
  }
}
