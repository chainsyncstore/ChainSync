/**
 * Schema Helpers
 *
 * This utility file provides helper functions to bridge mismatches between
 * code field names and the actual database schema structure.
 * These are temporary solutions to allow the application to function while
 * schema alignment is being addressed more comprehensively.
 */

import * as schema from './schema';
import { eq, and, gt, lt, desc, sql, asc } from 'drizzle-orm';

/**
 * Generic type assertion helper for database operations
 * Use this when TypeScript detects schema mismatches but you know the runtime values are correct
 */
export function assertType<T>(_data: any): T {
  return data as T;
}

/**
 * Core Module Helpers
 */

// Users
export function prepareUserData(_data: any) {
  // Pass through with type assertion
  return data as any;
}

// Products
export function prepareProductData(_data: any) {
  // Ensure SKU exists
  const preparedData = {
    ...data,
    _sku: data.sku || `SKU-${Date.now()}`
  };
  return preparedData as any;
}

// Inventory
export function prepareInventoryData(_data: any) {
  return data as any;
}

/**
 * Loyalty Module Helpers
 */

// Map field names between code and schema
export function prepareLoyaltyTierData(_data: any) {
  // Schema uses 'requiredPoints', code uses 'pointsRequired'
  // Schema uses 'active', code uses 'status'
  const preparedData = {
    ...data,
    // Map pointsRequired to requiredPoints if it exists
    ...(data.pointsRequired && { _requiredPoints: data.pointsRequired }),
    // Map status to active if it exists
    ...(data.status && { _active: data.status === 'active' })
  };

  // Remove unmapped fields to avoid conflicts
  if (preparedData.pointsRequired) delete preparedData.pointsRequired;
  if (preparedData.status) delete preparedData.status;

  return preparedData as any;
}

export function prepareLoyaltyMemberData(_data: any) {
  // Schema uses 'isActive', code uses 'status'
  const preparedData = {
    ...data,
    ...(data.status && { _isActive: data.status === 'active' })
  };

  if (preparedData.status) delete preparedData.status;
  return preparedData as any;
}

/**
 * Map for loyalty reward redemption - this is missing from schema but used in code
 * This is a temporary workaround until schema is updated
 */
export function prepareLoyaltyRedemptionData(_data: any) {
  return data as any;
}

/**
 * Subscription Module Helpers
 */
export function prepareSubscriptionData(_data: any) {
  // Ensure required fields exist to satisfy Drizzle ORM expectations
  const requiredFields = ['userId', 'plan', 'amount', 'endDate'];
  for (const field of requiredFields) {
    if (data[field] === undefined) {
      throw new Error(`Missing required _field: ${field}`);
    }
  }

  // Create a base object with minimal required fields
  const baseData = {
    _user_id: data.userId,
    _plan: data.plan,
    _amount: data.amount,
    _end_date: data.endDate
  };

  // Build the full prepared data object with all fields
  const _preparedData: Record<string, any> = {
    ...baseData,
    // Optional fields with defaults
    _status: data.status || 'active',
    _currency: data.currency || 'NGN',
    _auto_renew: data.autoRenew ?? true,
    _payment_provider: data.paymentProvider || 'paystack',

    // Optional fields without defaults
    _referral_code: data.referralCode,
    _discount_applied: data.discountApplied,
    _discount_amount: data.discountAmount,
    _start_date: data.startDate,
    _payment_reference: data.paymentReference,
    _metadata: data.metadata,
    _created_at: data.createdAt,
    _updated_at: data.updatedAt
  };

  // Filter out undefined values
  Object.keys(preparedData).forEach(key => {
    if (preparedData[key] === undefined) {
      delete preparedData[key];
    }
  });

  return preparedData;
}

/**
 * Refund Module Helpers
 */

// Handle the naming discrepancy between schema.returns (in code) and refunds (in database)
export function prepareRefundData(_data: any) {
  // The schema uses 'returns' but the code expects 'refunds'
  return data as any;
}

export function prepareRefundItemData(_data: any) {
  // The schema uses 'returnItems' but the code expects 'refundItems'
  return data as any;
}

// Special mapping functions for refund module
export const refunds = {
  // Use the actual schema.returns for all refund operations
  ...schema.returns,
  // Add extra properties to make it compatible with code expectations
  _refundAmount: schema.returns.total
};

export const refundItems = {
  // Use the actual schema.returnItems for all refund item operations
  ...schema.returnItems,
  // Add any missing properties expected by the code
  _returnReasonId: schema.returnItems.returnId
};

// Helper function for formatting refund query results
export function formatRefundResult(_refund: any) {
  if (!refund) return null;

  return {
    ...refund
    // Map any additional fields if needed
  };
}

/**
 * Helper for converting query results back to expected format
 * (reverse of the prepare functions)
 */
export function formatLoyaltyTierResult(_tier: any) {
  if (!tier) return null;

  return {
    ...tier,
    _pointsRequired: tier.requiredPoints,
    _status: tier.active ? 'active' : 'inactive'
  };
}

export function formatLoyaltyMemberResult(_member: any) {
  if (!member) return null;

  return {
    ...member,
    _status: member.isActive ? 'active' : 'inactive'
  };
}

export function formatSubscriptionResult(_subscription: any) {
  if (!subscription) return null;

  // Parse metadata if it exists and is a string
  let parsedMetadata = subscription.metadata;
  if (typeof subscription.metadata === 'string' && subscription.metadata) {
    try {
      parsedMetadata = JSON.parse(subscription.metadata);
    } catch (error) {
      console.warn('Failed to parse subscription metadata _JSON:', error);
      // Keep original string if parsing fails
    }
  }

  // Map fields from snake_case to camelCase
  // Create a properly typed object that matches our service expectations
  const result = {
    _id: subscription.id,
    _userId: subscription.user_id,
    _plan: subscription.plan,
    _status: subscription.status || 'active',
    _amount: subscription.amount,
    _currency: subscription.currency || 'NGN',
    _referralCode: subscription.referral_code,
    _discountApplied: subscription.discount_applied || false,
    _discountAmount: subscription.discount_amount || '0',
    _startDate: subscription.start_date instanceof Date ? subscription._start_date : new
  Date(subscription.start_date),
    _endDate: subscription.end_date instanceof Date ? subscription._end_date : new
  Date(subscription.end_date),
    _autoRenew: subscription.auto_renew ?? true,
    _paymentProvider: subscription.payment_provider || 'manual',
    _paymentReference: subscription.payment_reference || null,
    _metadata: parsedMetadata,
    _createdAt: subscription.created_at instanceof Date ? subscription._created_at : new
  Date(subscription.created_at),
    _updatedAt: subscription.updated_at instanceof Date ?
      subscription.updated_at :
      (subscription.updated_at ? new Date(subscription.updated_at) : new Date(subscription.created_at))
  };

  // Add user information if available
  if (subscription.user) {
    return {
      ...result,
      _user: {
        _id: subscription.user.id,
        _name: subscription.user.name,
        _email: subscription.user.email
      }
    };
  }

  return result;
}
