"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentService = void 0;
const base_service_1 = require("../base/base-service");
const app_error_1 = require("../../middleware/utils/app-error");
const logger_1 = require("../logger");
const drizzle_orm_1 = require("drizzle-orm");
const database_1 = __importDefault(require("../../database"));
const schema = __importStar(require("@shared/schema"));
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
const extendedSchema = schema;
// Now we can safely assign without TypeScript errors
extendedSchema.payment = paymentSchema;
extendedSchema.paymentAnalytics = paymentAnalyticsSchema;
extendedSchema.paymentStatus = paymentStatusSchema;
const paystack_node_1 = __importDefault(require("paystack-node"));
const flutterwave_node_v3_1 = __importDefault(require("flutterwave-node-v3"));
// Constants
const WEBHOOK_KEYS = {
    paystack: process.env.PAYSTACK_WEBHOOK_KEY,
    flutterwave: process.env.FLUTTERWAVE_WEBHOOK_KEY
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
                    const transactionData = response.data;
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
            throw new app_error_1.AppError('payment', 'PAYMENT_NOT_FOUND', 'Payment not found or verification failed', { reference });
        }
        catch (error) {
            logger_1.logger.error('Error verifying payment:', error);
            throw error instanceof app_error_1.AppError ? error : new app_error_1.AppError('payment', 'PAYMENT_VERIFICATION_ERROR', 'Failed to verify payment', { error: error instanceof Error ? error.message : 'Unknown error' });
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
                    await database_1.default.insert(extendedSchema.payment).values({
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
            }
            else if (provider === 'flutterwave' && this.flutterwave) {
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
                    await database_1.default.insert(extendedSchema.payment).values({
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
            throw new app_error_1.AppError('payment', 'NO_PAYMENT_PROVIDER', 'No payment provider available for initialization', { provider });
        }
        catch (error) {
            this.logger.error('Payment initialization error:', error);
            throw error instanceof app_error_1.AppError ? error : new app_error_1.AppError('payment', 'PAYMENT_ERROR', 'An error occurred during payment initialization', { error: error.message });
        }
    }
    async trackPaymentStatus(reference, status) {
        try {
            // TODO: Update this when the actual schema is defined
            // Use the extended schema with proper typing
            await database_1.default.update(extendedSchema.paymentStatus)
                .set({
                status,
                updatedAt: new Date()
            })
                // Use a raw SQL expression for the where clause to avoid type errors
                .where((0, drizzle_orm_1.eq)(database_1.default.sql `${extendedSchema.paymentStatus.columns.reference}`, reference));
        }
        catch (error) {
            this.logger.error('Error tracking payment status:', error);
            throw error instanceof app_error_1.AppError ? error : new app_error_1.AppError('payment', 'PAYMENT_TRACKING_ERROR', 'Failed to track payment status', { reference, status });
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
            amount: body.amount || 0,
            currency: body.currency || 'NGN',
            provider,
            status, // Add the status from the webhook request
            success: status === 'successful',
            metadata: body.metadata || {},
            timestamp: new Date()
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
            // TODO: Update this when the actual schema is defined
            await database_1.default.insert(extendedSchema.paymentAnalytics).values(paymentData);
        }
        catch (error) {
            this.logger.error('Error tracking payment analytics:', error);
            throw error instanceof app_error_1.AppError ? error : new app_error_1.AppError('payment', 'ANALYTICS_ERROR', 'Failed to track payment analytics', { error: error instanceof Error ? error.message : 'Unknown error' });
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
                    id: reference,
                    amount: amount ?? payment.amount,
                    currency: payment.currency,
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
            this.logger.error('Refund processing error:', error);
            throw error instanceof app_error_1.AppError ? error : new app_error_1.AppError('payment', 'REFUND_ERROR', 'An error occurred during refund processing', { error: error instanceof Error ? error.message : 'Unknown error' });
        }
    }
    async processFlutterwaveTransaction(transaction) {
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
            throw new app_error_1.AppError('payment', 'FLUTTERWAVE_TRANSACTION_FAILED', 'Failed to process Flutterwave transaction');
        }
        catch (error) {
            logger_1.logger.error('Error processing Flutterwave transaction:', error);
            throw error instanceof Error ? error : new app_error_1.AppError('payment', 'FLUTTERWAVE_TRANSACTION_ERROR', 'Failed to process Flutterwave transaction');
        }
    }
}
exports.PaymentService = PaymentService;
exports.default = PaymentService;
