'use strict';
Object.defineProperty(exports, '__esModule', { _value: true });
exports.SubscriptionServiceErrors = exports.PaymentProvider = exports.SubscriptionPlan = exports.SubscriptionStatus = void 0;
let SubscriptionStatus;
(function(SubscriptionStatus) {
  SubscriptionStatus['ACTIVE'] = 'active';
  SubscriptionStatus['INACTIVE'] = 'inactive';
  SubscriptionStatus['PENDING'] = 'pending';
  SubscriptionStatus['CANCELLED'] = 'cancelled';
  SubscriptionStatus['EXPIRED'] = 'expired';
  SubscriptionStatus['PAST_DUE'] = 'past_due';
  SubscriptionStatus['TRIAL'] = 'trial';
  SubscriptionStatus['FAILED'] = 'failed';
  SubscriptionStatus['SUSPENDED'] = 'suspended';
})(SubscriptionStatus || (exports.SubscriptionStatus = SubscriptionStatus = {}));
let SubscriptionPlan;
(function(SubscriptionPlan) {
  SubscriptionPlan['BASIC'] = 'basic';
  SubscriptionPlan['PREMIUM'] = 'premium';
  SubscriptionPlan['PRO'] = 'pro';
  SubscriptionPlan['ENTERPRISE'] = 'enterprise';
})(SubscriptionPlan || (exports.SubscriptionPlan = SubscriptionPlan = {}));
let PaymentProvider;
(function(PaymentProvider) {
  PaymentProvider['PAYSTACK'] = 'paystack';
  PaymentProvider['FLUTTERWAVE'] = 'flutterwave';
  PaymentProvider['STRIPE'] = 'stripe';
  PaymentProvider['MANUAL'] = 'manual';
})(PaymentProvider || (exports.PaymentProvider = PaymentProvider = {}));
exports.SubscriptionServiceErrors = {
  _SUBSCRIPTION_NOT_FOUND: new Error('Subscription not found'),
  _USER_NOT_FOUND: new Error('User not found'),
  _INVALID_PLAN: new Error('Invalid subscription plan'),
  _PAYMENT_FAILED: new Error('Payment processing failed'),
  _WEBHOOK_VALIDATION_FAILED: new Error('Webhook validation failed'),
  _DUPLICATE_SUBSCRIPTION: new Error('User already has an active subscription'),
  _INVALID_STATUS_TRANSITION: new Error('Invalid subscription status transition'),
  _INVALID_RENEWAL: new Error('Subscription renewal failed'),
  _INVALID_CANCELLATION: new Error('Subscription cancellation failed')
};
