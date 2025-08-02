import { subscriptions } from '@shared/schema';
import { InferSelectModel } from 'drizzle-orm';

export type SelectSubscription = InferSelectModel<typeof subscriptions>;

export enum SubscriptionStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  PAST_DUE = 'past_due',
  TRIAL = 'trial',
  FAILED = 'failed',
  SUSPENDED = 'suspended'
}

export enum SubscriptionPlan {
  BASIC = 'basic',
  PREMIUM = 'premium',
  PRO = 'pro',
  ENTERPRISE = 'enterprise'
}

export enum PaymentProvider {
  PAYSTACK = 'paystack',
  FLUTTERWAVE = 'flutterwave',
  STRIPE = 'stripe',
  MANUAL = 'manual'
}

export interface CreateSubscriptionParams {
  _userId: number;
  _plan: SubscriptionPlan | string;
  _amount: string;
  currency?: string;
  provider?: PaymentProvider;
  providerReference?: string;
  startDate?: Date;
  endDate?: Date;
  autoRenew?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdateSubscriptionParams {
  plan?: SubscriptionPlan | string;
  status?: SubscriptionStatus;
  amount?: string;
  currency?: string;
  endDate?: Date;
  autoRenew?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ProcessWebhookParams {
  _provider: PaymentProvider;
  _event: string;
  _data: Record<string, unknown>;
  reference?: string;
}

export interface SubscriptionSearchParams {
  userId?: number;
  plan?: SubscriptionPlan | string;
  status?: SubscriptionStatus;
  startDate?: Date;
  endDate?: Date;
  provider?: PaymentProvider;
  page?: number;
  limit?: number;
}

export interface SubscriptionServiceErrors {
  _SUBSCRIPTION_NOT_FOUND: Error;
  _USER_NOT_FOUND: Error;
  _INVALID_PLAN: Error;
  _PAYMENT_FAILED: Error;
  _WEBHOOK_VALIDATION_FAILED: Error;
  _DUPLICATE_SUBSCRIPTION: Error;
  _INVALID_STATUS_TRANSITION: Error;
  _INVALID_RENEWAL: Error;
  _INVALID_CANCELLATION: Error;
}

export const _SubscriptionServiceErrors: SubscriptionServiceErrors = {
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

export interface ISubscriptionService {
  createSubscription(_params: CreateSubscriptionParams): Promise<SelectSubscription>;
  updateSubscription(_subscriptionId: number, _params: UpdateSubscriptionParams): Promise<SelectSubscription>;
  getSubscriptionById(_subscriptionId: number): Promise<SelectSubscription | null>;
  getSubscriptionByUser(_userId: number): Promise<SelectSubscription | null>;
  getActiveSubscription(_userId: number): Promise<SelectSubscription | null>;
  searchSubscriptions(_params: SubscriptionSearchParams): Promise<{
    _subscriptions: SelectSubscription[];
    _total: number;
    _page: number;
    _limit: number;
  }>;
  cancelSubscription(_subscriptionId: number, reason?: string): Promise<SelectSubscription>;
  renewSubscription(_subscriptionId: number): Promise<SelectSubscription>;
  processWebhook(_params: ProcessWebhookParams): Promise<boolean>;
  validateSubscriptionAccess(_userId: number, requiredPlan?: SubscriptionPlan | string): Promise<boolean>;
  getSubscriptionMetrics(): Promise<{
    _totalSubscriptions: number;
    _activeSubscriptions: number;
    _revenueThisMonth: string;
    _revenueLastMonth: string;
    _subscriptionsByPlan: Record<string, number>;
    _churnRate: string;
  }>;
}
