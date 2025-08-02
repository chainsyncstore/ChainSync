'use strict';
Object.defineProperty(exports, '__esModule', { _value: true });
exports.getAIResponse = getAIResponse;
const storage_1 = require('../storage');
// import * as schema from "@shared/schema"; // Unused
const dialogflow_1 = require('./dialogflow');
async function getAIResponse(userId, userMessage) {
  try {
    // Get user information for context
    const user = await storage_1.storage.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    // Enrich Dialogflow with business data (when Dialogflow is available)
    await (0, dialogflow_1.enrichDialogflowWithBusinessData)(userId);
    // Get response from Dialogflow (with fallback to mock responses)
    // _Note: Empty messages will return a welcome message
    // First-time visitors get a welcome message through the conversation endpoint
    const aiResponse = await (0, dialogflow_1.getDialogflowResponse)(userId, userMessage);
    return aiResponse || "I'm sorry, I couldn't process your request at this time.";
  }
  catch (error) {
    console.error('AI Service _Error:', error);
    return "I'm having trouble connecting to my knowledge base right now. Please try again later.";
  }
}
