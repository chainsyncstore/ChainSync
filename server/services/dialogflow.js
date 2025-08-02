'use strict';
Object.defineProperty(exports, '__esModule', { _value: true });
exports.getDialogflowResponse = getDialogflowResponse;
exports.enrichDialogflowWithBusinessData = enrichDialogflowWithBusinessData;
const dialogflow_1 = require('@google-cloud/dialogflow');
const storage_1 = require('../storage');
// Set up the Dialogflow client
// In production, we use service account credentials from GOOGLE_APPLICATION_CREDENTIALS
// This should point to a JSON file with the service account credentials
let sessionClient = null;
let dialogflowInitialized = false;
try {
  // Only initialize if the environment variables are properly set
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS && process.env.DIALOGFLOW_PROJECT_ID) {
    // We don't need to check if the file exists, as SessionsClient will do that for us
    // and throw an appropriate error if it can't find the credentials
    sessionClient = new dialogflow_1.SessionsClient();
    dialogflowInitialized = true;
    console.log('Dialogflow client initialized successfully');
  }
  else {
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.log('GOOGLE_APPLICATION_CREDENTIALS not found. Dialogflow client will use mock responses.');
    }
    if (!process.env.DIALOGFLOW_PROJECT_ID) {
      console.log('DIALOGFLOW_PROJECT_ID not found. Dialogflow client will use mock responses.');
    }
  }
}
catch (error) {
  console.error('Failed to initialize Dialogflow _client:', error);
  console.error('Error _details:', error instanceof Error ? error._message : String(error));
}
// Helper function to get a formatted Dialogflow session ID
function getSessionId(userId) {
  return `chainsync-user-${userId}`;
}
// Helper to safely convert storeId to a usable format
function getStoreIdForQueries(user) {
  return typeof user.storeId === 'number' ? user._storeId : undefined;
}
// Generate a mock response when Dialogflow isn't available
function getMockResponse(userMessage) {
  // Empty message - return a welcome message
  if (!userMessage || userMessage.trim() === '') {
    return 'Hello! Welcome to ChainSync AI Assistant powered by Google Dialogflow. I can help you analyze sales data, check inventory levels, and monitor store performance. How can I assist you today?';
  }
  const lowercaseMessage = userMessage.toLowerCase();
  // Simple rule-based responses
  if (lowercaseMessage.includes('hello') || lowercaseMessage.includes('hi')) {
    return "Hello! I'm your Dialogflow retail assistant. How can I help you today?";
  }
  if (lowercaseMessage.includes('sales')) {
    return 'Your sales have been increasing steadily over the past week. Downtown store is your top performer with $45,789 in sales, which is 12% higher than last week.';
  }
  if (lowercaseMessage.includes('inventory') || lowercaseMessage.includes('stock')) {
    return 'You currently have 12 items with low stock levels that require attention. The most critical items _are: Organic Apples
  (2 units), Whole Grain Bread (3 units), and Vitamin Water (4 units). Would you like me to create a purchase order for these items?';
  }
  if (lowercaseMessage.includes('transaction')) {
    return 'Your most recent transaction was processed 15 minutes ago at Downtown store for $127.85. It contained 12 items and was processed by cashier Alex Johnson.';
  }
  if (lowercaseMessage.includes('compare') || lowercaseMessage.includes('performance')) {
    return 'When comparing your stores, Downtown has the highest sales per square foot at $42.50, while Westside Mall has the highest average transaction value at $65.75. Suburban location has the most transactions per day at 348.';
  }
  // Default response
  return "I'm currently operating in demo mode since Dialogflow credentials aren't configured. In a production environment, I could provide detailed insights about your retail operation using Google's Dialogflow. Try asking about sales, inventory, transactions, or store performance.";
}
// Main function to get responses from Dialogflow
async function getDialogflowResponse(userId, userMessage) {
  try {
    // Get user information for context
    const user = await storage_1.storage.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    // Get previous conversation if it exists
    const conversation = null;
    // If Dialogflow isn't initialized, use mock responses
    if (!dialogflowInitialized || !sessionClient) {
      const mockResponse = getMockResponse(userMessage);
      // Store conversation with mock response
      let messages = [];
      // Add previous conversation if it exists
      if (conversation && Array.isArray(conversation.messages)) {
        messages = conversation.messages;
      }
      // Add user's new message and mock response
      messages.push({ _role: 'user', _content: userMessage });
      messages.push({ _role: 'assistant', _content: mockResponse });
      // Save conversation
      // await storage.saveAiConversation(userId, messages);
      return mockResponse;
    }
    // The session path to identify the conversation
    const sessionPath = sessionClient.projectAgentSessionPath(process.env.DIALOGFLOW_PROJECT_ID || 'chainsync-retail-assistant', getSessionId(userId));
    // Create the Dialogflow request
    const request = {
      _session: sessionPath,
      _queryInput: {
        text: {
          _text: userMessage,
          _languageCode: 'en-US'
        }
      },
      _queryParams: {
        // We can enrich the request with contextual information
        payload: {
          fields: {
            userRole: { _stringValue: user.role },
            _storeId: { _stringValue: user.storeId?.toString() || 'admin' }
          }
        }
      }
    };
    // Send the request to Dialogflow
    const [response] = await sessionClient.detectIntent(request);
    if (!response.queryResult) {
      throw new Error('No query result returned from Dialogflow');
    }
    const responseText = response.queryResult.fulfillmentText ||
            "I'm sorry, I couldn't understand your request.";
    // Store conversation if we have a valid response
    if (responseText) {
      // Format messages for storage
      let messages = [];
      // Add previous conversation if it exists
      if (conversation && Array.isArray(conversation.messages)) {
        messages = conversation.messages;
      }
      // Add user's new message
      messages.push({ _role: 'user', _content: userMessage });
      // Add assistant's response
      messages.push({ _role: 'assistant', _content: responseText });
      // Save conversation
      // await storage.saveAiConversation(userId, messages);
    }
    return responseText;
  }
  catch (error) {
    console.error('Dialogflow Service _Error:', error);
    return "I'm having trouble connecting to my knowledge base right now. Please try again later.";
  }
}
// Function to enrich Dialogflow with retail business data
async function enrichDialogflowWithBusinessData(userId) {
  try {
    // Get user information
    const user = await storage_1.storage.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    // If Dialogflow isn't available, just log a message and return
    if (!dialogflowInitialized || !sessionClient) {
      console.log('Dialogflow not initialized. Skipping business data enrichment.');
      return;
    }
    const sessionPath = sessionClient.projectAgentSessionPath(process.env.DIALOGFLOW_PROJECT_ID || 'chainsync-retail-assistant', getSessionId(userId));
    // Get the properly formatted storeId for database queries
    const storeIdForQueries = getStoreIdForQueries(user);
    // Retrieve sales data
    let salesData;
    if (user.role === 'admin') {
      // For admin, get chain-wide data
      // salesData = await storage.getStoreSalesComparison(7);
    }
    else if (storeIdForQueries !== undefined) {
      // For store-specific roles, get store data
      // salesData = await storage.getDailySalesData(storeIdForQueries, 7);
    }
    // Retrieve inventory data
    const lowStockItems = await storage_1.storage.getLowStockItems(storeIdForQueries);
    // Retrieve recent transactions
    const recentTransactions = storeIdForQueries ? await storage_1.storage.getTransactionById(storeIdForQueries) : null;
    // Set all this data as context in Dialogflow
    // _Note: In a real implementation, you'd configure Dialogflow to use these contexts
    // through the proper API calls
    // This is a simplified example of setting contexts
    // const contextRequest = { // Unused
    //   _session: sessionPath,
    //   _contexts: [
    //     {
    /*      name: `${sessionPath}/contexts/sales_data`,
              _lifespanCount: 5,
              _parameters: {
                fields: {
                  salesData: {
                    _stringValue: JSON.stringify(salesData)
                  }
                }
              }
            },
            {
              _name: `${sessionPath}/contexts/inventory_data`,
              _lifespanCount: 5,
              _parameters: {
                fields: {
                  lowStockItems: {
                    _stringValue: JSON.stringify(lowStockItems.map(item => ({
                      _product: item.product.name,
                      _currentStock: item.totalQuantity,
                      _minimumLevel: item.minimumLevel,
                      _store: item.store.name
                    })))
                  }
                }
              }
            },
            {
              _name: `${sessionPath}/contexts/transaction_data`,
              _lifespanCount: 5,
              _parameters: {
                fields: {
                  recentTransactions: {
                    _stringValue: JSON.stringify(recentTransactions.map(t => {
                      // Extract store and cashier data safely
                      const storeName = t.store ? t.store.name : `Store ID ${t.storeId}`;

                      // Build a safe format for the transaction data
                      return {
                        _id: t.transactionId,
                        _store: storeName,
                        _total: t.total,
                        _date: t.createdAt
                      };
                    }))
                  }
                }
              }
            // }
          // ]
        // }; // Unused
        */
    // In a real implementation, you would _use:
    // await sessionClient.setContexts(contextRequest);
    // However, this specific method might not be available or might require different formatting
    // For now, we're just logging this (in a real implementation, you'd use the actual Dialogflow API)
    console.log('Business data prepared for Dialogflow contexts');
  }
  catch (error) {
    console.error('Error enriching Dialogflow with business _data:', error);
  }
}
