import type { Request } from 'express'; // Changed to type import
import { eq } from 'drizzle-orm';
import Flutterwave from 'flutterwave-node-v3';
import Paystack from 'paystack-node';

import * as schema from '@shared/schema';
import { getSecureDb } from '../../utils/secure-db';
import { AppError } from '../../middleware/utils/app-error';
import { ErrorCategory, ErrorCode } from '../../middleware/types/error';
import { BaseService } from '../base/base-service';
import { logger } from '../logger';

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

// Types for payment provider responses
interface PaystackTransactionResponse {
  status: boolean;
  data?: {
    amount: number;
    currency: string;
    created_at: string;
    metadata?: Record<string, unknown>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface FlutterwaveTransactionResponse {
  status: string;
  data?: TransactionData;
  [key: string]: unknown;
}

// Helper function to verify webhook signatures
const verifyWebhookSignature = (signature: string, key: string): boolean => {
  // Implement signature verification logic based on provider
  return true; // Replace with actual verification
};

// Unified PaymentService supporting both Paystack and Flutterwave
export class PaymentService extends BaseService {
  // Using any type for payment providers as library types are incomplete
  // This is a deliberate exception to the no-explicit-any rule
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private paystack: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private flutterwave: any = null;
  private db = getSecureDb();

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
        throw new AppError('Payment reference is required', 'payment', 'INVALID_REFERENCE');
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
      throw new AppError('Payment not found or verification failed', 'payment', 'PAYMENT_NOT_FOUND', { reference });
    } catch (error: unknown) {
      logger.error('Error verifying payment:', error);
      throw error instanceof AppError ? error : new AppError('Failed to verify payment', 'payment', 'PAYMENT_VERIFICATION_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
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
      throw new AppError('Missing required payment data', 'payment', 'INVALID_PAYMENT_DATA', { userId, email, amount, plan });
    }
    if (typeof amount !== 'number' || amount <= 0) {
      throw new AppError('Invalid payment amount', 'payment', 'INVALID_AMOUNT', { amount });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new AppError('Invalid email format', 'payment', 'INVALID_EMAIL', { email });
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
          // TODO: Ensure schema.payment exists and has the correct structure
          await this.db.query(`
        INSERT INTO payments (
          reference, user_id, amount, currency, provider, status, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
            reference,
            userId,
            discountedAmount,
            'NGN', // Default for Paystack
            provider,
            'initialized',
            { plan, referralCode }
          ]);
          
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
          // TODO: Ensure schema.payment exists and has the correct structure
          await this.db.query(`
        INSERT INTO payments (
          reference, user_id, amount, currency, provider, status, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
            reference,
            userId,
            discountedAmount,
            'NGN',
            provider,
            'initialized',
            { plan, referralCode }
          ]);
          
          return {
            authorization_url: response.data.link,
            reference,
            provider
          };
        }
      }

      throw new AppError('No payment provider available for initialization', 'payment', 'NO_PAYMENT_PROVIDER', { provider });
    } catch (error: unknown) {
      this.logger.error('Payment initialization error:', error);
      throw error instanceof AppError ? error : new AppError('An error occurred during payment initialization', 'payment', 'PAYMENT_ERROR', { error: error.message });
    }
  }

  async trackPaymentStatus(reference: string, status: PaymentStatus['status']): Promise<void> {
    try {
      await this.withTransaction(async (trx: any) => { // Added : any to trx for now
        // Assuming 'trx' is the Drizzle transaction client and schema.paymentStatus is the table
        // Also assuming 'reference' is the column to check for conflicts.
        if (!schema.paymentStatus) { // Changed to schema.paymentStatus
          throw new Error("schema.paymentStatus is not defined. Check your schema import and definition.");
        }
        await trx.insert(schema.paymentStatus) // Changed to schema.paymentStatus
          .values({
            reference: reference,
            status: status,
            updatedAt: new Date(),
            // Ensure all non-nullable fields of paymentStatus are covered here or have defaults
          })
          .onConflictDoUpdate({
            target: schema.paymentStatus.columns.reference, // Using .columns.reference based on error type hint
            set: {
              status: status,
              updatedAt: new Date()
            }
          });
      });
    } catch (error: unknown) {
      this.logger.error('Error tracking payment status:', error);
      throw error instanceof AppError ? error : new AppError('Failed to track payment status', 'payment', 'PAYMENT_TRACKING_ERROR', { reference, status });
    }
  }

  async handleWebhook(request: Request): Promise<void> {
    const body = request.body as PaymentWebhookRequest;
    if (!body) {
      throw new AppError('Empty webhook body', 'payment', 'INVALID_WEBHOOK', {});
    }

    const { provider, reference, status, signature } = body;
    
    // Verify webhook signature
    const expectedKey = WEBHOOK_KEYS[provider as 'paystack' | 'flutterwave'];
    if (!expectedKey || !signature || !verifyWebhookSignature(signature, expectedKey)) {
      throw new AppError('Invalid webhook signature', 'payment', 'INVALID_WEBHOOK', { provider, reference });
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
      } catch (error: unknown) {
        const errors = error instanceof Error ? [error] : 
          Array.isArray(error) ? error.filter(e => e instanceof Error) as Error[] : 
          [new Error(String(error))];
        // try {
          // await this.logPaymentErrors(paymentData, errors); // Commented out: paymentData and logPaymentErrors are undefined
        // } catch (logError: unknown) {
          // logger.error('Failed to log payment errors:', logError instanceof Error ? logError.message : String(logError));
        // }
        if (error instanceof Error) {
          lastError = error;
        } else {
          lastError = new Error(String(error));
        }
        await new Promise(resolve => setTimeout(resolve, retryDelays[i]));
      }
    }
    throw lastError;
  }

  async trackPaymentAnalytics(paymentData: PaymentAnalytics): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO paymentsAnalytics (reference, amount, currency, provider, status, success, metadata, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        paymentData.reference,
        paymentData.amount,
        paymentData.currency,
        paymentData.provider,
        paymentData.status,
        paymentData.success,
        paymentData.metadata,
        paymentData.timestamp
      ]);
    } catch (error: unknown) {
      this.logger.error('Error tracking payment analytics:', error);
      throw error instanceof AppError ? error : new AppError('payment', 'ANALYTICS_ERROR', 'Failed to track payment analytics', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async refundPayment(reference: string, amount?: number): Promise<boolean> {
    try {
      const result = await this.db.query(
        `SELECT * FROM payments WHERE reference = $1 LIMIT 1`,
        [reference]
      );
      const payment = result.rows[0];
      
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
          currency: payment.currency,
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
    } catch (error: unknown) {
      logger.error('Error processing Flutterwave transaction:', error);
      throw error instanceof Error ? error : new AppError('payment', 'FLUTTERWAVE_TRANSACTION_ERROR', 'Failed to process Flutterwave transaction');
    }
  }
}

export default PaymentService;
