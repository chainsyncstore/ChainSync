import express from 'express';
import crypto from 'crypto';
import { storage } from '../storage.js';
import { log } from '../vite.js';

const router = express.Router();

/**
 * Secure Dialogflow webhook endpoint
 * This endpoint receives and processes requests from Dialogflow
 */
router.post('/dialogflow', async(req, res): Promise<void> => {
  try {
    const signature = req.headers['x-dialogflow-signature'] as string;
    const dialogflowWebhookSecret = process.env.DIALOGFLOW_WEBHOOK_SECRET;

    // In production, verify signature
    if (process.env.NODE_ENV === 'production') {
      if (!signature) {
        log('Missing Dialogflow webhook signature');
        res.status(401).json({ success: false, message: 'Unauthorized: Missing signature' });
        return;
      }

      if (!dialogflowWebhookSecret) {
        log('Missing DIALOGFLOW_WEBHOOK_SECRET environment variable');
        res.status(500).json({ success: false, message: 'Server misconfiguration: webhook secret not set' });
        return;
      }

      // Verify signature using the webhook secret
      const payload = JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', dialogflowWebhookSecret)
        .update(payload)
        .digest('hex');

      if (signature !== expectedSignature) {
        log('Invalid Dialogflow webhook signature');
        res.status(401).json({ success: false, message: 'Unauthorized: Invalid signature' });
        return;
      }
    }

    // Extract the fulfillment information from the webhook request
    const { queryResult, session } = req.body;
    if (!queryResult || !session) {
      res.status(400).json({ success: false, message: 'Invalid webhook request format' });
      return;
    }

    // Extract session ID to identify the user
    const sessionPath = session as string;
    const sessionIdMatch = sessionPath.match(/sessions\/([^/]+)$/);

    if (!sessionIdMatch) {
      res.status(400).json({ success: false, message: 'Invalid session format' });
      return;
    }

    const sessionId = sessionIdMatch[1];
    if (!sessionId) {
      res.status(400).json({ success: false, message: 'Invalid session format' });
      return;
    }
    const userId = parseInt(sessionId.replace('chainsync-user-', ''), 10);

    if (isNaN(userId)) {
      res.status(400).json({ success: false, message: 'Invalid user ID in session' });
      return;
    }

    // Process the webhook request
    // This is where you would implement business logic based on the Dialogflow request
    // For example, retrieve or update data based on the detected intent

    // Get the detected intent and parameters
    const intent = queryResult.intent?.displayName;
    const parameters = queryResult.parameters;

    // Log the incoming webhook request
    log(`Dialogflow webhook request: Intent=${intent}, UserId=${userId}`);

    // Example response based on detected intent
    let fulfillmentText = queryResult.fulfillmentText;

    // Additional business logic based on intent
    switch (intent) {
      case 'get_inventory_status':
        // Example: Get inventory status
        try {
          const storeId = parameters.storeId || null;
          const lowStockItems = await storage.getLowStockItems(storeId);

          if (lowStockItems.length > 0) {
            const products = await Promise.all(
              lowStockItems.map(item => storage.getProductById(item.productId))
            );
            const productMap = new Map(products.filter(p => p).map((p: any) => [p.id, p.name]));

            const itemsText = lowStockItems
              .slice(0, 5)
              .map(item => `${productMap.get(item.productId) || 'Unknown Product'} (${item.quantity} units)`)
              .join(', ');

            fulfillmentText = `You have ${lowStockItems.length} items with low stock. Top items: ${itemsText}`;
          } else {
            fulfillmentText = 'All inventory items are at healthy stock levels.';
          }
        } catch (error) {
          console.error('Error fetching inventory data:', error);
          fulfillmentText = 'I encountered an error while retrieving inventory information.';
        }
        break;

      // Add more intent handlers here

      default:
        // Use the default fulfillment text from Dialogflow
        break;
    }

    // Send the response back to Dialogflow
    res.json({
      fulfillmentText
    });

  } catch (error) {
    console.error('Error processing Dialogflow webhook:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing webhook request'
    });
  }
});

export default router;
