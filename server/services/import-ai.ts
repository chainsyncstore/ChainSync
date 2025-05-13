import { SessionsClient } from '@google-cloud/dialogflow';
import { ImportResult, ImportError, MissingField } from './import';

// Use Dialogflow to enhance data validation with AI insights
export async function enhanceValidationWithAI(
  result: ImportResult,
  dataType: 'loyalty' | 'inventory'
): Promise<void> {
  // Skip if there are no errors or if all rows are already valid
  if (result.errors.length === 0 && result.missingFields.length === 0) {
    return;
  }
  
  // Check if Dialogflow credentials are available
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS || !process.env.DIALOGFLOW_PROJECT_ID) {
    console.log("Dialogflow credentials not found. Using basic validation only.");
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
    
    // Prepare a sample of validation issues for Dialogflow to analyze
    const errorSample = result.errors.slice(0, 5).map(err => 
      `Row ${err.row}: ${err.field} = "${err.value}" (${err.reason})`
    ).join("\n");
    
    const missingSample = result.missingFields.slice(0, 5).map(field => 
      `Row ${field.row}: ${field.field} is missing ${field.isRequired ? '(required)' : '(optional)'}`
    ).join("\n");
    
    // Prepare the prompt for Dialogflow
    let prompt = `I'm trying to validate imported ${dataType} data and have encountered validation issues.
    
    Here are some examples of the errors:
    ${errorSample}
    
    And missing fields:
    ${missingSample}
    
    Based on your understanding of ${dataType} data, can you suggest:
    1. Potential corrections for these values
    2. Alternative valid formats
    3. Common misunderstandings users might have when importing this data
    
    Please format your response as actionable suggestions that could be applied to the data.`;
    
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
    
    // Analyze the response to find potential fixes
    applyAISuggestedFixes(result, responseText, dataType);
  } catch (error) {
    console.error("Error using Dialogflow for validation enhancement:", error);
    // Just log the error and continue with basic validation
  }
}

// Parse and apply AI-suggested fixes to validation results
function applyAISuggestedFixes(
  result: ImportResult,
  aiResponse: string,
  dataType: 'loyalty' | 'inventory'
): void {
  // Extract key phrases that might indicate fixes
  const fixPatterns = [
    /Row\s+(\d+).*?["']([^"']+)["'].*?change to.*?["']([^"']+)["']/gi,
    /suggest changing\s+["']([^"']+)["']\s+to\s+["']([^"']+)["']/gi,
    /replace\s+["']([^"']+)["']\s+with\s+["']([^"']+)["']/gi
  ];
  
  // Create a map to track rows that have been fixed
  const fixedRows = new Map<number, Set<string>>();
  
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
          result.errors.forEach((error) => {
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
  
  // Remove fixed errors from the error list
  result.errors = result.errors.filter(error => 
    !fixedRows.has(error.row) || !fixedRows.get(error.row)?.has(error.field)
  );
  
  // Update success and importedRows based on remaining errors
  if (result.errors.length === 0 && result.missingFields.length === 0) {
    result.success = true;
    result.importedRows = result.totalRows;
  } else {
    result.success = result.errors.length === 0;
    result.importedRows = result.totalRows - 
      new Set(result.errors.map(e => e.row)).size - 
      new Set(result.missingFields.map(m => m.row)).size;
  }
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
    // We don't know which field contains this value, so we check all of them
    for (const field in result.mappedData[rowIndex]) {
      if (result.mappedData[rowIndex][field] === oldValue) {
        result.mappedData[rowIndex][field] = newValue;
      }
    }
  }
}