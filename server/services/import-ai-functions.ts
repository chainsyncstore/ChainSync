import { SessionsClient } from '@google-cloud/dialogflow';
import { applyAISuggestedFixes } from './import-ai-utils';

// Use Dialogflow to enhance data validation with AI insights
export async function enhanceDataValidationWithAI(
  result: any,
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
    const errorSample = result.errors.slice(0, 5).map((err: any) => 
      `Row ${err.row}: ${err.field} = "${err.value}" (${err.reason})`
    ).join("\n");
    
    const missingSample = result.missingFields.slice(0, 5).map((field: any) => 
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
  } catch (error: any) {
    console.error("Error using Dialogflow for validation enhancement:", error);
    // Just log the error and continue with basic validation
  }
}