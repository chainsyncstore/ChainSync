// Parse and apply AI-suggested fixes to validation results
export function applyAISuggestedFixes(
  result: any,
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
          result.errors.forEach((error: any) => {
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
  result.errors = result.errors.filter((error: any) => 
    !fixedRows.has(error.row) || !fixedRows.get(error.row)?.has(error.field)
  );
  
  // Update success and importedRows based on remaining errors
  if (result.errors.length === 0 && result.missingFields.length === 0) {
    result.success = true;
    result.importedRows = result.totalRows;
  } else {
    result.success = result.errors.length === 0;
    result.importedRows = result.totalRows - 
      new Set(result.errors.map((e: any) => e.row)).size - 
      new Set(result.missingFields.map((m: any) => m.row)).size;
  }
}

// Apply a specific fix to a row in the data
export function applyFix(
  result: any,
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