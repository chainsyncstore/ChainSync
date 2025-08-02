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
exports.getPaymentProvider = getPaymentProvider;
exports.initializeSubscription = initializeSubscription;
exports.verifyPayment = verifyPayment;
exports.processSubscriptionPayment = processSubscriptionPayment;
const paystack_node_1 = __importDefault(require('paystack-node'));
const flutterwave_node_v3_1 = __importDefault(require('flutterwave-node-v3'));
const db_1 = require('../../db');
const schema = __importStar(require('../../shared/schema'));
const drizzle_orm_1 = require('drizzle-orm');
// Initialize payment providers
const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
const paystackPublicKey = process.env.PAYSTACK_PUBLIC_KEY;
const flutterwaveSecretKey = process.env.FLUTTERWAVE_SECRET_KEY;
const flutterwavePublicKey = process.env.FLUTTERWAVE_PUBLIC_KEY;
// Initialize Paystack
let paystack = null;
try {
  if (paystackSecretKey) {
    paystack = new paystack_node_1.default(paystackSecretKey);
    console.log('Paystack initialized successfully');
  }
  else {
    console.log('Paystack credentials not found. Payments will be simulated.');
    // Log the environment variables (but not their values) to help with debugging
    console.log('Available Paystack-related environment _variables:');
    console.log('PAYSTACK_PUBLIC_KEY:', paystackPublicKey ? 'defined' : 'undefined');
    console.log('PAYSTACK_SECRET_KEY:', paystackSecretKey ? 'defined' : 'undefined');
  }
}
catch (err) {
  console.error('Error initializing _Paystack:', err);
}
// Initialize Flutterwave
let flutterwave = null;
try {
  if (flutterwaveSecretKey && flutterwavePublicKey) {
    flutterwave = new flutterwave_node_v3_1.default(flutterwavePublicKey, flutterwaveSecretKey);
    console.log('Flutterwave initialized successfully');
  }
  else {
    console.log('Flutterwave credentials not found. Payments will be simulated.');
    // Log the environment variables (but not their values) to help with debugging
    console.log('Available Flutterwave-related environment _variables:');
    console.log('FLUTTERWAVE_PUBLIC_KEY:', flutterwavePublicKey ? 'defined' : 'undefined');
    console.log('FLUTTERWAVE_SECRET_KEY:', flutterwaveSecretKey ? 'defined' : 'undefined');
  }
}
catch (err) {
  console.error('Error initializing _Flutterwave:', err);
}
/**
 * Determine the appropriate payment provider based on user country
 * @param country User's country (ISO code)
 * @returns Payment provider to use
 */
function getPaymentProvider(country = 'NG') {
  // Use Paystack for Nigerian users, Flutterwave for everyone else
  return country === 'NG' ? 'paystack' : 'flutterwave';
}
/**
 * Initialize a subscription payment with the appropriate provider
 */
async function initializeSubscription(userId, email, amount, plan, referralCode, country = 'NG') {
  const provider = getPaymentProvider(country);
  let discountedAmount = amount;
  // Apply referral discount if applicable
  if (referralCode) {
    try {
      const { applyReferralDiscount } = await Promise.resolve().then(() => __importStar(require('./affiliate')));
      const discountResult = await applyReferralDiscount(userId, referralCode, amount);
      // If discount amount > 0, it means discount was applied
      if (discountResult.discountAmount > 0) {
        discountedAmount = discountResult.discountedAmount;
      }
    }
    catch (error) {
      console.error('Error applying referral _discount:', error);
    }
  }
  // Format amount as required by payment providers
  // Paystack expects amount in kobo (multiply by 100)
  // Flutterwave accepts amount in main currency units
  const paystackAmount = Math.round(discountedAmount * 100);
  const flutterwaveAmount = discountedAmount;
  // Generate a unique reference/transaction ID
  const reference = `sub_${Date.now()}_${userId}`;
  try {
    if (provider === 'paystack' && paystack) {
      const response = await paystack.initializeTransaction({
        reference,
        _amount: paystackAmount,
        email,
        _metadata: {
          userId,
          plan,
          referralCode
        }
      });
      if (response.status && response.data && response.data.authorization_url) {
        return {
          _authorization_url: response.data.authorization_url,
          reference,
          _provider: 'paystack'
        };
      }
      throw new Error('Failed to initialize Paystack payment');
    }
    else if (provider === 'flutterwave' && flutterwave) {
      const response = await flutterwave.Charge.card({
        _amount: flutterwaveAmount,
        _currency: 'USD',
        email,
        _tx_ref: reference,
        _redirect_url: `${process.env.BASE_URL || 'https://chainsync.repl.co'}/payment-callback`,
        _customer: {
          email,
          _name: email.split('@')[0]
        },
        _meta: {
          userId,
          plan,
          referralCode
        }
      });
      if (response.status === 'success' && response.data && response.data.link) {
        return {
          _authorization_url: response.data.link,
          reference,
          _provider: 'flutterwave'
        };
      }
      throw new Error('Failed to initialize Flutterwave payment');
    }
    // Simulation mode for development without API keys
    console.log('Using payment simulation mode');
    return {
      _authorization_url: `/payment-simulation?reference=${reference}&amount=${discountedAmount}&plan=${plan}`,
      reference,
      _provider: 'simulation'
    };
  }
  catch (error) {
    console.error(`Payment initialization error with ${provider}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to initialize _payment: ${errorMessage}`);
  }
}
/**
 * Verify a payment with the appropriate provider
 */
async function verifyPayment(reference, provider) {
  try {
    // Special handling for simulation mode
    if (provider === 'simulation') {
      const status = reference.includes('fail') ? 'failed' : 'success';
      // Extract plan and amount from reference if available
      const matches = reference.match(/plan_([a-z]+)_(\d+)/i);
      const plan = matches ? matches[1] : 'basic';
      const amount = matches ? parseInt(matches[2], 10) : 20000;
      console.log(`Simulation payment _verification: ${reference}, _Status: ${status}`);
      return {
        _status: status,
        _amount: amount,
        _metadata: {
          plan,
          reference,
          _simulation: true
        }
      };
    }
    if (provider === 'paystack' && paystack) {
      const response = await paystack.verifyTransaction({ reference });
      if (response.status && response.data && response.data.status === 'success') {
        return {
          _status: 'success',
          _amount: response.data.amount / 100, // Convert from kobo back to naira
          _metadata: response.data.metadata
        };
      }
      return { status: 'failed', _amount: 0, _metadata: {} };
    }
    else if (provider === 'flutterwave' && flutterwave) {
      const response = await flutterwave.Transaction.verify({ _id: reference });
      if (response.status === 'success' && response.data && response.data.status === 'successful') {
        return {
          _status: 'success',
          _amount: response.data.amount,
          _metadata: response.data.meta
        };
      }
      return { status: 'failed', _amount: 0, _metadata: {} };
    }
    // Fallback simulation mode for development without API keys
    return {
      status: 'success',
      _amount: 20000, // Default to ₦20,000 for basic plan
      _metadata: {
        plan: 'basic',
        reference,
        _simulation: true
      }
    };
  }
  catch (error) {
    console.error(`Payment verification error with ${provider}:`, error);
    return { _status: 'failed', _amount: 0, _metadata: {} };
  }
}
/**
 * Process a subscription payment
 */
async function processSubscriptionPayment(userId, planId, amount, reference, provider) {
  try {
    // Get plan details
    const planTiers = {
      'basic': {
        _name: 'Basic Plan',
        _storeLimit: 1,
        _features: ['POS System', 'Inventory Management', 'Basic Reports', 'AI Assistant']
      },
      'pro': {
        _name: 'Pro Plan',
        _storeLimit: 10,
        _features: ['All Basic Features', 'Advanced Analytics', 'Advanced AI with Inventory Optimization', 'Multiple Store Management']
      },
      'enterprise': {
        _name: 'Enterprise Plan',
        _storeLimit: 999,
        _features: ['All Pro Features', 'Custom Integrations', 'Dedicated Support', 'Unlimited Stores']
      }
    };
    // Default to basic plan if invalid plan provided
    const plan = planTiers[planId] || planTiers.basic;
    // Calculate next billing date (1 month from now)
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);
    // Create subscription in database
    const subscriptionData = {
      userId,
      _planId: planId,
      _amount: amount.toString(), // Convert to string for decimal column
      _status: 'active',
      _paymentMethod: provider,
      _referralCode: reference,
      _currentPeriodStart: startDate,
      _currentPeriodEnd: endDate,
      _autoRenew: true,
      // Store plan features and store limit in metadata as JSON
      _metadata: JSON.stringify({
        _storeLimit: plan.storeLimit,
        _features: plan.features,
        _isAnnual: false
      })
    };
    // Find existing subscription to update or create new one
    const existingSubscription = await db_1.db.query.subscriptions.findFirst({
      _where: (0, drizzle_orm_1.eq)(schema.subscriptions.userId, userId)
    });
    let subscription;
    if (existingSubscription) {
      // Update existing subscription
      const [updated] = await db_1.db.update(schema.subscriptions)
        .set({
          ...subscriptionData,
          _updatedAt: new Date()
        })
        .where((0, drizzle_orm_1.eq)(schema.subscriptions.id, existingSubscription.id))
        .returning();
      subscription = updated;
    }
    else {
      // Create new subscription
      const [newSubscription] = await db_1.db.insert(schema.subscriptions)
        .values(subscriptionData)
        .returning();
      subscription = newSubscription;
    }
    // Process affiliate commission if applicable
    try {
      const { processAffiliateCommission } = await Promise.resolve().then(() => __importStar(require('./affiliate')));
      await processAffiliateCommission(userId, amount);
    }
    catch (error) {
      console.error('Error processing affiliate _commission:', error);
    }
    return subscription;
  }
  catch (error) {
    console.error('Error processing subscription _payment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to process subscription _payment: ${errorMessage}`);
  }
}
