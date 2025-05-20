import { Paystack } from 'paystack-node';
import { Flutterwave } from 'flutterwave-node-v3';
import { logger } from '../../utils/logger';
import { PaymentProviderConfig, PaymentVerificationResponse, PaymentAnalytics, PaymentWebhookRequest, PaymentStatus, PaymentInitializationResponse, FlutterwavePaymentRequest } from './payment-types';

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
            env: 'test'
          })
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
