/**
 * Schema Helpers
 *
 * This utility file provides helper functions to bridge mismatches between
 * code field names and the actual database schema structure.
 * These are temporary solutions to allow the application to function while
 * schema alignment is being addressed more comprehensively.
 */

import { eq, and, gt, lt, desc, sql, asc } from 'drizzle-orm';

import { NewSubscription } from './db/subscriptions.js';
import * as schema from './schema.js';

/**
 * Generic type assertion helper for database operations
 * Use this when TypeScript detects schema mismatches but you know the runtime values are correct
 */
export function assertType<T>(data: unknown): T {
  return data as T;
}

/**
 * Core Module Helpers
 */

// Users
export function prepareUserData(data: unknown) {
  // Pass through with type assertion
  return data as any;
}

// Products
export function prepareProductData(data: unknown) {
  if (typeof data !== 'object' || data === null) {
    return { sku: `SKU-${Date.now()}` } as any; // Return a default or handle error
  }
  const dataObj = data as Record<string, any>;
  // Ensure SKU exists
  const preparedData = {
    ...dataObj,
    sku: dataObj.sku || `SKU-${Date.now()}`,
  };
  return preparedData as any;
}

// Inventory
export function prepareInventoryData(data: unknown) {
  return data as any;
}

/**
 * Loyalty Module Helpers
 */

// Map field names between code and schema
export function prepareLoyaltyTierData(data: unknown) {
  if (typeof data !== 'object' || data === null) {
    return {} as any;
  }
  const dataObj = data as Record<string, any>;
  // Schema uses 'requiredPoints', code uses 'pointsRequired'
  // Schema uses 'active', code uses 'status'
  const preparedData: Record<string, any> = {
    ...dataObj,
    // Map pointsRequired to requiredPoints if it exists
    ...(dataObj.pointsRequired && { requiredPoints: dataObj.pointsRequired }),
    // Map status to active if it exists
    ...(dataObj.status && { active: dataObj.status === 'active' }),
  };

  // Remove unmapped fields to avoid conflicts
  if (preparedData.pointsRequired) delete preparedData.pointsRequired;
  if (preparedData.status) delete preparedData.status;

  return preparedData as any;
}

export function prepareLoyaltyMemberData(data: unknown) {
  if (typeof data !== 'object' || data === null) {
    return {} as any;
  }
  const dataObj = data as Record<string, any>;
  // Schema uses 'isActive', code uses 'status'
  const preparedData: Record<string, any> = {
    ...dataObj,
    ...(dataObj.status && { isActive: dataObj.status === 'active' }),
  };

  if (preparedData.status) delete preparedData.status;
  return preparedData as any;
}

/**
 * Map for loyalty reward redemption - this is missing from schema but used in code
 * This is a temporary workaround until schema is updated
 */
export function prepareLoyaltyRedemptionData(data: unknown) {
  return data as any;
}

/**
 * Subscription Module Helpers
 */
export function prepareSubscriptionData(data: {
  userId: number;
  plan: string;
  status?: string; // Made optional, function defaults to 'active'
  amount: string;
  currency?: string | null; // Made optional, function defaults to 'NGN', allow null
  referralCode?: string;
  discountApplied?: boolean; // Made optional, DB default applies if undefined
  discountAmount?: string; // Made optional, DB default applies if undefined
  startDate: Date;
  endDate: Date;
  autoRenew?: boolean; // Made optional, DB default applies if undefined
  paymentProvider?: string | null; // Made optional/nullable
  paymentReference?: string | null; // Made optional/nullable
  metadata?: any;
}): NewSubscription {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Subscription data must be an object.');
  }
  const dataObj = data as Record<string, any>;

  // Ensure required fields exist to satisfy Drizzle ORM expectations
  const requiredFields = ['userId', 'plan', 'amount', 'endDate'];
  for (const field of requiredFields) {
    if (dataObj[field] === undefined) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Construct the NewSubscription object directly with camelCase keys
  const newSubscriptionEntry: NewSubscription = {
    userId: data.userId,
    plan: data.plan,
    status: data.status || 'active', // Default if not provided
    amount: data.amount,
    currency: data.currency || 'NGN', // Default if not provided
    startDate: data.startDate,
    endDate: data.endDate,

    // Optional fields - Drizzle handles undefined for optional columns
    referralCode: data.referralCode,
    discountApplied: data.discountApplied,
    discountAmount: data.discountAmount,
    autoRenew: data.autoRenew,
    paymentProvider: data.paymentProvider,
    paymentReference: data.paymentReference,
    metadata: data.metadata,

    // id, createdAt, updatedAt are typically auto-generated or handled by DB/Drizzle defaults
    // and should not be part of NewSubscription data passed to insert typically.
  };
  return newSubscriptionEntry;
}

/**
 * Refund Module Helpers
 */

// Handle the naming discrepancy between schema.returns (in code) and refunds (in database)
export function prepareRefundData(data: unknown) {
  // The schema uses 'returns' but the code expects 'refunds'
  return data as any;
}

export function prepareRefundItemData(data: unknown) {
  // The schema uses 'returnItems' but the code expects 'refundItems'
  return data as any;
}

// Special mapping functions for refund module
export const refunds = {
  // Use the actual schema.returns for all refund operations
  ...schema.returns,
  // Add extra properties to make it compatible with code expectations
  refundAmount: schema.returns.total,
};

export const refundItems = {
  // Use the actual schema.returnItems for all refund item operations
  ...schema.returnItems,
  // Add any missing properties expected by the code
  returnReasonId: schema.returnItems.refundId,
};

// Helper function for formatting refund query results
export function formatRefundResult(refund: unknown) {
  if (!refund) return null;

  return {
    ...refund,
    // Map any additional fields if needed
  };
}

/**
 * Helper for converting query results back to expected format
 * (reverse of the prepare functions)
 */
export function formatLoyaltyTierResult(tier: unknown) {
  if (typeof tier !== 'object' || tier === null) {
    return null;
  }
  const tierObj = tier as Record<string, any>;
  return {
    ...tierObj,
    pointsRequired: tierObj.requiredPoints,
    status: tierObj.active ? 'active' : 'inactive',
  };
}

export function formatLoyaltyMemberResult(member: unknown) {
  if (typeof member !== 'object' || member === null) {
    return null;
  }
  const memberObj = member as Record<string, any>;
  return {
    ...memberObj,
    status: memberObj.isActive ? 'active' : 'inactive',
  };
}

export function formatSubscriptionResult(subscription: unknown) {
  if (typeof subscription !== 'object' || subscription === null) {
    return null;
  }
  const subObj = subscription as Record<string, any>;

  // Parse metadata if it exists and is a string
  let parsedMetadata = subObj.metadata;
  if (typeof subObj.metadata === 'string' && subObj.metadata) {
    try {
      parsedMetadata = JSON.parse(subObj.metadata);
    } catch (error: unknown) {
      console.warn('Failed to parse subscription metadata JSON:', error);
      // Keep original string if parsing fails
    }
  }

  // Map fields from snake_case to camelCase
  // Create a properly typed object that matches our service expectations
  const result = {
    id: subObj.id,
    userId: subObj.user_id,
    plan: subObj.plan,
    status: subObj.status || 'active',
    amount: subObj.amount,
    currency: subObj.currency || 'NGN',
    referralCode: subObj.referral_code,
    discountApplied: subObj.discount_applied || false,
    discountAmount: subObj.discount_amount || '0',
    startDate: subObj.start_date instanceof Date ? subObj.start_date : new Date(subObj.start_date),
    endDate: subObj.end_date instanceof Date ? subObj.end_date : new Date(subObj.end_date),
    autoRenew: subObj.auto_renew ?? true,
    paymentProvider: subObj.payment_provider || 'manual',
    paymentReference: subObj.payment_reference || null,
    metadata: parsedMetadata,
    createdAt: subObj.created_at instanceof Date ? subObj.created_at : new Date(subObj.created_at),
    updatedAt:
      subObj.updated_at instanceof Date
        ? subObj.updated_at
        : subObj.updated_at
          ? new Date(subObj.updated_at)
          : new Date(subObj.created_at),
  };

  // Add user information if available
  if (subObj.user) {
    const userObj = subObj.user as Record<string, any>;
    return {
      ...result,
      user: {
        id: userObj.id,
        name: userObj.name,
        email: userObj.email,
      },
    };
  }

  return result;
}
