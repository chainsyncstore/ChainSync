import { BaseService } from '../base/base-service';
import { logger } from '../logger';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { Request } from 'express';
import Paystack from 'paystack-node';
import Flutterwave from 'flutterwave-node-v3';

// Type definitions
interface PaymentWebhookRequest {
  provider: 'paystack' | 'flutterwave';
  reference: string;
  status: string;
  signature: string;
  amount?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
}

interface PaymentProviderConfig {
  paystack: {
    secretKey: string;
    publicKey: string;
  };
  flutterwave: {
    secretKey: string;
    publicKey: string;
  };
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
}

interface PaymentStatus {
  status: string;
}

interface ServiceError extends Error {
  code?: string;
  details?: Record<string, unknown>;
}

// Constants
const retryDelays = [1000, 2000, 4000] as const;
const WEBHOOK_KEYS = {
  paystack: process.env.PAYSTACK_WEBHOOK_KEY,
  flutterwave: process.env.FLUTTERWAVE_WEBHOOK_KEY
} as const;

// Helper functions
const verifyWebhookSignature = (signature: string, key: string): boolean => {
  // Implement signature verification logic based on provider
  return true; // Replace with actual verification
};

// PaymentService class
class PaymentService extends BaseService {
  private readonly paystack: Paystack | null;
  private readonly flutterwave: Flutterwave | null;
  private readonly config: PaymentProviderConfig;

  constructor() {
    super();
    this.config = {
      paystack: {
        secretKey: process.env.PAYSTACK_SECRET_KEY || '',
        publicKey: process.env.PAYSTACK_PUBLIC_KEY || ''
      },
      flutterwave: {
        secretKey: process.env.FLUTTERWAVE_SECRET_KEY || '',
        publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY || ''
      }
    };

          return {
            success: true,
            reference,
            amount: response.data.amount,
            currency: response.data.currency,
            provider: 'paystack' as 'paystack',
            metadata: response.data.metadata || {},
            timestamp: new Date(response.data.created_at)
          };
        }
      } else if (this.flutterwave) {
        const response = await this.flutterwave.Transaction.verify({
          tx_ref: reference
        });
        if (response.status === 'success' && response.data) {
          const transactionData = response.data as TransactionData;
          return {
            success: true,
            reference: transactionData.tx_ref,
            amount: transactionData.amount,
            currency: transactionData.currency,
            provider: 'flutterwave' as 'flutterwave',
            metadata: transactionData.metadata || {},
            timestamp: new Date(transactionData.created_at)
          };
        }
      }
      
      throw new Error('Payment not found or verification failed');
    } catch (error: unknown) {
      this.logger.error('Error verifying payment:', error);
      throw error instanceof Error ? error : new Error('Failed to verify payment');
    }
  }

  private async processFlutterwaveTransaction(
    transaction: {
      card_number: string;
      cvv: string;
      expiry_month: string;
      expiry_year: string;
      amount: number;
      currency: string;
      email: string;
      tx_ref: string;
      redirect_url?: string;
    }
  ): Promise<{ link: string }> {
    try {
      if (!this.flutterwave) {
        throw new Error('Flutterwave provider not initialized');
      }

      const response = await this.flutterwave.Transaction.charge({
        ...transaction,
        redirect_url: transaction.redirect_url || process.env.FLUTTERWAVE_REDIRECT_URL
      });

      if (response.status === 'success' && response.data.link) {
        return { link: response.data.link };
      }

      throw new Error('Failed to initialize payment');
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Failed to initialize payment');
    }
  }
}

// PaymentService class
export class PaymentService extends BaseService {
  private paystack: Paystack | null = null;
  private flutterwave: Flutterwave | null = null;

  constructor() {
    super();
    this.initializeProviders();
  }

  private initializeProviders(): void {
    if (process.env.PAYSTACK_SECRET_KEY && process.env.PAYSTACK_PUBLIC_KEY) {
      this.paystack = new Paystack(process.env.PAYSTACK_SECRET_KEY, process.env.PAYSTACK_PUBLIC_KEY);
    }
    if (process.env.FLUTTERWAVE_SECRET_KEY && process.env.FLUTTERWAVE_PUBLIC_KEY) {
      this.flutterwave = new Flutterwave({
        publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY,
        secretKey: process.env.FLUTTERWAVE_SECRET_KEY
      });
    }
  }

  async verifyPayment(reference: string): Promise<PaymentVerificationResponse> {
    try {
      if (!reference) {
        throw new ServiceError(
          'INVALID_REFERENCE',
          'Payment reference is required',
          { reference }
        );
      }

      if (this.paystack) {
        const response = await this.paystack.verifyTransaction(reference);
        if (response.status && response.data) {
          return {
            success: true,
            reference,
            amount: response.data.amount,
            currency: response.data.currency,
            provider: 'paystack' as 'paystack',
            metadata: response.data.metadata || {},
            timestamp: new Date(response.data.created_at)
          };
        }
      } else if (this.flutterwave) {
        const response = await this.flutterwave.Transaction.verify({
          tx_ref: reference
        });
        if (response.status === 'success' && response.data) {
          const transactionData = response.data as TransactionData;
          return {
            success: true,
            reference: transactionData.tx_ref,
            amount: transactionData.amount,
            currency: transactionData.currency,
            provider: 'flutterwave' as 'flutterwave',
            metadata: transactionData.metadata || {},
            timestamp: new Date(transactionData.created_at)
          };
        }
      }
      
      throw new ServiceError(
        'PAYMENT_NOT_FOUND',
        'Payment not found or verification failed',
        { reference }
      );
    } catch (error: unknown) {
      this.logger.error('Error verifying payment:', error);
      throw error instanceof ServiceError ? error : new ServiceError(
        'PAYMENT_VERIFICATION_ERROR',
        'Failed to verify payment',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  private async processFlutterwaveTransaction(
    transaction: {
      card_number: string;
      cvv: string;
      expiry_month: string;
      expiry_year: string;
      amount: number;
      currency: string;
      email: string;
      tx_ref: string;
      redirect_url?: string;
    }
  ): Promise<{ link: string }> {
    try {
      const response = await this.flutterwave.Transaction.charge({
        ...transaction,
        redirect_url: transaction.redirect_url || process.env.FLUTTERWAVE_REDIRECT_URL
      });

      if (response.status === 'success' && response.data.link) {
        return { link: response.data.link };
      }

      throw new ServiceError(
        'PAYMENT_INIT_ERROR',
        'Failed to initialize payment',
        { error: response.message }
      );
    } catch (error: unknown) {
      throw error instanceof ServiceError ? error : new ServiceError(
        'PAYMENT_INIT_ERROR',
        'Failed to initialize payment',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }
}

// PaymentService class
export class PaymentService extends BaseService {
  private paystack: Paystack | null = null;
  private flutterwave: Flutterwave | null = null;

  constructor() {
    super();
    this.initializeProviders();
  }

  private initializeProviders(): void {
    if (process.env.PAYSTACK_SECRET_KEY && process.env.PAYSTACK_PUBLIC_KEY) {
      this.paystack = new Paystack(process.env.PAYSTACK_SECRET_KEY, process.env.PAYSTACK_PUBLIC_KEY);
    }
    if (process.env.FLUTTERWAVE_SECRET_KEY && process.env.FLUTTERWAVE_PUBLIC_KEY) {
      this.flutterwave = new Flutterwave({
        publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY,
        secretKey: process.env.FLUTTERWAVE_SECRET_KEY
      });
    }
  }

  async verifyPayment(reference: string): Promise<PaymentVerificationResponse> {
    try {
      if (!reference) {
        throw new ServiceError(
          'INVALID_REFERENCE',
          'Payment reference is required',
          { reference }
        );
      }

      if (this.paystack) {
        const response = await this.paystack.verifyTransaction(reference);
        if (response.status && response.data) {
          return {
            success: true,
            reference,
            amount: response.data.amount,
            currency: response.data.currency,
            provider: 'paystack' as 'paystack',
            metadata: response.data.metadata || {},
            timestamp: new Date(response.data.created_at)
          };
        }
      } else if (this.flutterwave) {
        const response = await this.flutterwave.Transaction.verify({
          tx_ref: reference
        });
        if (response.status === 'success' && response.data) {
          const transactionData = response.data as TransactionData;
          return {
            success: true,
            reference: transactionData.tx_ref,
            amount: transactionData.amount,
            currency: transactionData.currency,
            provider: 'flutterwave' as 'flutterwave',
            metadata: transactionData.metadata || {},
            timestamp: new Date(transactionData.created_at)
          };
        }
      }
      
      throw new ServiceError(
        'PAYMENT_NOT_FOUND',
        'Payment not found or verification failed',
        { reference }
      );
    } catch (error: unknown) {
      this.logger.error('Error verifying payment:', error);
      throw error instanceof ServiceError ? error : new ServiceError(
        'PAYMENT_VERIFICATION_ERROR',
        'Failed to verify payment',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

// Retry delays for payment retries
const retryDelays = [1000, 2000, 4000];

// Webhook verification keys
const WEBHOOK_KEYS = {
  paystack: process.env.PAYSTACK_WEBHOOK_KEY,
  flutterwave: process.env.FLUTTERWAVE_WEBHOOK_KEY
};

// Helper function to verify webhook signatures
const verifyWebhookSignature = (signature: string, key: string): boolean => {
  // Implement signature verification logic based on provider
  return true; // Replace with actual verification
};

interface TransactionData {
  id: number;
  tx_ref: string;
  amount: number;
  currency: string;
  charged_amount: number;
  status: string;
  created_at: string;
  metadata?: Record<string, any>;
}

interface PaymentProviderResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

  paystack: {
    secretKey: string;
    publicKey: string;
  };
  flutterwave: {
    secretKey: string;
    publicKey: string;
  };
}

export interface PaymentVerificationResponse {
  success: boolean;
  reference: string;
  amount: number;
  currency: string;
  metadata: Record<string, unknown>;
  provider: 'paystack' | 'flutterwave';
  timestamp: Date;
}

export interface PaymentAnalytics {
  totalTransactions: number;
  totalAmount: number;
  successRate: number;
  failedTransactions: number;
}

export interface PaymentWebhookRequest {
  event: string;
  data: Record<string, unknown>;
}

export interface PaymentStatus {
  status: string;
  message: string;
}

export class PaymentService {
  private readonly paystack: Paystack | null;
  private readonly flutterwave: Flutterwave | null;
  private readonly config: PaymentProviderConfig;
  private readonly logger: typeof logger;

  constructor() {
    this.logger = logger;
    this.config = {
      paystack: {
        secretKey: process.env.PAYSTACK_SECRET_KEY || '',
        publicKey: process.env.PAYSTACK_PUBLIC_KEY || ''
      },
      flutterwave: {
        secretKey: process.env.FLUTTERWAVE_SECRET_KEY || '',
        publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY || ''
      }
    };

    try {
      // Initialize Paystack in test mode
      this.paystack = this.config.paystack.secretKey
        ? new Paystack(this.config.paystack.secretKey)
        : null;

      // Initialize Flutterwave in test mode
      this.flutterwave = this.config.flutterwave.secretKey && this.config.flutterwave.publicKey
        ? new Flutterwave({
            publicKey: this.config.flutterwave.publicKey,
            secretKey: this.config.flutterwave.secretKey,
            env: 'test' // Always use test mode
          })
        : null;

      // Log initialization status
      this.logger.info('Payment providers initialized in test mode');
    } catch (error: unknown) {
      this.logger.error('Error initializing payment providers:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      this.paystack = null;
      this.flutterwave = null;
      throw new Error('Failed to initialize payment providers');
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
      throw new ServiceError(
        'INVALID_PAYMENT_DATA',
        'Required payment data is missing',
        { userId, email, amount, plan }
      );
    }

    if (amount <= 0) {
      throw new ServiceError(
        'INVALID_AMOUNT',
        'Payment amount must be greater than zero',
        { amount }
      );
    }

    // Additional validation logic can be added here
  }

  private getPaymentProvider(country: string = 'NG'): 'paystack' | 'flutterwave' {
    return country === 'NG' ? 'paystack' : 'flutterwave';
  }

  async initializeSubscription(
    userId: number,
    email: string,
    amount: number,
    plan: string,
    referralCode?: string,
    country: string = 'NG'
  ): Promise<PaymentInitializationResponse> {
    await this.validatePaymentData(userId, email, amount, plan, referralCode);
    const provider = this.getPaymentProvider(country);

    try {
      if (provider === 'paystack' && this.paystack) {
        const response = await this.paystack.initializeTransaction({
          email,
          amount: amount * 100, // Convert to kobo
          reference: `${plan}-${Date.now()}`,
          metadata: {
            userId,
            plan,
            referralCode
          }
        });

        if (response.status && response.data) {
          return {
            authorization_url: response.data.authorization_url,
            reference: response.data.reference,
            provider: 'paystack'
          };
        }
      } else if (provider === 'flutterwave' && this.flutterwave) {
        const response = await this.flutterwave.Transaction.initialize({
          amount,
          currency: 'NGN',
          email,
          tx_ref: `${plan}-${Date.now()}`,
          meta: {
            userId,
            plan,
            referralCode
          }
        });

        if (response.status === 'success' && response.data) {
          return {
            authorization_url: response.data.data.link,
            reference: response.data.data.tx_ref,
            provider: 'flutterwave'
          };
        }
      }

      throw new ServiceError(
        'PAYMENT_INIT_FAILED',
        'Failed to initialize payment',
        { provider }
      );
    } catch (error: unknown) {
      this.logger.error('Payment initialization error:', error);
      throw error instanceof ServiceError ? error : new ServiceError(
        'PAYMENT_INIT_ERROR',
        'Failed to initialize payment',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  async verifyPayment(reference: string): Promise<PaymentVerificationResponse> {
    try {
      if (!reference) {
        throw new ServiceError(
          'INVALID_REFERENCE',
          'Payment reference is required',
          { reference }
        );
      }

      if (this.paystack) {
        const response = await this.paystack.verifyTransaction(reference);
        if (response.status && response.data) {
          return {
            success: true,
            reference,
            amount: response.data.amount,
            currency: response.data.currency,
            provider: 'paystack' as 'paystack',
            metadata: response.data.metadata || {},
            timestamp: new Date(response.data.created_at)
          };
        }
      } else if (this.flutterwave) {
        const response = await this.flutterwave.Transaction.verify({
          tx_ref: reference
        });
        if (response.status === 'success' && response.data) {
          const transactionData = response.data as TransactionData;
          return {
            success: true,
            reference: transactionData.tx_ref,
            amount: transactionData.amount,
            currency: transactionData.currency,
            provider: 'flutterwave' as 'flutterwave',
            metadata: transactionData.metadata || {},
            timestamp: new Date(transactionData.created_at)
          };
        }
      }
      
      throw new ServiceError(
        'PAYMENT_NOT_FOUND',
        'Payment not found or verification failed',
        { reference }
      );
    } catch (error: unknown) {
      this.logger.error('Error verifying payment:', error);
      throw error instanceof ServiceError ? error : new ServiceError(
        'PAYMENT_VERIFICATION_ERROR',
        'Failed to verify payment',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  async handleWebhook(request: Request): Promise<void> {
    try {
      const body = await new Response(request.body).json();
      const { provider, reference, status, signature } = body as PaymentWebhookRequest;
      const webhookKey = WEBHOOK_KEYS[provider as keyof typeof WEBHOOK_KEYS];

      if (!webhookKey || !verifyWebhookSignature(signature, webhookKey)) {
        throw new ServiceError(
          'INVALID_WEBHOOK',
          'Invalid webhook signature',
          { provider, reference }
        );
      }

      await this.trackPaymentStatus(reference, status);
    } catch (error: unknown) {
      this.logger.error('Webhook handling error:', error);
      throw error instanceof ServiceError ? error : new ServiceError(
        'WEBHOOK_ERROR',
        'Failed to handle webhook',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  async retryPayment(reference: string, attempts: number = 3): Promise<PaymentVerificationResponse> {
    try {
      let lastError: Error | null = null;
      for (let i = 0; i < attempts; i++) {
        try {
          return await this.verifyPayment(reference);
        } catch (error: unknown) {
          lastError = error instanceof Error ? error : new Error('Unknown error');
          if (i < attempts - 1) {
            await new Promise(resolve => setTimeout(resolve, retryDelays[i]));
          }
        }
      }

      throw lastError || new Error('Unknown error');
    } catch (error: unknown) {
      this.logger.error('Payment retry error:', error);
      throw error instanceof ServiceError ? error : new ServiceError(
        'PAYMENT_RETRY_ERROR',
        'Failed to retry payment verification',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  async trackPaymentStatus(reference: string, status: PaymentStatus['status']): Promise<void> {
    try {
      const payment = await db.query.payment.findFirst({
        where: eq(schema.payment.reference, reference)
      });

      if (!payment) {
        throw new ServiceError(
          'PAYMENT_NOT_FOUND',
          'Payment not found',
          { reference }
        );
      }

      await db.update(schema.payment)
        .set({ status })
        .where(eq(schema.payment.reference, reference));
    } catch (error: unknown) {
      this.logger.error('Error tracking payment status:', error);
      throw error instanceof ServiceError ? error : new ServiceError(
        'PAYMENT_TRACKING_ERROR',
        'Failed to track payment status',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  async handleWebhook(request: Request): Promise<void> {
    try {
      const { provider, reference, status, signature } = request.body as PaymentWebhookRequest;
      const webhookKey = WEBHOOK_KEYS[provider as keyof typeof WEBHOOK_KEYS];

      if (!webhookKey || !verifyWebhookSignature(signature, webhookKey)) {
        throw new ServiceError(
          'INVALID_WEBHOOK',
          'Invalid webhook signature',
          { provider, reference }
        );
      }

      await this.trackPaymentStatus(reference, status);
    } catch (error: unknown) {
      this.logger.error('Webhook handling error:', error);
      throw error instanceof ServiceError ? error : new ServiceError(
        'WEBHOOK_ERROR',
        'Failed to handle webhook',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  async retryPayment(reference: string, attempts: number = 3): Promise<PaymentVerificationResponse> {
    try {
      let lastError: Error | null = null;
      for (let i = 0; i < attempts; i++) {
        try {
          return await this.verifyPayment(reference);
        } catch (error: unknown) {
          lastError = error instanceof Error ? error : new Error('Unknown error');
          if (i < attempts - 1) {
            await new Promise(resolve => setTimeout(resolve, retryDelays[i]));
          }
        }
      }

      throw lastError || new Error('Unknown error');
    } catch (error: unknown) {
      this.logger.error('Payment retry error:', error);
      throw error instanceof ServiceError ? error : new ServiceError(
        'PAYMENT_RETRY_ERROR',
        'Failed to retry payment verification',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  async trackPaymentAnalytics(paymentData: PaymentAnalytics): Promise<void> {
    try {
      await db.insert(schema.paymentAnalytics).values(paymentData);
    } catch (error: unknown) {
      this.logger.error('Payment analytics tracking error:', error);
      throw error instanceof ServiceError ? error : new ServiceError(
        'ANALYTICS_TRACKING_ERROR',
        'Failed to track payment analytics',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  async refundPayment(reference: string, amount?: number): Promise<boolean> {
    try {
      const payment = await db.query.payment.findFirst({
        where: eq(schema.payment.reference, reference)
      });

      if (!payment || payment.status !== 'completed') {
        throw new ServiceError(
          'INVALID_REFUND',
          'Payment is not eligible for refund',
          { reference }
        );
      }

      const provider = payment.provider as 'paystack' | 'flutterwave';

      if (provider === 'paystack' && this.paystack) {
        const refundResponse = await this.paystack.refundTransaction(reference, amount);
        if (refundResponse.status && refundResponse.data) {
          await this.trackPaymentStatus(reference, 'refunded');
          return true;
        }
      } else if (provider === 'flutterwave' && this.flutterwave) {
        const refundResponse = await this.flutterwave.Transaction.refund({
          tx_ref: reference,
          amount
        });
        if (refundResponse.status === 'success' && refundResponse.data) {
          await this.trackPaymentStatus(reference, 'refunded');
          return true;
        }
      }

      throw new ServiceError(
        'REFUND_FAILED',
        'Failed to process refund',
        { reference }
      );
    } catch (error: unknown) {
      this.logger.error('Refund processing error:', error);
      throw error instanceof ServiceError ? error : new ServiceError(
        'REFUND_ERROR',
        'Failed to process refund',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
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
      throw new ServiceError(
        'INVALID_PAYMENT_DATA',
        'Missing required payment data',
        { userId, email, amount, plan }
      );
    }

    if (typeof amount !== 'number' || amount <= 0) {
      throw new ServiceError(
        'INVALID_AMOUNT',
        'Invalid payment amount',
        { amount }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ServiceError(
        'INVALID_EMAIL',
        'Invalid email format',
        { email }
      );
    }
  }

  private getPaymentProvider(country: string = 'NG'): 'paystack' | 'flutterwave' {
    // Use Paystack for Nigerian users, Flutterwave for everyone else
    return country === 'NG' ? 'paystack' : 'flutterwave';
  }


  private async validatePaymentData(
    userId: number,
    email: string,
    amount: number,
    plan: string,
    referralCode?: string
  ): Promise<void> {
    if (!userId || !email || !amount || !plan) {
      throw new ServiceError(
        'INVALID_PAYMENT_DATA',
        'Missing required payment data',
        { userId, email, amount, plan }
      );
    }

    if (typeof amount !== 'number' || amount <= 0) {
      throw new ServiceError(
        'INVALID_AMOUNT',
        'Invalid payment amount',
        { amount }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ServiceError(
        'INVALID_EMAIL',
        'Invalid email format',
        { email }
      );
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
    referralCode?: string,
    country: string = 'NG'
  ): Promise<PaymentInitializationResponse> {
    await this.validatePaymentData(userId, email, amount, plan, referralCode);

    const provider = this.getPaymentProvider(country);
    let discountedAmount = amount;

    // Apply referral discount if applicable
    if (referralCode) {
      try {
        const { applyReferralDiscount } = await import('../affiliate');
        const discountResult = await applyReferralDiscount(userId, referralCode, amount);
        if (discountResult.discountAmount > 0) {
          discountedAmount = discountResult.discountedAmount;
        }
      } catch (error) {
        this.logger.error('Error applying referral discount:', error);
      }
    }

    // Generate a unique reference/transaction ID
    const reference = `sub_${Date.now()}_${userId}`;

    try {
      if (provider === 'paystack' && this.paystack) {
        const response = await this.paystack.initializeTransaction({
          reference,
          amount: Math.round(discountedAmount * 100), // Paystack expects amount in kobo
          email,
          metadata: {
            userId,
            plan,
            referralCode,
            provider: 'paystack'
          }
        });

        if (response.status && response.data && response.data.authorization_url) {
          return {
            authorization_url: response.data.authorization_url,
            reference,
            provider: 'paystack'
          };
        }
        throw new ServiceError(
          'PAYMENT_INIT_FAILED',
          'Failed to initialize Paystack payment',
          { response }
        );
      } else if (provider === 'flutterwave' && this.flutterwave) {
        const response = await this.flutterwave.Charge.card({
          amount: discountedAmount,
          currency: 'USD',
          email,
          tx_ref: reference,
          redirect_url: `${process.env.BASE_URL || 'https://chainsync.repl.co'}/payment-callback`,
          customer: {
            email,
            name: email.split('@')[0]
          },
          meta: {
            userId,
            plan,
            referralCode,
            provider: 'flutterwave'
          }
        });

        if (response.status === 'success' && response.data && response.data.link) {
          return {
            authorization_url: response.data.link,
            reference,
            provider: 'flutterwave'
          };
        }
        throw new ServiceError(
          'PAYMENT_INIT_FAILED',
          'Failed to initialize Flutterwave payment',
          { response }
        );
      }

      throw new ServiceError(
        'NO_PAYMENT_PROVIDER',
        'No payment provider available for initialization',
        { provider }
      );
    } catch (error) {
      this.logger.error('Payment initialization error:', error);
      throw error instanceof ServiceError ? error : new ServiceError(
        'PAYMENT_ERROR',
        'An error occurred during payment initialization',
        { error: error.message }
      );
    }
  }

  async trackPaymentStatus(reference: string, status: PaymentStatus['status']): Promise<void> {
    try {
      await this.withTransaction(async (trx) => {
        await db.paymentStatus.upsert({
          where: { reference },
          update: {
            status,
            updatedAt: new Date()
          },
          create: {
            reference,
            status,
            updatedAt: new Date()
          }
        });
      });
    } catch (error) {
      this.logger.error('Error tracking payment status:', error);
      throw error instanceof ServiceError ? error : new ServiceError(
        'PAYMENT_TRACKING_ERROR',
        'Failed to track payment status',
        { reference, status }
      );
    }
  }

  async handleWebhook(request: Request): Promise<void> {
    const body = request.body as PaymentWebhookRequest;
    if (!body) {
      throw new ServiceError(
        'INVALID_WEBHOOK',
        'Empty webhook body',
        {}
      );
    }

    const { provider, reference, status, signature } = body;
    
    // Verify webhook signature
    const expectedKey = WEBHOOK_KEYS[provider as 'paystack' | 'flutterwave'];
    if (!expectedKey || !signature || !verifyWebhookSignature(signature, expectedKey)) {
      throw new ServiceError(
        'INVALID_WEBHOOK',
        'Invalid webhook signature',
        { provider, reference }
      );
    }

    // Process the webhook
    await this.trackPaymentStatus(reference, status as PaymentStatus['status']);
    
    // Track analytics
    await this.trackPaymentAnalytics({
      reference,
      amount: body.amount || 0,
      currency: body.currency || 'NGN',
      provider,
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
      } catch (error) {
        lastError = error;
        await new Promise(resolve => setTimeout(resolve, retryDelays[i]));
      }
    }
    throw lastError;
  }

  async trackPaymentAnalytics(paymentData: PaymentAnalytics): Promise<void> {
    try {
      await db.insert(schema.paymentAnalytics).values(paymentData);
    } catch (error: unknown) {
      this.logger.error('Error tracking payment analytics:', error);
      throw new ServiceError(
        'ANALYTICS_ERROR',
        'Failed to track payment analytics',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  async refundPayment(reference: string, amount?: number): Promise<boolean> {
    try {
      const payment = await this.verifyPayment(reference);
      
      if (!payment.success) {
        throw new ServiceError(
          'INVALID_REFUND',
          'Cannot refund unsuccessful payment',
          { reference }
        );
      }

      const provider = payment.provider as 'paystack' | 'flutterwave';
      
      if (provider === 'paystack' && this.paystack) {
        const refundResponse = await this.paystack.refundTransaction(reference, amount);
        if (refundResponse.status && refundResponse.data) {
          await this.trackPaymentStatus(reference, 'refunded');
          return true;
        } else {
          throw new ServiceError(
            'REFUND_FAILED',
            'Failed to process refund with Paystack',
            { reference, amount }
          );
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
          throw new ServiceError(
            'REFUND_FAILED',
            'Failed to process refund with Flutterwave',
            { reference, amount }
          );
        }
      }
      
      throw new ServiceError(
        'NO_PAYMENT_PROVIDER',
        'No payment provider available for refund',
        { provider }
      );
    } catch (error: unknown) {
      this.logger.error('Refund processing error:', error);
      throw error instanceof ServiceError ? error : new ServiceError(
        'REFUND_ERROR',
        'An error occurred during refund processing',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  } else if (this.flutterwave) {
        const response = await this.flutterwave.Transaction.verify(reference);
        if (response.status === 'success' && response.data) {
          return {
            success: response.data.status === 'successful',
            reference: response.data.tx_ref,
            amount: response.data.amount,
            currency: response.data.currency,
            metadata: response.data.meta_data,
            provider: 'flutterwave'
          };
        }
      }

      throw new ServiceError(
        'PAYMENT_VERIFICATION_FAILED',
        'Failed to verify payment',
        { reference }
      );
    } catch (error: unknown) {
      this.logger.error('Payment verification error:', error);
      throw error instanceof ServiceError ? error : new ServiceError(
        'PAYMENT_ERROR',
        'An error occurred during payment verification',
        { error: error.message }
      );
    }
  }
}
