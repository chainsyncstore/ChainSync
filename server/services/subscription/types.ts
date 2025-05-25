/**
 * Subscription Service Types
 * 
 * This file defines the interfaces and types for the subscription service,
 * ensuring proper standardization between code and database schema.
 */

import * as schema from '@shared/schema';

export type Subscription = schema.Subscription;

export enum SubscriptionStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  PAST_DUE = 'past_due',
  TRIAL = 'trial',
  FAILED = 'failed'
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
  userId: number;
  plan: SubscriptionPlan | string;
  amount: string;
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
  provider: PaymentProvider;
  event: string;
  data: Record<string, unknown>;
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
  SUBSCRIPTION_NOT_FOUND: Error;
  USER_NOT_FOUND: Error;
  INVALID_PLAN: Error;
  PAYMENT_FAILED: Error;
  WEBHOOK_VALIDATION_FAILED: Error;
  DUPLICATE_SUBSCRIPTION: Error;
  INVALID_STATUS_TRANSITION: Error;
  INVALID_RENEWAL: Error;
  INVALID_CANCELLATION: Error;
}

export const SubscriptionServiceErrors: SubscriptionServiceErrors = {
  SUBSCRIPTION_NOT_FOUND: new Error("Subscription not found"),
  USER_NOT_FOUND: new Error("User not found"),
  INVALID_PLAN: new Error("Invalid subscription plan"),
  PAYMENT_FAILED: new Error("Payment processing failed"),
  WEBHOOK_VALIDATION_FAILED: new Error("Webhook validation failed"),
  DUPLICATE_SUBSCRIPTION: new Error("User already has an active subscription"),
  INVALID_STATUS_TRANSITION: new Error("Invalid subscription status transition"),
  INVALID_RENEWAL: new Error("Subscription renewal failed"),
  INVALID_CANCELLATION: new Error("Subscription cancellation failed")
};

export interface ISubscriptionService {
  createSubscription(params: CreateSubscriptionParams): Promise<schema.Subscription>;
  updateSubscription(subscriptionId: number, params: UpdateSubscriptionParams): Promise<schema.Subscription>;
  getSubscriptionById(subscriptionId: number): Promise<schema.Subscription | null>;
  getSubscriptionByUser(userId: number): Promise<schema.Subscription | null>;
  getActiveSubscription(userId: number): Promise<schema.Subscription | null>;
  searchSubscriptions(params: SubscriptionSearchParams): Promise<{
    subscriptions: schema.Subscription[];
    total: number;
    page: number;
    limit: number;
  }>;
  cancelSubscription(subscriptionId: number, reason?: string): Promise<schema.Subscription>;
  renewSubscription(subscriptionId: number): Promise<schema.Subscription>;
  processWebhook(params: ProcessWebhookParams): Promise<boolean>;
  validateSubscriptionAccess(userId: number, requiredPlan?: SubscriptionPlan | string): Promise<boolean>;
  getSubscriptionMetrics(): Promise<{
    totalSubscriptions: number;
    activeSubscriptions: number;
    revenueThisMonth: string;
    revenueLastMonth: string;
    subscriptionsByPlan: Record<string, number>;
    churnRate: string;
  }>;
}
