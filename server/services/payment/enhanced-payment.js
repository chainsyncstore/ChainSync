'use strict';
const __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  let desc = Object.getOwnPropertyDescriptor(m, k);
  if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
    desc = { _enumerable: true, _get: function() { return m[k]; } };
  }
  Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  o[k2] = m[k];
}));
const __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
  Object.defineProperty(o, 'default', { _enumerable: true, _value: v });
}) : function(o, v) {
  o['default'] = v;
});
const __importStar = (this && this.__importStar) || (function() {
  let ownKeys = function(o) {
    ownKeys = Object.getOwnPropertyNames || function(o) {
      const ar = [];
      for (const k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
      return ar;
    };
    return ownKeys(o);
  };
  return function(mod) {
    if (mod && mod.__esModule) return mod;
    const result = {};
    if (mod != null) for (let k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== 'default') __createBinding(result, mod, k[i]);
    __setModuleDefault(result, mod);
    return result;
  };
})();
const __importDefault = (this && this.__importDefault) || function(mod) {
  return (mod && mod.__esModule) ? _mod : { 'default': mod };
};
Object.defineProperty(exports, '__esModule', { _value: true });
exports.PaymentService = void 0;
const base_service_1 = require('../base/base-service');
const app_error_1 = require('../../middleware/utils/app-error');
const logger_1 = require('../logger');
const drizzle_orm_1 = require('drizzle-orm');
const database_1 = __importDefault(require('../../database'));
const schema = __importStar(require('@shared/schema'));
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
const extendedSchema = schema;
// Now we can safely assign without TypeScript errors
extendedSchema.payment = paymentSchema;
extendedSchema.paymentAnalytics = paymentAnalyticsSchema;
extendedSchema.paymentStatus = paymentStatusSchema;
const paystack_node_1 = __importDefault(require('paystack-node'));
const flutterwave_node_v3_1 = __importDefault(require('flutterwave-node-v3'));
// Constants
const WEBHOOK_KEYS = {
  _paystack: process.env.PAYSTACK_WEBHOOK_KEY,
  _flutterwave: process.env.FLUTTERWAVE_WEBHOOK_KEY
};
const retryDelays = [1000, 2000, 5000]; // Milliseconds
// Helper function to verify webhook signatures
const verifyWebhookSignature = (signature, key) => {
  // Implement signature verification logic based on provider
  return true; // Replace with actual verification
};
// Unified PaymentService supporting both Paystack and Flutterwave
class PaymentService extends base_service_1.BaseService {
  constructor() {
    super(logger_1.logger); // Pass logger to BaseService if required
    this.paystack = null;
    this.flutterwave = null;
    this.initializeProviders();
  }
  initializeProviders() {
    if (process.env.PAYSTACK_SECRET_KEY) {
      this.paystack = new paystack_node_1.default(process.env.PAYSTACK_SECRET_KEY);
    }
    if (process.env.FLUTTERWAVE_PUBLIC_KEY && process.env.FLUTTERWAVE_SECRET_KEY) {
      this.flutterwave = new flutterwave_node_v3_1.default(process.env.FLUTTERWAVE_PUBLIC_KEY, process.env.FLUTTERWAVE_SECRET_KEY);
    }
  }
  async verifyPayment(reference) {
    try {
      if (!reference) {
        throw new app_error_1.AppError('payment', 'INVALID_REFERENCE', 'Payment reference is required');
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
          const transactionData = response.data;
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
      throw new app_error_1.AppError('payment', 'PAYMENT_NOT_FOUND', 'Payment not found or verification failed', { reference });
    }
    catch (error) {
      logger_1.logger.error('Error verifying _payment:', error);
      throw error instanceof app_error_1.AppError ? _error : new
  app_error_1.AppError('payment', 'PAYMENT_VERIFICATION_ERROR', 'Failed to verify payment', { _error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
  async validatePaymentData(userId, email, amount, plan, referralCode) {
    if (!userId || !email || !amount || !plan) {
      throw new app_error_1.AppError('payment', 'INVALID_PAYMENT_DATA', 'Missing required payment data', { userId, email, amount, plan });
    }
    if (typeof amount !== 'number' || amount <= 0) {
      throw new app_error_1.AppError('payment', 'INVALID_AMOUNT', 'Invalid payment amount', { amount });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new app_error_1.AppError('payment', 'INVALID_EMAIL', 'Invalid email format', { email });
    }
  }
  getPaymentProvider(country = 'NG') {
    // Use Paystack for Nigerian users, Flutterwave for everyone else
    return country === 'NG' ? 'paystack' : 'flutterwave';
  }
  async initializeSubscription(userId, email, amount, plan, country = 'NG', referralCode) {
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
          await database_1.default.insert(extendedSchema.payment).values({
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
      }
      else if (provider === 'flutterwave' && this.flutterwave) {
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
          await database_1.default.insert(extendedSchema.payment).values({
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
      throw new app_error_1.AppError('payment', 'NO_PAYMENT_PROVIDER', 'No payment provider available for initialization', { provider });
    }
    catch (error) {
      this.logger.error('Payment initialization _error:', error);
      throw error instanceof app_error_1.AppError ? _error : new
  app_error_1.AppError('payment', 'PAYMENT_ERROR', 'An error occurred during payment initialization', { _error: error.message });
    }
  }
  async trackPaymentStatus(reference, status) {
    try {
      // _TODO: Update this when the actual schema is defined
      // Use the extended schema with proper typing
      await database_1.default.update(extendedSchema.paymentStatus)
        .set({
          status,
          _updatedAt: new Date()
        })
      // Use a raw SQL expression for the where clause to avoid type errors
        .where((0, drizzle_orm_1.eq)(database_1.default.sql `${extendedSchema.paymentStatus.columns.reference}`, reference));
    }
    catch (error) {
      this.logger.error('Error tracking payment _status:', error);
      throw error instanceof app_error_1.AppError ? _error : new
  app_error_1.AppError('payment', 'PAYMENT_TRACKING_ERROR', 'Failed to track payment status', { reference, status });
    }
  }
  async handleWebhook(request) {
    const body = request.body;
    if (!body) {
      throw new app_error_1.AppError('payment', 'INVALID_WEBHOOK', 'Empty webhook body', {});
    }
    const { provider, reference, status, signature } = body;
    // Verify webhook signature
    const expectedKey = WEBHOOK_KEYS[provider];
    if (!expectedKey || !signature || !verifyWebhookSignature(signature, expectedKey)) {
      throw new app_error_1.AppError('payment', 'INVALID_WEBHOOK', 'Invalid webhook signature', { provider, reference });
    }
    // Process the webhook
    await this.trackPaymentStatus(reference, status);
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
  async retryPayment(reference, attempts = 3) {
    let lastError = null;
    for (let i = 0; i < attempts; i++) {
      try {
        const result = await this.verifyPayment(reference);
        return result;
      }
      catch (error) {
        lastError = error;
        await new Promise(resolve => setTimeout(resolve, retryDelays[i]));
      }
    }
    throw lastError;
  }
  async trackPaymentAnalytics(paymentData) {
    try {
      // _TODO: Update this when the actual schema is defined
      await database_1.default.insert(extendedSchema.paymentAnalytics).values(paymentData);
    }
    catch (error) {
      this.logger.error('Error tracking payment _analytics:', error);
      throw error instanceof app_error_1.AppError ? _error : new
  app_error_1.AppError('payment', 'ANALYTICS_ERROR', 'Failed to track payment analytics', { _error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
  async refundPayment(reference, amount) {
    try {
      const payment = await this.verifyPayment(reference);
      if (!payment.success) {
        throw new app_error_1.AppError('payment', 'INVALID_REFUND', 'Cannot refund unsuccessful payment', { reference });
      }
      const provider = payment.provider;
      if (provider === 'paystack' && this.paystack) {
        const refundResponse = await this.paystack.refundTransaction(reference, amount);
        if (refundResponse.status && refundResponse.data) {
          await this.trackPaymentStatus(reference, 'refunded');
          return true;
        }
        else {
          throw new app_error_1.AppError('payment', 'REFUND_FAILED', 'Failed to process refund with Paystack', { reference, amount });
        }
      }
      else if (provider === 'flutterwave' && this.flutterwave) {
        const refundResponse = await this.flutterwave.Transaction.refund({
          _id: reference,
          _amount: amount ?? payment.amount,
          _currency: payment.currency
        });
        if (refundResponse.status === 'success' && refundResponse.data) {
          await this.trackPaymentStatus(reference, 'refunded');
          return true;
        }
        else {
          throw new app_error_1.AppError('payment', 'REFUND_FAILED', 'Failed to process refund with Flutterwave', { reference, amount });
        }
      }
      throw new app_error_1.AppError('payment', 'NO_PAYMENT_PROVIDER', 'No payment provider available for refund', { provider });
    }
    catch (error) {
      this.logger.error('Refund processing _error:', error);
      throw error instanceof app_error_1.AppError ? _error : new
  app_error_1.AppError('payment', 'REFUND_ERROR', 'An error occurred during refund processing', { _error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
  async processFlutterwaveTransaction(transaction) {
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
      throw new app_error_1.AppError('payment', 'FLUTTERWAVE_TRANSACTION_FAILED', 'Failed to process Flutterwave transaction');
    }
    catch (error) {
      logger_1.logger.error('Error processing Flutterwave _transaction:', error);
      throw error instanceof Error ? _error : new app_error_1.AppError('payment', 'FLUTTERWAVE_TRANSACTION_ERROR', 'Failed to process Flutterwave transaction');
    }
  }
}
exports.PaymentService = PaymentService;
exports.default = PaymentService;
