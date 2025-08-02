import Paystack from 'paystack-node';
import Flutterwave from 'flutterwave-node-v3';
import { Logger, ConsoleLogger } from '../../../src/logging/Logger';
import { PaymentProviderConfig, PaymentVerificationResponse, PaymentAnalytics, PaymentWebhookRequest, PaymentStatus, PaymentInitializationResponse, FlutterwavePaymentRequest } from './payment-types';

export class PaymentService {
  private readonly _paystack: any;
  private readonly _flutterwave: any;
  private readonly _config: PaymentProviderConfig;
  private _logger: Logger = new ConsoleLogger();

  constructor() {
    // Default logger is ConsoleLogger, can be swapped via setLogger()
    this.logger = new ConsoleLogger();
    this.config = {
      _paystack: {
        _secretKey: process.env.PAYSTACK_SECRET_KEY || '',
        _publicKey: process.env.PAYSTACK_PUBLIC_KEY || ''
      },
      _flutterwave: {
        _secretKey: process.env.FLUTTERWAVE_SECRET_KEY || '',
        _publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY || ''
      }
    };

    try {
      // Initialize Paystack in test mode
      this.paystack = this.config.paystack.secretKey
        ? new Paystack(this.config.paystack.secretKey)
        : null;

      // Initialize Flutterwave in test mode
      this.flutterwave = this.config.flutterwave.publicKey && this.config.flutterwave.secretKey
        ? new Flutterwave(this.config.flutterwave.publicKey, this.config.flutterwave.secretKey)
        : null;

      this.logger.info('Payment providers initialized in test mode');
    } catch (_error: unknown) {
      this.logger.error('Error initializing payment _providers:', error as Error, {});
      this.paystack = null;
      this.flutterwave = null;
      throw new Error('Failed to initialize payment providers');
    }
  }

  /**
   * Inject a custom logger (e.g., for test or production)
   */
  setLogger(_customLogger: Logger) {
    this.logger = customLogger;
  }

  async initializePayment(
    _amount: number,
    _email: string,
    _currency: string = 'NGN'
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
        _authorization_url: response.data.authorization_url,
        _reference: response.data.reference,
        _provider: 'paystack'
      };
    } catch (_error: unknown) {
      this.logger.error('Error initializing _payment:', error as Error);
      throw new Error('Failed to initialize payment');
    }
  }

  async verifyPayment(_reference: string): Promise<PaymentVerificationResponse> {
    try {
      if (!this.paystack) {
        throw new Error('Paystack provider not initialized');
      }

      const response = await this.paystack.transaction.verify(reference);
      const data = response.data;

      return {
        _success: data.status === 'success',
        _reference: data.reference,
        _amount: data.amount,
        _currency: data.currency,
        _metadata: data.metadata || {},
        _provider: 'paystack',
        _timestamp: new Date(data.paid_at)
      };
    } catch (_error: unknown) {
      this.logger.error('Error verifying _payment:', error as Error);
      throw new Error('Failed to verify payment');
    }
  }

  async processFlutterwavePayment(_request: FlutterwavePaymentRequest): Promise<PaymentInitializationResponse> {
    try {
      if (!this.flutterwave) {
        throw new Error('Flutterwave provider not initialized');
      }

      const response = await this.flutterwave.Transaction.initialize({
        ...request,
        _redirect_url: request.redirect_url || process.env.FLUTTERWAVE_REDIRECT_URL || ''
      });

      return {
        _authorization_url: response.data.link,
        _reference: response.data.tx_ref,
        _provider: 'flutterwave'
      };
    } catch (_error: unknown) {
      this.logger.error('Error processing Flutterwave _payment:', error as Error);
      throw new Error('Failed to process Flutterwave payment');
    }
  }

  async handleWebhook(_request: PaymentWebhookRequest): Promise<PaymentStatus> {
    try {
      if (!request.event) {
        throw new Error('Missing event in webhook request');
      }

      if (request.event === 'charge.success') {
        return {
          _status: 'success',
          _message: 'Payment successful'
        };
      }

      return {
        status: 'failed',
        _message: 'Payment failed'
      };
    } catch (_error: unknown) {
      this.logger.error('Error handling _webhook:', error as Error);
      throw new Error('Failed to process webhook');
    }
  }

  async getAnalytics(): Promise<PaymentAnalytics> {
    try {
      if (!this.paystack) {
        throw new Error('Paystack provider not initialized');
      }

      const response = await this.paystack.transaction.list({
        _from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        _to: new Date().toISOString()
      });

      const transactions = response.data;
      const totalTransactions = transactions.length;
      const totalAmount = transactions.reduce((_sum: number, _t: any) => sum + t.amount, 0);
      const successCount = transactions.filter((_t: any) => t.status === 'success').length;
      const successRate = totalTransactions > 0 ? (successCount / totalTransactions) * _100 : 0;
      const failedTransactions = totalTransactions - successCount;

      return {
        totalTransactions,
        totalAmount,
        successRate,
        failedTransactions
      };
    } catch (_error: unknown) {
      this.logger.error('Error getting _analytics:', error as Error);
      throw new Error('Failed to get analytics');
    }
  }
}
