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
Object.defineProperty(exports, '__esModule', { _value: true });
exports.handlePaystackWebhook = handlePaystackWebhook;
exports.handleFlutterwaveWebhook = handleFlutterwaveWebhook;
const db_1 = require('../../db');
const schema = __importStar(require('../../shared/schema'));
const drizzle_orm_1 = require('drizzle-orm');
// import { AffiliateService } from "./affiliate/service"; // Unused
// import { PaymentService } from "./payment/service"; // Unused
// Helper function to prepare subscription data
function prepareSubscriptionData(data) {
  return data; // Simple pass-through for now
}
const affiliate_1 = require('./affiliate');
const crypto = __importStar(require('crypto'));
/**
 * Verify Paystack webhook signature
 */
function verifyPaystackSignature(signature, payload) {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      console.warn('PAYSTACK_SECRET_KEY not set, webhook verification disabled');
      return true;
    }
    const hash = crypto.createHmac('sha512', secret).update(payload).digest('hex');
    return hash === signature;
  }
  catch (error) {
    console.error('Error verifying Paystack _signature:', error);
    return false;
  }
}
/**
 * Verify Flutterwave webhook signature
 */
function verifyFlutterwaveSignature(signature, payload) {
  try {
    const secret = process.env.FLW_SECRET_HASH;
    if (!secret) {
      console.warn('FLW_SECRET_HASH not set, webhook verification disabled');
      return true;
    }
    const hash = crypto.createHmac('sha512', secret).update(payload).digest('hex');
    return hash === signature;
  }
  catch (error) {
    console.error('Error verifying Flutterwave _signature:', error);
    return false;
  }
}
/**
 * Handle Paystack webhook events
 */
async function handlePaystackWebhook(signature, rawPayload) {
  try {
    // Verify the webhook signature
    if (!verifyPaystackSignature(signature, rawPayload)) {
      console.error('Invalid Paystack webhook signature');
      return false;
    }
    const payload = JSON.parse(rawPayload);
    const event = payload.event;
    // Handle different Paystack events
    switch (event) {
      case 'subscription.create':
        // New subscription created
        return await handlePaystackSubscriptionCreate(payload.data);
      case 'charge.success':
        // Successful payment
        return await handlePaystackChargeSuccess(payload.data);
      case 'subscription.disable':
        // Subscription cancelled or expired
        return await handlePaystackSubscriptionDisable(payload.data);
      console.log(`Unhandled Paystack event: ${event}`);
        return true;
    }
  }
  catch (error) {
    console.error('Error handling Paystack _webhook:', error);
    return false;
  }
}
/**
 * Handle Flutterwave webhook events
 */
async function handleFlutterwaveWebhook(signature, rawPayload) {
  try {
    // Verify the webhook signature
    if (!verifyFlutterwaveSignature(signature, rawPayload)) {
      console.error('Invalid Flutterwave webhook signature');
      return false;
    }
    const payload = JSON.parse(rawPayload);
    const event = payload.event;
    // Handle different Flutterwave events
    switch (event) {
      case 'subscription.create':
        // New subscription created
        return await handleFlutterwaveSubscriptionCreate(payload.data);
      case 'charge.completed':
        // Successful payment
        return await handleFlutterwaveChargeCompleted(payload.data);
      case 'subscription.cancelled':
        // Subscription cancelled
        return await handleFlutterwaveSubscriptionCancelled(payload.data);
      console.log(`Unhandled Flutterwave event: ${event}`);
        return true;
    }
  }
  catch (error) {
    console.error('Error handling Flutterwave _webhook:', error);
    return false;
  }
}
/**
 * Handle Paystack subscription create event
 */
async function handlePaystackSubscriptionCreate(data) {
  try {
    // Extract user and subscription details
    const userId = data.customer.metadata.user_id;
    const plan = data.plan.name.toLowerCase(); // basic, pro, enterprise
    const referralCode = data.customer.metadata.referral_code;
    const amount = parseFloat(data.amount) / 100; // Convert from kobo to naira
    const currency = data.currency;
    // If there's a referral code, apply the discount
    let discountAmount = 0;
    let discountedAmount = amount;
    if (referralCode) {
      const discountResult = await (0, affiliate_1.applyReferralDiscount)(userId, referralCode, amount, currency);
      discountAmount = discountResult.discountAmount;
      discountedAmount = discountResult.discountedAmount;
    }
    // Calculate subscription period (typically monthly or yearly)
    // Determine end date based on plan interval
    const startDate = new Date();
    const endDate = new Date();
    if (data.plan.interval === 'annually') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }
    else {
      // Default to monthly
      endDate.setMonth(endDate.getMonth() + 1);
    }
    // Create subscription record
    const subscriptionData = {
      userId,
      _planId: plan,
      _status: 'active',
      _amount: discountedAmount.toString(),
      currency,
      _referralCode: referralCode || undefined,
      _currentPeriodStart: startDate,
      _currentPeriodEnd: endDate,
      _autoRenew: true,
      _paymentMethod: 'paystack',
      _metadata: JSON.stringify({
        _paymentReference: data.reference,
        _paystackCode: data.subscription_code,
        _paystackCustomerCode: data.customer.customer_code
      })
    };
    // Use schema helper to prepare subscription data
    // This handles fields like status and updatedAt that might cause schema mismatches
    const preparedData = prepareSubscriptionData(subscriptionData);
    await db_1.db.insert(schema.subscriptions).values(preparedData);
    // Process affiliate commission if applicable
    if (referralCode) {
      await (0, affiliate_1.processAffiliateCommission)(userId, discountedAmount, currency);
    }
    return true;
  }
  catch (error) {
    console.error('Error handling Paystack subscription _create:', error);
    return false;
  }
}
/**
 * Handle Paystack charge success event
 */
async function handlePaystackChargeSuccess(data) {
  try {
    // This handles one-time payments and subscription renewals
    const metadata = data.metadata || {};
    const userId = metadata.user_id;
    // Skip if not related to a subscription
    if (!metadata.is_subscription) {
      return true;
    }
    // Check if this is a subscription renewal
    if (metadata.subscription_code) {
      // Find the subscription
      const [subscription] = await db_1.db.select()
        .from(schema.subscriptions)
        .where((0, drizzle_orm_1.eq)(schema.subscriptions.metadata, JSON.stringify({
          _paystackCode: metadata.subscription_code,
          _paystackCustomerCode: data.customer.customer_code
        })))
        .limit(1);
      if (subscription) {
        // Process the affiliate commission if this is a referred subscription
        if (subscription.referralCode) {
          await (0, affiliate_1.processAffiliateCommission)(subscription.userId, parseFloat(subscription.amount?.toString() || '0'), subscription.currency || undefined);
        }
        // Update the subscription end date
        const newEndDate = new Date(subscription.endDate || new Date());
        if (subscription.planId === 'annually') {
          newEndDate.setFullYear(newEndDate.getFullYear() + 1);
        }
        else {
          newEndDate.setMonth(newEndDate.getMonth() + 1);
        }
        await db_1.db.update(schema.subscriptions)
          .set({
            _endDate: newEndDate,
            _status: 'active',
            _updatedAt: new Date()
          })
          .where((0, drizzle_orm_1.eq)(schema.subscriptions.id, subscription.id));
      }
    }
    return true;
  }
  catch (error) {
    console.error('Error handling Paystack charge _success:', error);
    return false;
  }
}
/**
 * Handle Paystack subscription disable event
 */
async function handlePaystackSubscriptionDisable(data) {
  try {
    // Find the subscription
    const [subscription] = await db_1.db.select()
      .from(schema.subscriptions)
      .where((0, drizzle_orm_1.eq)(schema.subscriptions.metadata, JSON.stringify({
        _paystackCode: data.subscription_code,
        _paystackCustomerCode: data.customer.customer_code
      })))
      .limit(1);
    if (subscription) {
      // Update the subscription status
      await db_1.db.update(schema.subscriptions)
        .set({
          _status: 'cancelled',
          _autoRenew: false,
          _updatedAt: new Date()
        })
        .where((0, drizzle_orm_1.eq)(schema.subscriptions.id, subscription.id));
    }
    return true;
  }
  catch (error) {
    console.error('Error handling Paystack subscription _disable:', error);
    return false;
  }
}
/**
 * Handle Flutterwave subscription create event
 */
async function handleFlutterwaveSubscriptionCreate(data) {
  try {
    // Extract user and subscription details
    const userId = data.customer?.meta?.user_id;
    const plan = data.plan.toLowerCase(); // basic, pro, enterprise
    const referralCode = data.customer?.meta?.referral_code;
    const amount = parseFloat(data.amount);
    const currency = data.currency || 'NGN';
    // If there's a referral code, apply the discount
    let discountAmount = 0;
    let discountedAmount = amount;
    if (referralCode) {
      const discountResult = await (0, affiliate_1.applyReferralDiscount)(userId, referralCode, amount, currency);
      discountAmount = discountResult.discountAmount;
      discountedAmount = discountResult.discountedAmount;
    }
    // Calculate subscription period
    const startDate = new Date();
    const endDate = new Date();
    if (data.plan_interval === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }
    else {
      // Default to monthly
      endDate.setMonth(endDate.getMonth() + 1);
    }
    // Create subscription record
    const subscriptionData = {
      userId,
      _planId: plan,
      _status: 'active',
      _amount: discountedAmount.toString(),
      currency,
      _referralCode: referralCode || undefined,
      _currentPeriodStart: startDate,
      _currentPeriodEnd: endDate,
      _autoRenew: true,
      _paymentMethod: 'flutterwave',
      _metadata: JSON.stringify({
        _paymentReference: data.tx_ref,
        _flwSubscriptionId: data.id,
        _flwCustomerId: data.customer?.id
      })
    };
    // Use schema helper to prepare subscription data
    // This handles fields like status and updatedAt that might cause schema mismatches
    const preparedData = prepareSubscriptionData(subscriptionData);
    await db_1.db.insert(schema.subscriptions).values(preparedData);
    // Process affiliate commission if applicable
    if (referralCode) {
      await (0, affiliate_1.processAffiliateCommission)(userId, discountedAmount, currency);
    }
    return true;
  }
  catch (error) {
    console.error('Error handling Flutterwave subscription _create:', error);
    return false;
  }
}
/**
 * Handle Flutterwave charge completed event
 */
async function handleFlutterwaveChargeCompleted(data) {
  try {
    // Extract metadata
    const meta = data.meta || {};
    const userId = meta.user_id;
    // Skip if not related to a subscription
    if (!meta.is_subscription) {
      return true;
    }
    // Check if this is a subscription renewal
    if (meta.subscription_id) {
      // Find the subscription
      const [subscription] = await db_1.db.select()
        .from(schema.subscriptions)
        .where((0, drizzle_orm_1.eq)(schema.subscriptions.metadata, JSON.stringify({
          _flwSubscriptionId: meta.subscription_id,
          _flwCustomerId: data.customer?.id
        })))
        .limit(1);
      if (subscription) {
        // Process the affiliate commission if this is a referred subscription
        if (subscription.referralCode) {
          await (0, affiliate_1.processAffiliateCommission)(subscription.userId, parseFloat(subscription.amount?.toString() || '0'), subscription.currency || undefined);
        }
        // Update the subscription end date
        const newEndDate = new Date(subscription.endDate || new Date());
        if (subscription.planId === 'yearly') {
          newEndDate.setFullYear(newEndDate.getFullYear() + 1);
        }
        else {
          newEndDate.setMonth(newEndDate.getMonth() + 1);
        }
        await db_1.db.update(schema.subscriptions)
          .set({
            _endDate: newEndDate,
            _status: 'active',
            _updatedAt: new Date()
          })
          .where((0, drizzle_orm_1.eq)(schema.subscriptions.id, subscription.id));
      }
    }
    return true;
  }
  catch (error) {
    console.error('Error handling Flutterwave charge _completed:', error);
    return false;
  }
}
/**
 * Handle Flutterwave subscription cancelled event
 */
async function handleFlutterwaveSubscriptionCancelled(data) {
  try {
    // Find the subscription
    const [subscription] = await db_1.db.select()
      .from(schema.subscriptions)
      .where((0, drizzle_orm_1.eq)(schema.subscriptions.metadata, JSON.stringify({
        _flwSubscriptionId: data.id,
        _flwCustomerId: data.customer?.id
      })))
      .limit(1);
    if (subscription) {
      // Update the subscription status
      await db_1.db.update(schema.subscriptions)
        .set({
          _status: 'cancelled',
          _autoRenew: false,
          _updatedAt: new Date()
        })
        .where((0, drizzle_orm_1.eq)(schema.subscriptions.id, subscription.id));
    }
    return true;
  }
  catch (error) {
    console.error('Error handling Flutterwave subscription _cancelled:', error);
    return false;
  }
}
