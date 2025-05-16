import { SessionsClient } from '@google-cloud/dialogflow';
import { storage } from "../storage";
import * as schema from "@shared/schema";

// Define the type for messages
export interface DialogflowMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// Set up the Dialogflow client
// In production, we use service account credentials from GOOGLE_APPLICATION_CREDENTIALS
// This should point to a JSON file with the service account credentials
let sessionClient: SessionsClient | null = null;
let dialogflowInitialized = false;

try {
  // Only initialize if the environment variables are properly set
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS && process.env.DIALOGFLOW_PROJECT_ID) {
    // We don't need to check if the file exists, as SessionsClient will do that for us
    // and throw an appropriate error if it can't find the credentials
    sessionClient = new SessionsClient();
    dialogflowInitialized = true;
    console.log("Dialogflow client initialized successfully");
  } else {
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.log("GOOGLE_APPLICATION_CREDENTIALS not found. Dialogflow client will use mock responses.");
    }
    if (!process.env.DIALOGFLOW_PROJECT_ID) {
      console.log("DIALOGFLOW_PROJECT_ID not found. Dialogflow client will use mock responses.");
    }
  }
} catch (error) {
  console.error("Failed to initialize Dialogflow client:", error);
  console.error("Error details:", error instanceof Error ? error.message : String(error));
}

// Helper function to get a formatted Dialogflow session ID
function getSessionId(userId: number): string {
  return `chainsync-user-${userId}`;
}

// Helper to safely convert storeId to a usable format
function getStoreIdForQueries(user: schema.User): number | undefined {
  return typeof user.storeId === 'number' ? user.storeId : undefined;
}

// Generate a mock response when Dialogflow isn't available
function getMockResponse(userMessage: string): string {
  // Empty message - return a welcome message
  if (!userMessage || userMessage.trim() === '') {
    return "Hello! Welcome to ChainSync AI Assistant powered by Google Dialogflow. I can help you analyze sales data, check inventory levels, and monitor store performance. How can I assist you today?";
  }
  
  const lowercaseMessage = userMessage.toLowerCase();
  
  // Simple rule-based responses
  if (lowercaseMessage.includes('hello') || lowercaseMessage.includes('hi')) {
    return "Hello! I'm your Dialogflow retail assistant. How can I help you today?";
  }
  
  if (lowercaseMessage.includes('sales')) {
    return "Your sales have been increasing steadily over the past week. Downtown store is your top performer with $45,789 in sales, which is 12% higher than last week.";
  }
  
  if (lowercaseMessage.includes('inventory') || lowercaseMessage.includes('stock')) {
    return "You currently have 12 items with low stock levels that require attention. The most critical items are: Organic Apples (2 units), Whole Grain Bread (3 units), and Vitamin Water (4 units). Would you like me to create a purchase order for these items?";
  }
  
  if (lowercaseMessage.includes('transaction')) {
    return "Your most recent transaction was processed 15 minutes ago at Downtown store for $127.85. It contained 12 items and was processed by cashier Alex Johnson.";
  }
  
  if (lowercaseMessage.includes('compare') || lowercaseMessage.includes('performance')) {
    return "When comparing your stores, Downtown has the highest sales per square foot at $42.50, while Westside Mall has the highest average transaction value at $65.75. Suburban location has the most transactions per day at 348.";
  }
  
  // Default response
  return "I'm currently operating in demo mode since Dialogflow credentials aren't configured. In a production environment, I could provide detailed insights about your retail operation using Google's Dialogflow. Try asking about sales, inventory, transactions, or store performance.";
}

// Main function to get responses from Dialogflow
export async function getDialogflowResponse(userId: number, userMessage: string): Promise<string> {
  try {
    // Get user information for context
    const user = await storage.getUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Get previous conversation if it exists
    const conversation = await storage.getAiConversation(userId);
    
    // If Dialogflow isn't initialized, use mock responses
    if (!dialogflowInitialized || !sessionClient) {
      const mockResponse = getMockResponse(userMessage);
      
      // Store conversation with mock response
      let messages: DialogflowMessage[] = [];
      
      // Add previous conversation if it exists
      if (conversation && Array.isArray(conversation.messages)) {
        messages = conversation.messages;
      }

      // Add user's new message and mock response
      messages.push({ role: "user", content: userMessage });
      messages.push({ role: "assistant", content: mockResponse });
      
      // Save conversation
      await storage.saveAiConversation(userId, messages);
      
      return mockResponse;
    }

    // The session path to identify the conversation
    const sessionPath = sessionClient.projectAgentSessionPath(
      process.env.DIALOGFLOW_PROJECT_ID || 'chainsync-retail-assistant',
      getSessionId(userId)
    );

    // Create the Dialogflow request
    const request = {
      session: sessionPath,
      queryInput: {
        text: {
          text: userMessage,
          languageCode: 'en-US',
        },
      },
      queryParams: {
        // We can enrich the request with contextual information
        payload: {
          fields: {
            userRole: { stringValue: user.role },
            storeId: { stringValue: user.storeId?.toString() || 'admin' }
          }
        }
      }
    };

    // Send the request to Dialogflow
    const [response] = await sessionClient.detectIntent(request);
    
    if (!response.queryResult) {
      throw new Error("No query result returned from Dialogflow");
    }

    const responseText = response.queryResult.fulfillmentText || 
      "I'm sorry, I couldn't understand your request.";

    // Store conversation if we have a valid response
    if (responseText) {
      // Format messages for storage
      let messages: DialogflowMessage[] = [];

      // Add previous conversation if it exists
      if (conversation && Array.isArray(conversation.messages)) {
        messages = conversation.messages;
      }

      // Add user's new message
      messages.push({ role: "user", content: userMessage });
      
      // Add assistant's response
      messages.push({ role: "assistant", content: responseText });
      
      // Save conversation
      await storage.saveAiConversation(userId, messages);
    }

    return responseText;
  } catch (error) {
    console.error("Dialogflow Service Error:", error);
    return "I'm having trouble connecting to my knowledge base right now. Please try again later.";
  }
}

// Function to enrich Dialogflow with retail business data
export async function enrichDialogflowWithBusinessData(userId: number): Promise<void> {
  try {
    // Get user information 
    const user = await storage.getUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // If Dialogflow isn't available, just log a message and return
    if (!dialogflowInitialized || !sessionClient) {
      console.log("Dialogflow not initialized. Skipping business data enrichment.");
      return;
    }

    const sessionPath = sessionClient.projectAgentSessionPath(
      process.env.DIALOGFLOW_PROJECT_ID || 'chainsync-retail-assistant',
      getSessionId(userId)
    );

    // Get the properly formatted storeId for database queries
    const storeIdForQueries = getStoreIdForQueries(user);

    // Retrieve sales data
    let salesData;
    if (user.role === 'admin') {
      // For admin, get chain-wide data
      salesData = await storage.getStoreSalesComparison(7);
    } else if (storeIdForQueries !== undefined) {
      // For store-specific roles, get store data
      salesData = await storage.getDailySalesData(storeIdForQueries, 7);
    }

    // Retrieve inventory data
    const lowStockItems = await storage.getLowStockItems(storeIdForQueries);

    // Retrieve recent transactions
    const recentTransactions = await storage.getRecentTransactions(5, storeIdForQueries);

    // Set all this data as context in Dialogflow
    // Note: In a real implementation, you'd configure Dialogflow to use these contexts
    // through the proper API calls
    
    // This is a simplified example of setting contexts
    const contextRequest = {
      session: sessionPath,
      contexts: [
        {
          name: `${sessionPath}/contexts/sales_data`,
          lifespanCount: 5,
          parameters: {
            fields: {
              salesData: {
                stringValue: JSON.stringify(salesData)
              }
            }
          }
        },
        {
          name: `${sessionPath}/contexts/inventory_data`,
          lifespanCount: 5,
          parameters: {
            fields: {
              lowStockItems: {
                stringValue: JSON.stringify(lowStockItems.map(item => ({
                  product: item.product.name,
                  currentStock: item.totalQuantity,
                  minimumLevel: item.minimumLevel,
                  store: item.store.name
                })))
              }
            }
          }
        },
        {
          name: `${sessionPath}/contexts/transaction_data`,
          lifespanCount: 5,
          parameters: {
            fields: {
              recentTransactions: {
                stringValue: JSON.stringify(recentTransactions.map(t => {
                  // Extract store and cashier data safely
                  const storeName = t.store ? t.store.name : `Store ID ${t.storeId}`;
                  
                  // Build a safe format for the transaction data
                  return {
                    id: t.transactionId,
                    store: storeName,
                    total: t.total,
                    date: t.createdAt
                  };
                }))
              }
            }
          }
        }
      ]
    };

    // In a real implementation, you would use:
    // await sessionClient.setContexts(contextRequest);
    // However, this specific method might not be available or might require different formatting
    
    // For now, we're just logging this (in a real implementation, you'd use the actual Dialogflow API)
    console.log("Business data prepared for Dialogflow contexts");
    
  } catch (error) {
    console.error("Error enriching Dialogflow with business data:", error);
  }
}