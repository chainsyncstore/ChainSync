import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import * as schema from '../../../shared/schema.js';
import { BaseService } from '../base/service.js';
import {
  IWebhookService,
  WebhookConfig,
  WebhookEvent,
  WebhookDelivery,
  CreateWebhookParams,
  UpdateWebhookParams,
  WebhookEventType
} from './types.js';
import { webhookValidation, SchemaValidationError } from '../../../shared/schema-validation.js';
import { AppError, ErrorCode, ErrorCategory } from '../../../shared/types/errors.js';
import crypto from 'crypto';
import axios from 'axios';

export class WebhookService extends BaseService implements IWebhookService {
  private static readonly MAX_RETRY_ATTEMPTS = 3;
  private static readonly RETRY_DELAY_MS = 1000;

  async handlePaystackWebhook(
    signature: string,
    payload: string
  ): Promise<{ success: boolean; message: string; orderId?: number; reference?: string; amount?: number; }> {
    // For now, basic stub implementation
    return { success: true, message: 'Handled Paystack webhook' };
  }

  async handleFlutterwaveWebhook(
    signature: string,
    payload: string
  ): Promise<{ success: boolean; message: string; orderId?: number; reference?: string; amount?: number; }> {
    return { success: true, message: 'Handled Flutterwave webhook' };
  }

  async createWebhook(params: CreateWebhookParams): Promise<WebhookConfig> {
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
        .values(validatedData as any)
        .returning();

      return webhook;
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        console.error(`Validation error: ${(error as any).message}`, (error as any).toJSON());
      }
      throw this.handleError(error as Error, 'Creating webhook');
    }
  }

  async updateWebhook(id: number, params: UpdateWebhookParams): Promise<WebhookConfig> {
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
          ...validatedData
        })
        .where(eq(schema.webhooks.id, id))
        .returning();

      return updatedWebhook;
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        console.error(`Validation error: ${(error as any).message}`, (error as any).toJSON());
      }
      throw this.handleError(error as Error, 'Updating webhook');
    }
  }

  async deleteWebhook(id: number): Promise<boolean> {
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
          url: existingWebhook.url
        })
        .where(eq(schema.webhooks.id, id));

      return true;
    } catch (error) {
      throw this.handleError(error as Error, 'Deleting webhook');
    }
  }

  async getWebhookById(id: number): Promise<WebhookConfig | null> {
    try {
      const webhook = await db.query.webhooks.findFirst({
        where: and(
          eq(schema.webhooks.id, id),
          eq(schema.webhooks.isActive, true)
        )
      });

      return webhook || null;
    } catch (error) {
      throw this.handleError(error as Error, 'Getting webhook by ID');
    }
  }

  async getWebhooksByStore(storeId: number): Promise<WebhookConfig[]> {
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
      throw this.handleError(error as Error, 'Getting webhooks by store');
    }
  }

  async triggerWebhook(eventType: WebhookEventType, data: any, storeId: number): Promise<void> {
    try {
      const webhooks = await db.query.webhooks.findMany({
        where: and(
          eq(schema.webhooks.storeId, storeId),
          eq(schema.webhooks.isActive, true),
          sql`${schema.webhooks.events} ? ${eventType}`
        )
      });

      const [event] = await db
        .insert(schema.webhookEvents)
        .values({
          webhookId: 0,
          event: eventType,
        })
        .returning();

      for (const webhook of webhooks) {
        await this.deliverWebhook(webhook, event, data);
      }
    } catch (error) {
      console.error('Error triggering webhook:', error);
    }
  }

  private async deliverWebhook(webhook: WebhookConfig, event: WebhookEvent, data: any): Promise<void> {
    let attempt = 0;
    let lastError: Error | null = null;

      while (attempt < WebhookService.MAX_RETRY_ATTEMPTS) {
      try {
        const [delivery] = await db
          .insert(schema.webhookDeliveries)
          .values({
            webhookId: webhook.id,
            eventId: event.id,
          })
          .returning();

        const signature = this.generateSignature(JSON.stringify(data), webhook.secret as string);

        const response = await axios.post(webhook.url, data, {
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Event': event.event,
            'User-Agent': 'ChainSync-Webhook/1.0'
          },
          timeout: 30000
        });

        await db
          .update(schema.webhookDeliveries)
          .set({
            webhookId: delivery.webhookId
          })
          .where(eq(schema.webhookDeliveries.id, delivery.id));

        return;
      } catch (error) {
        lastError = error as Error;
        attempt++;

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
              webhookId: deliveryRecord.webhookId
            })
            .where(eq(schema.webhookDeliveries.id, deliveryRecord.id));
        }

        if (attempt < WebhookService.MAX_RETRY_ATTEMPTS) {
          await new Promise(resolve => setTimeout(resolve, WebhookService.RETRY_DELAY_MS * attempt));
        }
      }
    }

    console.error(`Webhook delivery failed after ${WebhookService.MAX_RETRY_ATTEMPTS} attempts:`, lastError);
  }

  private generateSignature(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  async getWebhookDeliveries(webhookId: number, limit = 50): Promise<WebhookDelivery[]> {
    try {
      const deliveries = await db.query.webhookDeliveries.findMany({
        where: eq(schema.webhookDeliveries.webhookId, webhookId),
        orderBy: [desc(schema.webhookDeliveries.createdAt)],
        limit,
      });

      return deliveries as unknown as WebhookDelivery[];
    } catch (error) {
      throw this.handleError(error as Error, 'Getting webhook deliveries');
    }
  }

  async retryWebhookDelivery(deliveryId: number): Promise<boolean> {
    try {
      const delivery = await db.query.webhookDeliveries.findFirst({
        where: eq(schema.webhookDeliveries.id, deliveryId),
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

      const eventData = event.payload ? JSON.parse(event.payload as string) : {};

      await this.deliverWebhook(webhook as WebhookConfig, event as WebhookEvent, eventData);

      return true;
    } catch (error) {
      throw this.handleError(error as Error, 'Retrying webhook delivery');
    }
  }
}
