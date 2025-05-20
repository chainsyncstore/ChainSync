import { AppError, ErrorCode, ErrorCategory } from '@shared/types/errors';
import { schema } from '@shared/schema';

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
  INVALID_SIGNATURE: ServiceError;
  INVALID_PAYLOAD: ServiceError;
  PROCESSING_FAILED: ServiceError;
  CONFIGURATION_ERROR: ServiceError;
}

export const WebhookServiceErrors: IWebhookServiceErrors = {
  INVALID_SIGNATURE: new ServiceError(
    'Invalid webhook signature',
    ErrorCode.INVALID_FIELD_VALUE,
    ErrorCategory.VALIDATION
  ),
  INVALID_PAYLOAD: new ServiceError(
    'Invalid webhook payload',
    ErrorCode.INVALID_FIELD_VALUE,
    ErrorCategory.VALIDATION
  ),
  PROCESSING_FAILED: new ServiceError(
    'Failed to process webhook',
    ErrorCode.INTERNAL_SERVER_ERROR,
    ErrorCategory.SYSTEM,
    true,
    5000
  ),
  CONFIGURATION_ERROR: new ServiceError(
    'Payment processor not properly configured',
    ErrorCode.INTERNAL_SERVER_ERROR,
    ErrorCategory.SYSTEM
  )
};
