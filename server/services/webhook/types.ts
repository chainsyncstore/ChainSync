import { AppError, ErrorCode, ErrorCategory } from '@shared/types/errors';
import * as schema from '@shared/schema';

export interface IWebhookService {
  handlePaystackWebhook(
    signature: string,
    payload: string
  ): Promise<{
    success: boolean;
    message: string;
    orderId?: number;
    reference?: string;
    amount?: number;
  }>;

  handleFlutterwaveWebhook(
    signature: string,
    payload: string
  ): Promise<{
    success: boolean;
    message: string;
    orderId?: number;
    reference?: string;
    amount?: number;
  }>;
}

// ---- Added Webhook domain types ----

export type WebhookConfig = typeof schema.webhooks.$inferSelect;
export type WebhookEvent = typeof schema.webhookEvents.$inferSelect;
export type WebhookDelivery = typeof schema.webhookDeliveries.$inferSelect;

export type WebhookDeliveryStatus = 'pending' | 'delivered' | 'failed';

export interface CreateWebhookParams {
  url: string;
  storeId: number;
  events: string[];
}

export interface UpdateWebhookParams extends Partial<CreateWebhookParams> {
  isActive?: boolean;
}

export type WebhookEventType = string;

export interface IWebhookServiceErrors {
  INVALID_SIGNATURE: Error;
  INVALID_PAYLOAD: Error;
  PROCESSING_FAILED: Error;
  CONFIGURATION_ERROR: Error;
}

export const WebhookServiceErrors: IWebhookServiceErrors = {
  INVALID_SIGNATURE: new Error('Invalid webhook signature'),
  INVALID_PAYLOAD: new Error('Invalid webhook payload'),
  PROCESSING_FAILED: new Error('Failed to process webhook'),
  CONFIGURATION_ERROR: new Error('Payment processor not properly configured')
};
