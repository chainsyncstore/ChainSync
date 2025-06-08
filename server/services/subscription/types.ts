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
  FAILED = 'failed',
}

export enum SubscriptionPlan {
  BASIC = 'basic',
  PREMIUM = 'premium',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

export enum PaymentProvider {
  PAYSTACK = 'paystack',
  FLUTTERWAVE = 'flutterwave',
  STRIPE = 'stripe',
  MANUAL = 'manual',
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

import { AppError, ErrorCategory, ErrorCode } from '@shared/types/errors';

export const SubscriptionServiceErrors: SubscriptionServiceErrors = {
  SUBSCRIPTION_NOT_FOUND: new AppError(
    'Subscription not found',
    ErrorCategory.RESOURCE,
    ErrorCode.NOT_FOUND
  ),
  USER_NOT_FOUND: new AppError('User not found', ErrorCategory.RESOURCE, ErrorCode.USER_NOT_FOUND),
  INVALID_PLAN: new AppError(
    'Invalid subscription plan',
    ErrorCategory.VALIDATION,
    ErrorCode.INVALID_FIELD_VALUE
  ),
  PAYMENT_FAILED: new AppError(
    'Payment processing failed',
    ErrorCategory.BUSINESS,
    ErrorCode.INVALID_OPERATION
  ),
  WEBHOOK_VALIDATION_FAILED: new AppError(
    'Webhook validation failed',
    ErrorCategory.VALIDATION,
    ErrorCode.VALIDATION_FAILED
  ),
  DUPLICATE_SUBSCRIPTION: new AppError(
    'User already has an active subscription',
    ErrorCategory.BUSINESS,
    ErrorCode.DUPLICATE_ENTRY
  ),
  INVALID_STATUS_TRANSITION: new AppError(
    'Invalid subscription status transition',
    ErrorCategory.BUSINESS,
    ErrorCode.INVALID_OPERATION
  ),
  INVALID_RENEWAL: new AppError(
    'Subscription renewal failed',
    ErrorCategory.BUSINESS,
    ErrorCode.INVALID_OPERATION
  ),
  INVALID_CANCELLATION: new AppError(
    'Subscription cancellation failed',
    ErrorCategory.BUSINESS,
    ErrorCode.INVALID_OPERATION
  ),
};

export interface ISubscriptionService {
  createSubscription(params: CreateSubscriptionParams): Promise<schema.Subscription>;
  updateSubscription(
    subscriptionId: number,
    params: UpdateSubscriptionParams
  ): Promise<schema.Subscription>;
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
  validateSubscriptionAccess(
    userId: number,
    requiredPlan?: SubscriptionPlan | string
  ): Promise<boolean>;
  getSubscriptionMetrics(): Promise<{
    totalSubscriptions: number;
    activeSubscriptions: number;
    revenueThisMonth: string;
    revenueLastMonth: string;
    subscriptionsByPlan: Record<string, number>;
    churnRate: string;
  }>;
}
