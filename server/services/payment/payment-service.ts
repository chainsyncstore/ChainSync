import Paystack from 'paystack-node';
import Flutterwave from 'flutterwave-node-v3';
import type { Logger } from '../../../src/logging/Logger';
import { ConsoleLogger } from '../../../src/logging/Logger';
import { PaymentProviderConfig, PaymentVerificationResponse, PaymentAnalytics, PaymentWebhookRequest, PaymentStatus, PaymentInitializationResponse, FlutterwavePaymentRequest } from './payment-types';

export class PaymentService {
  private readonly paystack: unknown;
  private readonly flutterwave: unknown;
  private readonly config: PaymentProviderConfig;
  private logger: Logger = ConsoleLogger;

  constructor() {
    // Default logger is ConsoleLogger, can be swapped via setLogger()
    this.logger = new ConsoleLogger(); // Instantiate the logger
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
      this.flutterwave = this.config.flutterwave.secretKey
        ? new Flutterwave(this.config.flutterwave.secretKey)
        : null;

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

  /**
   * Inject a custom logger (e.g., for test or production)
   */
  setLogger(customLogger: Logger) {
    this.logger = customLogger;
  }

  /**
   * Example: Loyalty accrual logic (to be called after payment success)
   * Skips accrual for refunded/failed/flagged transactions and logs with structured fields.
   */
  async handleLoyaltyAccrual({ transactionId, customerId, status, flagged }: { transactionId: string, customerId: number, status: string, flagged?: boolean }) {
    if (status === 'refunded' || status === 'failed' || flagged) {
      this.logger.info('Loyalty accrual skipped', { transactionId, customerId, reason: status === 'refunded' ? 'refunded' : status === 'failed' ? 'failed' : 'flagged', timestamp: new Date().toISOString() });
      return;
    }
    // ...call loyalty accrual logic here
    this.logger.info('Loyalty accrued', { transactionId, customerId, status, timestamp: new Date().toISOString() });
  }

  async initializePayment(
    amount: number,
    email: string,
    currency: string = 'NGN'
  ): Promise<PaymentInitializationResponse> {
    try {
      if (!this.paystack) {
        throw new Error('Paystack provider not initialized');
      }

      const reference = `PAY_${Date.now()}`;
      const response = await this.paystack.transaction.initialize({
        amount,
        email,
        currency,
        reference
      });

      return {
        authorization_url: response.data.authorization_url,
        reference: response.data.reference,
        provider: 'paystack'
      };
    } catch (error: unknown) {
      this.logger.error('Error initializing payment:', error);
      throw new Error('Failed to initialize payment');
    }
  }

  async verifyPayment(reference: string): Promise<PaymentVerificationResponse> {
    try {
      if (!this.paystack) {
        throw new Error('Paystack provider not initialized');
      }

      const response = await this.paystack.transaction.verify(reference);
      const data = response.data;

      return {
        success: data.status === 'success',
        reference: data.reference,
        amount: data.amount,
        currency: data.currency,
        metadata: data.metadata || {},
        provider: 'paystack',
        timestamp: new Date(data.paid_at)
      };
    } catch (error: unknown) {
      this.logger.error('Error verifying payment:', error);
      throw new Error('Failed to verify payment');
    }
  }

  async processFlutterwavePayment(request: FlutterwavePaymentRequest): Promise<PaymentInitializationResponse> {
    try {
      if (!this.flutterwave) {
        throw new Error('Flutterwave provider not initialized');
      }

      const response = await this.flutterwave.Transaction.initialize({
        ...request,
        redirect_url: request.redirect_url || process.env.FLUTTERWAVE_REDIRECT_URL || ''
      });

      return {
        authorization_url: response.data.link,
        reference: response.data.tx_ref,
        provider: 'flutterwave'
      };
    } catch (error: unknown) {
      this.logger.error('Error processing Flutterwave payment:', error);
      throw new Error('Failed to process Flutterwave payment');
    }
  }

  async handleWebhook(request: PaymentWebhookRequest): Promise<PaymentStatus> {
    try {
      if (!request.event) {
        throw new Error('Missing event in webhook request');
      }

      if (request.event === 'charge.success') {
        return {
          status: 'success',
          message: 'Payment successful'
        };
      }

      return {
        status: 'failed',
        message: 'Payment failed'
      };
    } catch (error: unknown) {
      this.logger.error('Error handling webhook:', error);
      throw new Error('Failed to process webhook');
    }
  }

  async getAnalytics(): Promise<PaymentAnalytics> {
    try {
      if (!this.paystack) {
        throw new Error('Paystack provider not initialized');
      }

      const response = await this.paystack.transaction.list({
        from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        to: new Date().toISOString()
      });

      const transactions = response.data.data;
      const totalTransactions = transactions.length;
      const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
      const successCount = transactions.filter(t => t.status === 'success').length;
      const successRate = totalTransactions > 0 ? (successCount / totalTransactions) * 100 : 0;
      const failedTransactions = totalTransactions - successCount;

      return {
        totalTransactions,
        totalAmount,
        successRate,
        failedTransactions
      };
    } catch (error: unknown) {
      this.logger.error('Error getting analytics:', error);
      throw new Error('Failed to get analytics');
    }
  }
}
