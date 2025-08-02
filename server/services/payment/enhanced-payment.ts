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
  export let payment: {
    table: string;
    columns: {
      id: string;
      reference: string;
      userId: string;
      amount: string;
      currency: string;
      provider: string;
      status: string;
      plan: string;
      metadata: string;
      createdAt: string;
      updatedAt: string;
    };
  };

  export let paymentAnalytics: {
    table: string;
    columns: {
      id: string;
      reference: string;
      provider: string;
      amount: string;
      currency: string;
      status: string;
      success: string;
      metadata: string;
      timestamp: string;
      createdAt: string;
    };
  };

  export let paymentStatus: {
    table: string;
    columns: {
      id: string;
      reference: string;
      status: string;
      updatedAt: string;
    };
  };
}

// TODO: Define or import the correct schema tables
// These are placeholders until the actual schema is defined
const paymentSchema = {
  table: 'payments',
  columns: {
    id: 'id',
    reference: 'reference',
    userId: 'user_id',
    amount: 'amount',
    currency: 'currency',
    provider: 'provider',
    status: 'status',
    plan: 'plan',
    metadata: 'metadata',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
};

const paymentAnalyticsSchema = {
  table: 'payment_analytics',
  columns: {
    id: 'id',
    reference: 'reference',
    provider: 'provider',
    amount: 'amount',
    currency: 'currency',
    status: 'status',
    success: 'success',
    metadata: 'metadata',
    timestamp: 'timestamp',
    createdAt: 'created_at'
  }
};

const paymentStatusSchema = {
  table: 'payment_status',
  columns: {
    id: 'id',
    reference: 'reference',
    status: 'status',
    updatedAt: 'updated_at'
  }
};

// Use TypeScript casting to safely extend the schema object at runtime
const extendedSchema = schema as typeof schema & {
  payment: typeof paymentSchema;
  paymentAnalytics: typeof paymentAnalyticsSchema;
  paymentStatus: typeof paymentStatusSchema;
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
  authorization_url: string;
  reference: string;
  provider: 'paystack' | 'flutterwave';
}

interface PaymentWebhookRequest {
  provider: 'paystack' | 'flutterwave';
  reference: string;
  status: string;
  signature: string;
  amount?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
}

interface TransactionData {
  id: number;
  tx_ref: string;
  amount: number;
  currency: string;
  charged_amount: number;
  status: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  link?: string;
}

interface PaymentVerificationResponse {
  success: boolean;
  reference: string;
  amount: number;
  currency: string;
  provider: 'paystack' | 'flutterwave';
  metadata: Record<string, unknown>;
  timestamp: Date;
}

interface PaymentAnalytics {
  provider: 'paystack' | 'flutterwave';
  amount: number;
  currency: string;
  status: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  reference?: string;
  success?: boolean;
}

interface PaymentStatus {
  status: string;
}

// Constants
const WEBHOOK_KEYS = {
  paystack: process.env.PAYSTACK_WEBHOOK_KEY,
  flutterwave: process.env.FLUTTERWAVE_WEBHOOK_KEY
} as const;

const retryDelays = [1000, 2000, 5000]; // Milliseconds

// Helper function to verify webhook signatures
const verifyWebhookSignature = (signature: string, key: string): boolean => {
  // Implement signature verification logic based on provider
  return true; // Replace with actual verification
};

// Unified PaymentService supporting both Paystack and Flutterwave
export class PaymentService extends BaseService {
  private paystack: any = null;
  private flutterwave: any = null;

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

  async verifyPayment(reference: string): Promise<PaymentVerificationResponse> {
    try {
      if (!reference) {
        throw new AppError('payment', 'INVALID_REFERENCE', 'Payment reference is required');
      }
      if (this.paystack) {
        const response = await this.paystack.verifyTransaction(reference);
        if (response.status && response.data) {
          return {
            success: true,
            reference,
            amount: response.data.amount,
            currency: response.data.currency,
            provider: 'paystack',
            metadata: response.data.metadata || {},
            timestamp: new Date(response.data.created_at)
          };
        }
      }
      if (this.flutterwave) {
        const response = await this.flutterwave.verifyTransaction(reference);
        if (response.status === 'success' && response.data) {
          const transactionData = response.data as TransactionData;
          return {
            success: true,
            reference: transactionData.tx_ref,
            amount: transactionData.amount,
            currency: transactionData.currency,
            provider: 'flutterwave',
            metadata: transactionData.metadata || {},
            timestamp: new Date(transactionData.created_at)
          };
        }
      }
      throw new AppError('payment', 'PAYMENT_NOT_FOUND', 'Payment not found or verification failed', { reference });
    } catch (error: any) {
      logger.error('Error verifying payment:', error);
      throw error instanceof AppError ? error : new AppError('payment', 'PAYMENT_VERIFICATION_ERROR', 'Failed to verify payment', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  private async validatePaymentData(
    userId: number,
    email: string,
    amount: number,
    plan: string,
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

  private getPaymentProvider(country: string = 'NG'): 'paystack' | 'flutterwave' {
    // Use Paystack for Nigerian users, Flutterwave for everyone else
    return country === 'NG' ? 'paystack' : 'flutterwave';
  }

  async initializeSubscription(
    userId: number,
    email: string,
    amount: number,
    plan: string,
    country: string = 'NG',
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
        // TODO: Implement referral discount logic
        discountedAmount = amount * 0.9; // 10% discount for example
      }

      if (provider === 'paystack' && this.paystack) {
        const response = await this.paystack.initializeTransaction({
          reference,
          amount: Math.round(discountedAmount * 100), // Paystack expects amount in kobo
          email,
          metadata: { userId, plan, referralCode }
        });

        if (response.status && response.data) {
          // Record the payment initialization in the database
          // TODO: Update this when the actual schema is defined
          await db.insert(extendedSchema.payment).values({
            reference,
            userId,
            amount: discountedAmount,
            currency: 'NGN', // Default for Paystack
            provider,
            status: 'initialized',
            plan,
            metadata: { referralCode }
          });

          return {
            authorization_url: response.data.authorization_url,
            reference,
            provider
          };
        }
      } else if (provider === 'flutterwave' && this.flutterwave) {
        const response = await this.flutterwave.Charge.card({
          card_number: '', // This should come from secure form
          cvv: '', // This should come from secure form
          expiry_month: '', // This should come from secure form
          expiry_year: '', // This should come from secure form
          amount: discountedAmount,
          currency: 'NGN', // Default, can be changed
          tx_ref: reference,
          email,
          redirect_url: process.env.FLUTTERWAVE_REDIRECT_URL
        });

        if (response.status === 'success' && response.data.link) {
          // Record the payment initialization in the database
          // TODO: Update this when the actual schema is defined
          await db.insert(extendedSchema.payment).values({
            reference,
            userId,
            amount: discountedAmount,
            currency: 'NGN',
            provider,
            status: 'initialized',
            plan,
            metadata: { referralCode }
          });

          return {
            authorization_url: response.data.link,
            reference,
            provider
          };
        }
      }

      throw new AppError('payment', 'NO_PAYMENT_PROVIDER', 'No payment provider available for initialization', { provider });
    } catch (error: any) {
      this.logger.error('Payment initialization error:', error);
      throw error instanceof AppError ? error : new AppError('payment', 'PAYMENT_ERROR', 'An error occurred during payment initialization', { error: error.message });
    }
  }

  async trackPaymentStatus(reference: string, status: PaymentStatus['status']): Promise<void> {
    try {
      // TODO: Update this when the actual schema is defined
      // Use the extended schema with proper typing
      await db.update(extendedSchema.paymentStatus)
        .set({
          status,
          updatedAt: new Date()
        })
        // Use a raw SQL expression for the where clause to avoid type errors
        .where(eq(db.sql`${extendedSchema.paymentStatus.columns.reference}`, reference));
    } catch (error) {
      this.logger.error('Error tracking payment status:', error);
      throw error instanceof AppError ? error : new AppError('payment', 'PAYMENT_TRACKING_ERROR', 'Failed to track payment status', { reference, status });
    }
  }

  async handleWebhook(request: Request): Promise<void> {
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
      amount: body.amount || 0,
      currency: body.currency || 'NGN',
      provider,
      status, // Add the status from the webhook request
      success: status === 'successful',
      metadata: body.metadata || {},
      timestamp: new Date()
    });
  }

  async retryPayment(reference: string, attempts: number = 3): Promise<PaymentVerificationResponse> {
    let lastError: Error | null = null;
    for (let i = 0; i < attempts; i++) {
      try {
        const result = await this.verifyPayment(reference);
        return result;
      } catch (error: any) {
        lastError = error;
        await new Promise(resolve => setTimeout(resolve, retryDelays[i]));
      }
    }
    throw lastError;
  }

  async trackPaymentAnalytics(paymentData: PaymentAnalytics): Promise<void> {
    try {
      // TODO: Update this when the actual schema is defined
      await db.insert(extendedSchema.paymentAnalytics).values(paymentData);
    } catch (error: unknown) {
      this.logger.error('Error tracking payment analytics:', error);
      throw error instanceof AppError ? error : new AppError('payment', 'ANALYTICS_ERROR', 'Failed to track payment analytics', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async refundPayment(reference: string, amount?: number): Promise<boolean> {
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
          id: reference,
          amount: amount ?? payment.amount,
          currency: payment.currency
        });
        if (refundResponse.status === 'success' && refundResponse.data) {
          await this.trackPaymentStatus(reference, 'refunded');
          return true;
        } else {
          throw new AppError('payment', 'REFUND_FAILED', 'Failed to process refund with Flutterwave', { reference, amount });
        }
      }

      throw new AppError('payment', 'NO_PAYMENT_PROVIDER', 'No payment provider available for refund', { provider });
    } catch (error: unknown) {
      this.logger.error('Refund processing error:', error);
      throw error instanceof AppError ? error : new AppError('payment', 'REFUND_ERROR', 'An error occurred during refund processing', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async processFlutterwaveTransaction(transaction: {
    card_number: string;
    cvv: string;
    expiry_month: string;
    expiry_year: string;
    amount: number;
    currency: string;
    email: string;
    tx_ref: string;
    redirect_url?: string;
  }): Promise<{ link: string }> {
    try {
      if (!this.flutterwave) {
        throw new Error('Flutterwave provider not initialized');
      }
      const response = await this.flutterwave.chargeCard({
        ...transaction,
        redirect_url: transaction.redirect_url || process.env.FLUTTERWAVE_REDIRECT_URL
      });
      if (response.status === 'success' && response.data.link) {
        return { link: response.data.link };
      }
      throw new AppError('payment', 'FLUTTERWAVE_TRANSACTION_FAILED', 'Failed to process Flutterwave transaction');
    } catch (error: any) {
      logger.error('Error processing Flutterwave transaction:', error);
      throw error instanceof Error ? error : new AppError('payment', 'FLUTTERWAVE_TRANSACTION_ERROR', 'Failed to process Flutterwave transaction');
    }
  }
}

export default PaymentService;
