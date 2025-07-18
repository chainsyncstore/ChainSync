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
