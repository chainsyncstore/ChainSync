import { schema } from '@shared/schema';
import { AppError, ErrorCode, ErrorCategory } from '@shared/types/errors';

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

export interface IWebhookAppErrors {
  INVALID_SIGNATURE: AppError;
  INVALID_PAYLOAD: AppError;
  PROCESSING_FAILED: AppError;
  CONFIGURATION_ERROR: AppError;
}

export const WebhookAppErrors: IWebhookAppErrors = {
  INVALID_SIGNATURE: new AppError(
    'Invalid webhook signature',
    ErrorCode.INVALID_FIELD_VALUE,
    ErrorCategory.VALIDATION
  ),
  INVALID_PAYLOAD: new AppError(
    'Invalid webhook payload',
    ErrorCode.INVALID_FIELD_VALUE,
    ErrorCategory.VALIDATION
  ),
  PROCESSING_FAILED: new AppError(
    'Failed to process webhook',
    ErrorCategory.SYSTEM, // Corrected category
    ErrorCode.INTERNAL_SERVER_ERROR, // Corrected code
    undefined, // Corrected details (was true)
    500 // Corrected statusCode (was 5000)
    // If retryable was intended, it should be the 6th argument: e.g., undefined, 500, true
  ),
  CONFIGURATION_ERROR: new AppError(
    'Payment processor not properly configured',
    ErrorCode.INTERNAL_SERVER_ERROR,
    ErrorCategory.SYSTEM
  ),
};
