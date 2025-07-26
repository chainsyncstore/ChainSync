"use strict";
/**
 * Schema Helpers
 *
 * This utility file provides helper functions to bridge mismatches between
 * code field names and the actual database schema structure.
 * These are temporary solutions to allow the application to function while
 * schema alignment is being addressed more comprehensively.
 */
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.refundItems = exports.refunds = void 0;
exports.assertType = assertType;
exports.prepareUserData = prepareUserData;
exports.prepareProductData = prepareProductData;
exports.prepareInventoryData = prepareInventoryData;
exports.prepareLoyaltyTierData = prepareLoyaltyTierData;
exports.prepareLoyaltyMemberData = prepareLoyaltyMemberData;
exports.prepareLoyaltyRedemptionData = prepareLoyaltyRedemptionData;
exports.prepareSubscriptionData = prepareSubscriptionData;
exports.prepareRefundData = prepareRefundData;
exports.prepareRefundItemData = prepareRefundItemData;
exports.formatRefundResult = formatRefundResult;
exports.formatLoyaltyTierResult = formatLoyaltyTierResult;
exports.formatLoyaltyMemberResult = formatLoyaltyMemberResult;
exports.formatSubscriptionResult = formatSubscriptionResult;
const schema = __importStar(require("./schema"));
/**
 * Generic type assertion helper for database operations
 * Use this when TypeScript detects schema mismatches but you know the runtime values are correct
 */
function assertType(data) {
    return data;
}
/**
 * Core Module Helpers
 */
// Users
function prepareUserData(data) {
    // Pass through with type assertion
    return data;
}
// Products
function prepareProductData(data) {
    // Ensure SKU exists
    const preparedData = {
        ...data,
        sku: data.sku || `SKU-${Date.now()}`
    };
    return preparedData;
}
// Inventory
function prepareInventoryData(data) {
    return data;
}
/**
 * Loyalty Module Helpers
 */
// Map field names between code and schema
function prepareLoyaltyTierData(data) {
    // Schema uses 'requiredPoints', code uses 'pointsRequired'
    // Schema uses 'active', code uses 'status'
    const preparedData = {
        ...data,
        // Map pointsRequired to requiredPoints if it exists
        ...(data.pointsRequired && { requiredPoints: data.pointsRequired }),
        // Map status to active if it exists
        ...(data.status && { active: data.status === 'active' })
    };
    // Remove unmapped fields to avoid conflicts
    if (preparedData.pointsRequired)
        delete preparedData.pointsRequired;
    if (preparedData.status)
        delete preparedData.status;
    return preparedData;
}
function prepareLoyaltyMemberData(data) {
    // Schema uses 'isActive', code uses 'status'
    const preparedData = {
        ...data,
        ...(data.status && { isActive: data.status === 'active' })
    };
    if (preparedData.status)
        delete preparedData.status;
    return preparedData;
}
/**
 * Map for loyalty reward redemption - this is missing from schema but used in code
 * This is a temporary workaround until schema is updated
 */
function prepareLoyaltyRedemptionData(data) {
    return data;
}
/**
 * Subscription Module Helpers
 */
function prepareSubscriptionData(data) {
    // Ensure required fields exist to satisfy Drizzle ORM expectations
    const requiredFields = ['userId', 'plan', 'amount', 'endDate'];
    for (const field of requiredFields) {
        if (data[field] === undefined) {
            throw new Error(`Missing required field: ${field}`);
        }
    }
    // Create a base object with minimal required fields
    const baseData = {
        user_id: data.userId,
        plan: data.plan,
        amount: data.amount,
        end_date: data.endDate
    };
    // Build the full prepared data object with all fields
    const preparedData = {
        ...baseData,
        // Optional fields with defaults
        status: data.status || 'active',
        currency: data.currency || 'NGN',
        auto_renew: data.autoRenew ?? true,
        payment_provider: data.paymentProvider || 'paystack',
        // Optional fields without defaults
        referral_code: data.referralCode,
        discount_applied: data.discountApplied,
        discount_amount: data.discountAmount,
        start_date: data.startDate,
        payment_reference: data.paymentReference,
        metadata: data.metadata,
        created_at: data.createdAt,
        updated_at: data.updatedAt
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
function prepareRefundData(data) {
    // The schema uses 'returns' but the code expects 'refunds'
    return data;
}
function prepareRefundItemData(data) {
    // The schema uses 'returnItems' but the code expects 'refundItems'
    return data;
}
// Special mapping functions for refund module
exports.refunds = {
    // Use the actual schema.returns for all refund operations
    ...schema.returns,
    // Add extra properties to make it compatible with code expectations
    refundAmount: schema.returns.total,
};
exports.refundItems = {
    // Use the actual schema.returnItems for all refund item operations
    ...schema.returnItems,
    // Add any missing properties expected by the code
    returnReasonId: schema.returnItems.returnId,
};
// Helper function for formatting refund query results
function formatRefundResult(refund) {
    if (!refund)
        return null;
    return {
        ...refund,
        // Map any additional fields if needed
    };
}
/**
 * Helper for converting query results back to expected format
 * (reverse of the prepare functions)
 */
function formatLoyaltyTierResult(tier) {
    if (!tier)
        return null;
    return {
        ...tier,
        pointsRequired: tier.requiredPoints,
        status: tier.active ? 'active' : 'inactive'
    };
}
function formatLoyaltyMemberResult(member) {
    if (!member)
        return null;
    return {
        ...member,
        status: member.isActive ? 'active' : 'inactive'
    };
}
function formatSubscriptionResult(subscription) {
    if (!subscription)
        return null;
    // Parse metadata if it exists and is a string
    let parsedMetadata = subscription.metadata;
    if (typeof subscription.metadata === 'string' && subscription.metadata) {
        try {
            parsedMetadata = JSON.parse(subscription.metadata);
        }
        catch (error) {
            console.warn('Failed to parse subscription metadata JSON:', error);
            // Keep original string if parsing fails
        }
    }
    // Map fields from snake_case to camelCase
    // Create a properly typed object that matches our service expectations
    const result = {
        id: subscription.id,
        userId: subscription.user_id,
        plan: subscription.plan,
        status: subscription.status || 'active',
        amount: subscription.amount,
        currency: subscription.currency || 'NGN',
        referralCode: subscription.referral_code,
        discountApplied: subscription.discount_applied || false,
        discountAmount: subscription.discount_amount || '0',
        startDate: subscription.start_date instanceof Date ? subscription.start_date : new Date(subscription.start_date),
        endDate: subscription.end_date instanceof Date ? subscription.end_date : new Date(subscription.end_date),
        autoRenew: subscription.auto_renew ?? true,
        paymentProvider: subscription.payment_provider || 'manual',
        paymentReference: subscription.payment_reference || null,
        metadata: parsedMetadata,
        createdAt: subscription.created_at instanceof Date ? subscription.created_at : new Date(subscription.created_at),
        updatedAt: subscription.updated_at instanceof Date ?
            subscription.updated_at :
            (subscription.updated_at ? new Date(subscription.updated_at) : new Date(subscription.created_at))
    };
    // Add user information if available
    if (subscription.user) {
        return {
            ...result,
            user: {
                id: subscription.user.id,
                name: subscription.user.name,
                email: subscription.user.email
            }
        };
    }
    return result;
}
