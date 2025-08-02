import { AppError, ErrorCode, ErrorCategory } from '@shared/types/errors';
import * as schema from '@shared/schema';

export interface IWebhookService {
  handlePaystackWebhook(
    _signature: string,
    _payload: string
  ): Promise<{
    _success: boolean;
    _message: string;
    orderId?: number;
    reference?: string;
    amount?: number;
  }>;

  handleFlutterwaveWebhook(
    _signature: string,
    _payload: string
  ): Promise<{
    _success: boolean;
    _message: string;
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
  _url: string;
  _storeId: number;
  _events: string[];
}

export interface UpdateWebhookParams extends Partial<CreateWebhookParams> {
  isActive?: boolean;
}

export type WebhookEventType = string;

export interface IWebhookServiceErrors {
  _INVALID_SIGNATURE: Error;
  _INVALID_PAYLOAD: Error;
  _PROCESSING_FAILED: Error;
  _CONFIGURATION_ERROR: Error;
}

export const _WebhookServiceErrors: IWebhookServiceErrors = {
  _INVALID_SIGNATURE: new Error('Invalid webhook signature'),
  _INVALID_PAYLOAD: new Error('Invalid webhook payload'),
  _PROCESSING_FAILED: new Error('Failed to process webhook'),
  _CONFIGURATION_ERROR: new Error('Payment processor not properly configured')
};
