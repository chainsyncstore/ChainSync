'use strict';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import * as schema from '../../../shared/schema.js';
import { BaseService } from '../base/service.js';
import { webhookValidation, SchemaValidationError } from '../../../shared/schema-validation.js';
import { AppError, ErrorCode, ErrorCategory } from '../../../shared/types/errors.js';
import crypto from 'crypto';
import axios from 'axios';
import { logger } from '../../../utils/logger.js';

class WebhookService extends BaseService {
  async handlePaystackWebhook(signature, payload) {
    // For now, basic stub implementation
    return { success: true, message: 'Handled Paystack webhook' };
  }

  async handleFlutterwaveWebhook(signature, payload) {
    return { success: true, message: 'Handled Flutterwave webhook' };
  }

  async createWebhook(params) {
    try {
      const validatedData = webhookValidation.create(params);
      const existingWebhook = await db.query.webhooks.findFirst({
        where: and(
          eq(schema.webhooks.url, validatedData.url),
          eq(schema.webhooks.storeId, validatedData.storeId),
          eq(schema.webhooks.isActive, true)
        )
      });
      
      if (existingWebhook) {
        throw new AppError(
          'Webhook with this URL already exists for this store',
          ErrorCode.DUPLICATE_ENTRY,
          ErrorCategory.VALIDATION
        );
      }
      
      const secret = crypto.randomBytes(32).toString('hex');
      const [webhook] = await db
        .insert(schema.webhooks)
        .values({
          ...validatedData,
          secret,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      
      return webhook;
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        logger.error(`Validation error: ${error.message}`, { 
          error: error.toJSON(),
          context: 'createWebhook'
        });
      }
      throw this.handleError(error, 'Creating webhook');
    }
  }

  async updateWebhook(id, params) {
    try {
      const validatedData = webhookValidation.update(params);
      const existingWebhook = await db.query.webhooks.findFirst({
        where: eq(schema.webhooks.id, id)
      });
      
      if (!existingWebhook) {
        throw new AppError(
          'Webhook not found',
          ErrorCode.NOT_FOUND,
          ErrorCategory.VALIDATION
        );
      }
      
      const [updatedWebhook] = await db
        .update(schema.webhooks)
        .set({
          ...validatedData,
          updatedAt: new Date()
        })
        .where(eq(schema.webhooks.id, id))
        .returning();
      
      return updatedWebhook;
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        logger.error(`Validation error: ${error.message}`, { 
          error: error.toJSON(),
          context: 'updateWebhook'
        });
      }
      throw this.handleError(error, 'Updating webhook');
    }
  }

  async deleteWebhook(id) {
    try {
      const existingWebhook = await db.query.webhooks.findFirst({
        where: eq(schema.webhooks.id, id)
      });
      
      if (!existingWebhook) {
        throw new AppError(
          'Webhook not found',
          ErrorCode.NOT_FOUND,
          ErrorCategory.VALIDATION
        );
      }
      
      await db
        .update(schema.webhooks)
        .set({
          isActive: false,
          updatedAt: new Date()
        })
        .where(eq(schema.webhooks.id, id));
      
      return true;
    } catch (error) {
      throw this.handleError(error, 'Deleting webhook');
    }
  }

  async getWebhookById(id) {
    try {
      const webhook = await db.query.webhooks.findFirst({
        where: and(
          eq(schema.webhooks.id, id),
          eq(schema.webhooks.isActive, true)
        )
      });
      return webhook || null;
    } catch (error) {
      throw this.handleError(error, 'Getting webhook by ID');
    }
  }

  async getWebhooksByStore(storeId) {
    try {
      const webhooks = await db.query.webhooks.findMany({
        where: and(
          eq(schema.webhooks.storeId, storeId),
          eq(schema.webhooks.isActive, true)
        ),
        orderBy: [desc(schema.webhooks.createdAt)]
      });
      return webhooks;
    } catch (error) {
      throw this.handleError(error, 'Getting webhooks by store');
    }
  }

  async triggerWebhook(eventType, data, storeId) {
    try {
      const webhooks = await this._getWebhooksForEvent(eventType, storeId);
      const event = await this._createWebhookEvent(eventType, data);
      
      for (const webhook of webhooks) {
        await this.deliverWebhook(webhook, event, data);
      }
    } catch (error) {
      logger.error('Error triggering webhook:', { 
        error: error.message,
        eventType,
        storeId,
        context: 'triggerWebhook'
      });
    }
  }

  async _getWebhooksForEvent(eventType, storeId) {
    return await db.query.webhooks.findMany({
      where: and(
        eq(schema.webhooks.storeId, storeId),
        eq(schema.webhooks.isActive, true),
        sql`${schema.webhooks.events} ? ${eventType}`
      )
    });
  }

  async _createWebhookEvent(eventType, data) {
    const [event] = await db
      .insert(schema.webhookEvents)
      .values({
        webhookId: 0,
        event: eventType,
        payload: JSON.stringify(data),
        createdAt: new Date()
      })
      .returning();
    
    return event;
  }

  async deliverWebhook(webhook, event, data) {
    let attempt = 0;
    let lastError = null;
    
    while (attempt < WebhookService.MAX_RETRY_ATTEMPTS) {
      try {
        const delivery = await this._createDeliveryRecord(webhook, event, attempt);
        await this._sendWebhookRequest(webhook, event, data, delivery);
        return;
      } catch (error) {
        lastError = error;
        attempt++;
        await this._handleDeliveryFailure(webhook, event, attempt, lastError);
        
        if (attempt < WebhookService.MAX_RETRY_ATTEMPTS) {
          await this._waitBeforeRetry(attempt);
        }
      }
    }
    
    logger.error(`Webhook delivery failed after ${WebhookService.MAX_RETRY_ATTEMPTS} attempts:`, {
      error: lastError?.message,
      webhookId: webhook.id,
      eventId: event.id,
      context: 'deliverWebhook'
    });
  }

  async _createDeliveryRecord(webhook, event, attempt) {
    const [delivery] = await db
      .insert(schema.webhookDeliveries)
      .values({
        webhookId: webhook.id,
        eventId: event.id,
        attempt: attempt + 1,
        status: 'pending',
        createdAt: new Date()
      })
      .returning();
    
    return delivery;
  }

  async _sendWebhookRequest(webhook, event, data, delivery) {
    const signature = this.generateSignature(JSON.stringify(data), webhook.secret);
    
    const response = await axios.post(webhook.url, data, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': event.event,
        'User-Agent': 'ChainSync-Webhook/1.0'
      },
      timeout: 30000
    });
    
    await this._updateDeliverySuccess(delivery.id, response.data);
  }

  async _updateDeliverySuccess(deliveryId, responseData) {
    await db
      .update(schema.webhookDeliveries)
      .set({
        status: 'delivered',
        response: JSON.stringify(responseData),
        updatedAt: new Date()
      })
      .where(eq(schema.webhookDeliveries.id, deliveryId));
  }

  async _handleDeliveryFailure(webhook, event, attempt, lastError) {
    const deliveryRecord = await db.query.webhookDeliveries.findFirst({
      where: and(
        eq(schema.webhookDeliveries.webhookId, webhook.id),
        eq(schema.webhookDeliveries.eventId, event.id),
        eq(schema.webhookDeliveries.attempt, attempt)
      )
    });
    
    if (deliveryRecord) {
      await db
        .update(schema.webhookDeliveries)
        .set({
          status: attempt >= WebhookService.MAX_RETRY_ATTEMPTS ? 'failed' : 'retrying',
          response: lastError?.message ?? null
        })
        .where(eq(schema.webhookDeliveries.id, deliveryRecord.id));
    }
  }

  async _waitBeforeRetry(attempt) {
    await new Promise(resolve => 
      setTimeout(resolve, WebhookService.RETRY_DELAY_MS * attempt)
    );
  }

  generateSignature(payload, secret) {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  async getWebhookDeliveries(webhookId, limit = 50) {
    try {
      const deliveries = await db.query.webhookDeliveries.findMany({
        where: eq(schema.webhookDeliveries.webhookId, webhookId),
        orderBy: [desc(schema.webhookDeliveries.createdAt)],
        limit
      });
      return deliveries;
    } catch (error) {
      throw this.handleError(error, 'Getting webhook deliveries');
    }
  }

  async retryWebhookDelivery(deliveryId) {
    try {
      const { delivery, webhook, event } = await this._getDeliveryDetails(deliveryId);
      const eventData = event.payload ? JSON.parse(event.payload) : {};
      
      await this.deliverWebhook(webhook, event, eventData);
      return true;
    } catch (error) {
      throw this.handleError(error, 'Retrying webhook delivery');
    }
  }

  async _getDeliveryDetails(deliveryId) {
    const delivery = await db.query.webhookDeliveries.findFirst({
      where: eq(schema.webhookDeliveries.id, deliveryId)
    });
    
    if (!delivery) {
      throw new AppError(
        'Delivery not found',
        ErrorCode.NOT_FOUND,
        ErrorCategory.VALIDATION
      );
    }
    
    const webhook = await db.query.webhooks.findFirst({
      where: eq(schema.webhooks.id, delivery.webhookId)
    });
    
    const event = await db.query.webhookEvents.findFirst({
      where: eq(schema.webhookEvents.id, delivery.eventId)
    });
    
    if (!webhook || !event) {
      throw new AppError(
        'Related webhook or event not found',
        ErrorCode.NOT_FOUND,
        ErrorCategory.VALIDATION
      );
    }
    
    return { delivery, webhook, event };
  }
}

export { WebhookService };
WebhookService.MAX_RETRY_ATTEMPTS = 3;
WebhookService.RETRY_DELAY_MS = 1000;
