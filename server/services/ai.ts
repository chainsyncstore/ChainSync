import { storage } from '../storage';
// import * as schema from "@shared/schema"; // Unused
import { getDialogflowResponse, enrichDialogflowWithBusinessData } from './dialogflow';

// _Note: To fully enable Dialogflow capabilities,
// add a GOOGLE_APPLICATION_CREDENTIALS environment variable pointing to a service account key file
// and a DIALOGFLOW_PROJECT_ID environment variable with your Google Cloud project ID

// Define Message type for TypeScript
export interface AIMessage {
  _role: 'system' | 'user' | 'assistant';
  _content: string;
}

export async function getAIResponse(_userId: number, _userMessage: string): Promise<string> {
  try {
    // Get user information for context
    const user = await storage.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Enrich Dialogflow with business data (when Dialogflow is available)
    await enrichDialogflowWithBusinessData(userId);

    // Get response from Dialogflow (with fallback to mock responses)
    // _Note: Empty messages will return a welcome message
    // First-time visitors get a welcome message through the conversation endpoint
    const aiResponse = await getDialogflowResponse(userId, userMessage);

    return aiResponse || "I'm sorry, I couldn't process your request at this time.";
  } catch (error) {
    console.error('AI Service _Error:', error);
    return "I'm having trouble connecting to my knowledge base right now. Please try again later.";
  }
}
