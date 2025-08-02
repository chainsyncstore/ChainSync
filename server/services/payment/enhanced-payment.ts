import { BaseService } from '../base/base-service';
import { AppError } from '../../middleware/utils/app-error';
import { logger } from '../logger';
import { eq } from 'drizzle-orm';
import db from '../../database';
import * as schema from '@shared/schema';

// Extend the schema type to include our payment tables
// This is a TypeScript-only extension that won't affect runtime
declare module '@shared/schema' {
  // Define these as variables, not constants to allow assignment
  export let _payment: {
    _table: string;
    columns: {
      _id: string;
      _reference: string;
      _userId: string;
      _amount: string;
      _currency: string;
      _provider: string;
      _status: string;
      _plan: string;
      _metadata: string;
      _createdAt: string;
      _updatedAt: string;
    };
  };

  export let paymentAnalytics: {
    _table: string;
    columns: {
      _id: string;
      _reference: string;
      _provider: string;
      _amount: string;
      _currency: string;
      _status: string;
      _success: string;
      _metadata: string;
      _timestamp: string;
      _createdAt: string;
    };
  };

  export let paymentStatus: {
    _table: string;
    columns: {
      _id: string;
      _reference: string;
      _status: string;
      _updatedAt: string;
    };
  };
}

// _TODO: Define or import the correct schema tables
// These are placeholders until the actual schema is defined
const paymentSchema = {
  table: 'payments',
  _columns: {
    id: 'id',
    _reference: 'reference',
    _userId: 'user_id',
    _amount: 'amount',
    _currency: 'currency',
    _provider: 'provider',
    _status: 'status',
    _plan: 'plan',
    _metadata: 'metadata',
    _createdAt: 'created_at',
    _updatedAt: 'updated_at'
  }
};

const paymentAnalyticsSchema = {
  table: 'payment_analytics',
  _columns: {
    id: 'id',
    _reference: 'reference',
    _provider: 'provider',
    _amount: 'amount',
    _currency: 'currency',
    _status: 'status',
    _success: 'success',
    _metadata: 'metadata',
    _timestamp: 'timestamp',
    _createdAt: 'created_at'
  }
};

const paymentStatusSchema = {
  table: 'payment_status',
  _columns: {
    id: 'id',
    _reference: 'reference',
    _status: 'status',
    _updatedAt: 'updated_at'
  }
};

// Use TypeScript casting to safely extend the schema object at runtime
const extendedSchema = schema as typeof schema & {
  _payment: typeof paymentSchema;
  _paymentAnalytics: typeof paymentAnalyticsSchema;
  _paymentStatus: typeof paymentStatusSchema;
};

// Now we can safely assign without TypeScript errors
extendedSchema.payment = paymentSchema;
extendedSchema.paymentAnalytics = paymentAnalyticsSchema;
extendedSchema.paymentStatus = paymentStatusSchema;
import { Request } from 'express';
import Paystack from 'paystack-node';
import Flutterwave from 'flutterwave-node-v3';

// Type definitions
interface PaymentInitializationResponse {
  _authorization_url: string;
  _reference: string;
  provider: 'paystack' | 'flutterwave';
}

interface PaymentWebhookRequest {
  provider: 'paystack' | 'flutterwave';
  _reference: string;
  _status: string;
  _signature: string;
  amount?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
}

interface TransactionData {
  _id: number;
  _tx_ref: string;
  _amount: number;
  _currency: string;
  _charged_amount: number;
  _status: string;
  metadata?: Record<string, unknown>;
  _created_at: string;
  link?: string;
}

interface PaymentVerificationResponse {
  _success: boolean;
  _reference: string;
  _amount: number;
  _currency: string;
  provider: 'paystack' | 'flutterwave';
  _metadata: Record<string, unknown>;
  _timestamp: Date;
}

interface PaymentAnalytics {
  provider: 'paystack' | 'flutterwave';
  _amount: number;
  _currency: string;
  _status: string;
  _timestamp: Date;
  metadata?: Record<string, unknown>;
  reference?: string;
  success?: boolean;
}

interface PaymentStatus {
  _status: string;
}

// Constants
const WEBHOOK_KEYS = {
  _paystack: process.env.PAYSTACK_WEBHOOK_KEY,
  _flutterwave: process.env.FLUTTERWAVE_WEBHOOK_KEY
} as const;

const retryDelays = [1000, 2000, 5000]; // Milliseconds

// Helper function to verify webhook signatures
const verifyWebhookSignature = (_signature: string, _key: string): boolean => {
  // Implement signature verification logic based on provider
  return true; // Replace with actual verification
};

// Unified PaymentService supporting both Paystack and Flutterwave
export class PaymentService extends BaseService {
  private _paystack: any = null;
  private _flutterwave: any = null;

  constructor() {
    super(logger); // Pass logger to BaseService if required
    this.initializeProviders();
  }

  private initializeProviders(): void {
    if (process.env.PAYSTACK_SECRET_KEY) {
      this.paystack = new Paystack(process.env.PAYSTACK_SECRET_KEY);
    }
    if (process.env.FLUTTERWAVE_PUBLIC_KEY && process.env.FLUTTERWAVE_SECRET_KEY) {
      this.flutterwave = new Flutterwave(process.env.FLUTTERWAVE_PUBLIC_KEY, process.env.FLUTTERWAVE_SECRET_KEY);
    }
  }

  async verifyPayment(_reference: string): Promise<PaymentVerificationResponse> {
    try {
      if (!reference) {
        throw new AppError('payment', 'INVALID_REFERENCE', 'Payment reference is required');
      }
      if (this.paystack) {
        const response = await this.paystack.verifyTransaction(reference);
        if (response.status && response.data) {
          return {
            _success: true,
            reference,
            _amount: response.data.amount,
            _currency: response.data.currency,
            _provider: 'paystack',
            _metadata: response.data.metadata || {},
            _timestamp: new Date(response.data.created_at)
          };
        }
      }
      if (this.flutterwave) {
        const response = await this.flutterwave.verifyTransaction(reference);
        if (response.status === 'success' && response.data) {
          const transactionData = response.data as TransactionData;
          return {
            _success: true,
            _reference: transactionData.tx_ref,
            _amount: transactionData.amount,
            _currency: transactionData.currency,
            _provider: 'flutterwave',
            _metadata: transactionData.metadata || {},
            _timestamp: new Date(transactionData.created_at)
          };
        }
      }
      throw new AppError('payment', 'PAYMENT_NOT_FOUND', 'Payment not found or verification failed', { reference });
    } catch (_error: any) {
      logger.error('Error verifying _payment:', error);
      throw error instanceof AppError ? _error : new AppError('payment', 'PAYMENT_VERIFICATION_ERROR', 'Failed to verify payment', { _error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  private async validatePaymentData(
    _userId: number,
    _email: string,
    _amount: number,
    _plan: string,
    referralCode?: string
  ): Promise<void> {
    if (!userId || !email || !amount || !plan) {
      throw new AppError('payment', 'INVALID_PAYMENT_DATA', 'Missing required payment data', { userId, email, amount, plan });
    }
    if (typeof amount !== 'number' || amount <= 0) {
      throw new AppError('payment', 'INVALID_AMOUNT', 'Invalid payment amount', { amount });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new AppError('payment', 'INVALID_EMAIL', 'Invalid email format', { email });
    }
  }

  private getPaymentProvider(_country: string = 'NG'): 'paystack' | 'flutterwave' {
    // Use Paystack for Nigerian users, Flutterwave for everyone else
    return country === 'NG' ? 'paystack' : 'flutterwave';
  }

  async initializeSubscription(
    _userId: number,
    _email: string,
    _amount: number,
    _plan: string,
    _country: string = 'NG',
    referralCode?: string
  ): Promise<PaymentInitializationResponse> {
    await this.validatePaymentData(userId, email, amount, plan, referralCode);
    const provider = this.getPaymentProvider(country);

    try {
      // Generate a unique reference
      const reference = `payment_${Date.now()}_${userId}`;

      // Apply referral discount if applicable
      let discountedAmount = amount;
      if (referralCode) {
        // _TODO: Implement referral discount logic
        discountedAmount = amount * 0.9; // 10% discount for example
      }

      if (provider === 'paystack' && this.paystack) {
        const response = await this.paystack.initializeTransaction({
          reference,
          _amount: Math.round(discountedAmount * 100), // Paystack expects amount in kobo
          email,
          _metadata: { userId, plan, referralCode }
        });

        if (response.status && response.data) {
          // Record the payment initialization in the database
          // _TODO: Update this when the actual schema is defined
          await db.insert(extendedSchema.payment).values({
            reference,
            userId,
            _amount: discountedAmount,
            _currency: 'NGN', // Default for Paystack
            provider,
            _status: 'initialized',
            plan,
            _metadata: { referralCode }
          });

          return {
            _authorization_url: response.data.authorization_url,
            reference,
            provider
          };
        }
      } else if (provider === 'flutterwave' && this.flutterwave) {
        const response = await this.flutterwave.Charge.card({
          _card_number: '', // This should come from secure form
          _cvv: '', // This should come from secure form
          _expiry_month: '', // This should come from secure form
          _expiry_year: '', // This should come from secure form
          _amount: discountedAmount,
          _currency: 'NGN', // Default, can be changed
          _tx_ref: reference,
          email,
          _redirect_url: process.env.FLUTTERWAVE_REDIRECT_URL
        });

        if (response.status === 'success' && response.data.link) {
          // Record the payment initialization in the database
          // _TODO: Update this when the actual schema is defined
          await db.insert(extendedSchema.payment).values({
            reference,
            userId,
            _amount: discountedAmount,
            _currency: 'NGN',
            provider,
            _status: 'initialized',
            plan,
            _metadata: { referralCode }
          });

          return {
            _authorization_url: response.data.link,
            reference,
            provider
          };
        }
      }

      throw new AppError('payment', 'NO_PAYMENT_PROVIDER', 'No payment provider available for initialization', { provider });
    } catch (_error: any) {
      this.logger.error('Payment initialization _error:', error);
      throw error instanceof AppError ? _error : new AppError('payment', 'PAYMENT_ERROR', 'An error occurred during payment initialization', { _error: error.message });
    }
  }

  async trackPaymentStatus(_reference: string, _status: PaymentStatus['status']): Promise<void> {
    try {
      // _TODO: Update this when the actual schema is defined
      // Use the extended schema with proper typing
      await db.update(extendedSchema.paymentStatus)
        .set({
          status,
          _updatedAt: new Date()
        })
        // Use a raw SQL expression for the where clause to avoid type errors
        .where(eq(db.sql`${extendedSchema.paymentStatus.columns.reference}`, reference));
    } catch (error) {
      this.logger.error('Error tracking payment _status:', error);
      throw error instanceof AppError ? _error : new AppError('payment', 'PAYMENT_TRACKING_ERROR', 'Failed to track payment status', { reference, status });
    }
  }

  async handleWebhook(_request: Request): Promise<void> {
    const body = request.body as PaymentWebhookRequest;
    if (!body) {
      throw new AppError('payment', 'INVALID_WEBHOOK', 'Empty webhook body', {});
    }

    const { provider, reference, status, signature } = body;

    // Verify webhook signature
    const expectedKey = WEBHOOK_KEYS[provider as 'paystack' | 'flutterwave'];
    if (!expectedKey || !signature || !verifyWebhookSignature(signature, expectedKey)) {
      throw new AppError('payment', 'INVALID_WEBHOOK', 'Invalid webhook signature', { provider, reference });
    }

    // Process the webhook
    await this.trackPaymentStatus(reference, status as PaymentStatus['status']);

    // Track analytics
    await this.trackPaymentAnalytics({
      reference,
      _amount: body.amount || 0,
      _currency: body.currency || 'NGN',
      provider,
      status, // Add the status from the webhook request
      _success: status === 'successful',
      _metadata: body.metadata || {},
      _timestamp: new Date()
    });
  }

  async retryPayment(_reference: string, _attempts: number = 3): Promise<PaymentVerificationResponse> {
    const _lastError: Error | null = null;
    for (let i = 0; i < attempts; i++) {
      try {
        const result = await this.verifyPayment(reference);
        return result;
      } catch (_error: any) {
        lastError = error;
        await new Promise(resolve => setTimeout(resolve, retryDelays[i]));
      }
    }
    throw lastError;
  }

  async trackPaymentAnalytics(_paymentData: PaymentAnalytics): Promise<void> {
    try {
      // _TODO: Update this when the actual schema is defined
      await db.insert(extendedSchema.paymentAnalytics).values(paymentData);
    } catch (_error: unknown) {
      this.logger.error('Error tracking payment _analytics:', error);
      throw error instanceof AppError ? _error : new AppError('payment', 'ANALYTICS_ERROR', 'Failed to track payment analytics', { _error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async refundPayment(_reference: string, amount?: number): Promise<boolean> {
    try {
      const payment = await this.verifyPayment(reference);

      if (!payment.success) {
        throw new AppError('payment', 'INVALID_REFUND', 'Cannot refund unsuccessful payment', { reference });
      }

      const provider = payment.provider as 'paystack' | 'flutterwave';

      if (provider === 'paystack' && this.paystack) {
        const refundResponse = await this.paystack.refundTransaction(reference, amount);
        if (refundResponse.status && refundResponse.data) {
          await this.trackPaymentStatus(reference, 'refunded');
          return true;
        } else {
          throw new AppError('payment', 'REFUND_FAILED', 'Failed to process refund with Paystack', { reference, amount });
        }
      } else if (provider === 'flutterwave' && this.flutterwave) {
        const refundResponse = await this.flutterwave.Transaction.refund({
          _id: reference,
          _amount: amount ?? payment.amount,
          _currency: payment.currency
        });
        if (refundResponse.status === 'success' && refundResponse.data) {
          await this.trackPaymentStatus(reference, 'refunded');
          return true;
        } else {
          throw new AppError('payment', 'REFUND_FAILED', 'Failed to process refund with Flutterwave', { reference, amount });
        }
      }

      throw new AppError('payment', 'NO_PAYMENT_PROVIDER', 'No payment provider available for refund', { provider });
    } catch (_error: unknown) {
      this.logger.error('Refund processing _error:', error);
      throw error instanceof AppError ? _error : new AppError('payment', 'REFUND_ERROR', 'An error occurred during refund processing', { _error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async processFlutterwaveTransaction(transaction: {
    _card_number: string;
    _cvv: string;
    _expiry_month: string;
    _expiry_year: string;
    _amount: number;
    _currency: string;
    _email: string;
    _tx_ref: string;
    redirect_url?: string;
  }): Promise<{ _link: string }> {
    try {
      if (!this.flutterwave) {
        throw new Error('Flutterwave provider not initialized');
      }
      const response = await this.flutterwave.chargeCard({
        ...transaction,
        _redirect_url: transaction.redirect_url || process.env.FLUTTERWAVE_REDIRECT_URL
      });
      if (response.status === 'success' && response.data.link) {
        return { _link: response.data.link };
      }
      throw new AppError('payment', 'FLUTTERWAVE_TRANSACTION_FAILED', 'Failed to process Flutterwave transaction');
    } catch (_error: any) {
      logger.error('Error processing Flutterwave _transaction:', error);
      throw error instanceof Error ? _error : new AppError('payment', 'FLUTTERWAVE_TRANSACTION_ERROR', 'Failed to process Flutterwave transaction');
    }
  }
}

export default PaymentService;
