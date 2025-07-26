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
exports.generateReferralCode = generateReferralCode;
exports.registerAffiliate = registerAffiliate;
exports.getAffiliateByUserId = getAffiliateByUserId;
exports.getAffiliateByCode = getAffiliateByCode;
exports.trackReferral = trackReferral;
exports.applyReferralDiscount = applyReferralDiscount;
exports.processAffiliateCommission = processAffiliateCommission;
exports.processAffiliatePayout = processAffiliatePayout;
exports.getAffiliateDashboardStats = getAffiliateDashboardStats;
exports.getAffiliateReferrals = getAffiliateReferrals;
exports.getAffiliatePayments = getAffiliatePayments;
exports.trackAffiliateClick = trackAffiliateClick;
exports.updateAffiliateBankDetails = updateAffiliateBankDetails;
const schema = __importStar(require("../../shared/schema"));
const drizzle_orm_1 = require("drizzle-orm"); // lte removed
const crypto_1 = require("crypto");
const db_1 = require("../../db");
const flutterwave_node_v3_1 = __importDefault(require("flutterwave-node-v3"));
// Initialize Flutterwave client if credentials are available
let flwClient = null;
try {
    if (process.env.FLW_PUBLIC_KEY && process.env.FLW_SECRET_KEY) {
        flwClient = new flutterwave_node_v3_1.default(process.env.FLW_PUBLIC_KEY, process.env.FLW_SECRET_KEY);
        console.log('Flutterwave client initialized successfully');
    }
    else {
        console.log('Flutterwave credentials not found. Payouts will be simulated.');
    }
}
catch (error) {
    console.error('Failed to initialize Flutterwave client:', error);
}
// Constants
const REFERRAL_COMMISSION_PERCENTAGE = 10; // 10% commission
const REFERRAL_DISCOUNT_PERCENTAGE = 10; // 10% discount
const REFERRAL_PERIOD_MONTHS = 12; // 12 months
/**
 * Generate a unique referral code for a user
 */
async function generateReferralCode(userId) {
    try {
        // Get user directly from database since storage method doesn't exist
        const [user] = await db_1.db.select().from(schema.users).where((0, drizzle_orm_1.eq)(schema.users.id, userId)).limit(1);
        if (!user) {
            throw new Error('User not found');
        }
        // Generate a base code from username or name
        const baseCode = user.name
            .replace(/[^a-zA-Z0-9]/g, '')
            .substring(0, 5)
            .toUpperCase();
        // Add random characters to ensure uniqueness
        const randomString = (0, crypto_1.randomBytes)(3).toString('hex').toUpperCase();
        const referralCode = `${baseCode}${randomString}`;
        return referralCode;
    }
    catch (error) {
        console.error('Error generating referral code:', error);
        throw error;
    }
}
/**
 * Register a user as an affiliate
 */
async function registerAffiliate(userId, bankDetails) {
    try {
        // Check if user is already an affiliate
        const existingAffiliate = await getAffiliateByUserId(userId);
        if (existingAffiliate) {
            return existingAffiliate;
        }
        const referralCode = await generateReferralCode(userId);
        const affiliateData = {
            userId,
            code: referralCode,
            totalReferrals: 0,
            totalEarnings: '0',
            pendingEarnings: '0',
            ...bankDetails,
        };
        const [newAffiliate] = await db_1.db.insert(schema.affiliates).values(affiliateData).returning();
        return newAffiliate;
    }
    catch (error) {
        console.error('Error registering affiliate:', error);
        throw error;
    }
}
/**
 * Get affiliate by user ID
 */
async function getAffiliateByUserId(userId) {
    try {
        const [affiliate] = await db_1.db
            .select()
            .from(schema.affiliates)
            .where((0, drizzle_orm_1.eq)(schema.affiliates.userId, userId))
            .limit(1);
        return affiliate || null;
    }
    catch (error) {
        console.error('Error getting affiliate by user ID:', error);
        throw error;
    }
}
/**
 * Get affiliate by referral code
 */
async function getAffiliateByCode(code) {
    try {
        const [affiliate] = await db_1.db
            .select()
            .from(schema.affiliates)
            .where((0, drizzle_orm_1.eq)(schema.affiliates.code, code))
            .limit(1);
        return affiliate || null;
    }
    catch (error) {
        console.error('Error getting affiliate by code:', error);
        throw error;
    }
}
/**
 * Track a referral when a new user signs up using a referral code
 */
async function trackReferral(referralCode, newUserId) {
    try {
        // Get the affiliate from the referral code
        const affiliate = await getAffiliateByCode(referralCode);
        if (!affiliate) {
            console.error(`No affiliate found for referral code: ${referralCode}`);
            return null;
        }
        // Create a new referral
        const referralData = {
            affiliateId: affiliate.id,
            referredUserId: newUserId,
            status: 'pending',
            discountApplied: false,
            commissionPaid: false,
            signupDate: new Date(),
        };
        const [newReferral] = await db_1.db.insert(schema.referrals).values(referralData).returning();
        // Update the affiliate's total referrals
        await db_1.db
            .update(schema.affiliates)
            .set({
            totalReferrals: (affiliate.totalReferrals ?? 0) + 1,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema.affiliates.id, affiliate.id));
        return newReferral;
    }
    catch (error) {
        console.error('Error tracking referral:', error);
        throw error;
    }
}
/**
 * Apply discount to a subscription based on referral code
 */
async function applyReferralDiscount(userId, referralCode, subscriptionAmount, currency = 'NGN') {
    try {
        // Check if the referral code is valid
        const affiliate = await getAffiliateByCode(referralCode);
        if (!affiliate) {
            return {
                discountedAmount: subscriptionAmount,
                discountAmount: 0,
            };
        }
        // Calculate the discount amount
        const discountAmount = (subscriptionAmount * REFERRAL_DISCOUNT_PERCENTAGE) / 100;
        const discountedAmount = subscriptionAmount - discountAmount;
        // Get the referral record
        const [referral] = await db_1.db
            .select()
            .from(schema.referrals)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.referrals.affiliateId, affiliate.id), (0, drizzle_orm_1.eq)(schema.referrals.referredUserId, userId)))
            .limit(1);
        if (referral) {
            // Mark the referral as active and set discount applied to true
            const activationDate = new Date();
            const expiryDate = new Date();
            expiryDate.setMonth(expiryDate.getMonth() + REFERRAL_PERIOD_MONTHS);
            await db_1.db
                .update(schema.referrals)
                .set({
                status: 'active',
                discountApplied: true,
                activationDate,
                expiryDate,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(schema.referrals.id, referral.id));
        }
        return {
            discountedAmount,
            discountAmount,
        };
    }
    catch (error) {
        console.error('Error applying referral discount:', error);
        throw error;
    }
}
/**
 * Process affiliate commission when a referred user makes a payment
 */
async function processAffiliateCommission(userId, paymentAmount, currency = 'NGN') {
    try {
        // Find the referral for this user
        const [referral] = await db_1.db
            .select()
            .from(schema.referrals)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.referrals.referredUserId, userId), (0, drizzle_orm_1.eq)(schema.referrals.status, 'active'), (0, drizzle_orm_1.gte)(schema.referrals.expiryDate, new Date())))
            .limit(1);
        if (!referral) {
            return false;
        }
        // Calculate the commission amount
        const commissionAmount = (paymentAmount * REFERRAL_COMMISSION_PERCENTAGE) / 100;
        // Update the affiliate's pending earnings
        const affiliate = await getAffiliateByCode(referral.affiliateId.toString());
        if (!affiliate) {
            return false;
        }
        const newPendingEarnings = parseFloat(affiliate.pendingEarnings?.toString() ?? '0') + commissionAmount;
        await db_1.db
            .update(schema.affiliates)
            .set({
            pendingEarnings: newPendingEarnings.toString(),
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema.affiliates.id, affiliate.id));
        return true;
    }
    catch (error) {
        console.error('Error processing affiliate commission:', error);
        throw error;
    }
}
/**
 * Process affiliate payouts for all eligible affiliates
 */
async function processAffiliatePayout(affiliateId) {
    try {
        // Build the where clause - always filter by pending earnings
        const baseQuery = (0, drizzle_orm_1.gte)(schema.affiliates.pendingEarnings, '100');
        // If affiliateId is provided, add it to the filter
        const whereClause = affiliateId
            ? (0, drizzle_orm_1.and)(baseQuery, (0, drizzle_orm_1.eq)(schema.affiliates.id, affiliateId))
            : baseQuery;
        // Get eligible affiliates
        const eligibleAffiliates = await db_1.db.select().from(schema.affiliates).where(whereClause);
        const payments = [];
        for (const affiliate of eligibleAffiliates) {
            // Skip if no payment details
            if (!affiliate.accountNumber || !affiliate.bankCode) {
                console.log(`Skipping payout for affiliate ${affiliate.id} - missing bank details`);
                continue;
            }
            const pendingAmount = parseFloat(affiliate.pendingEarnings?.toString() ?? '0');
            // Create a new payment record
            const paymentData = {
                affiliateId: affiliate.id,
                amount: pendingAmount.toString(),
                currency: 'NGN', // Default to NGN
                status: 'pending',
                paymentMethod: affiliate.paymentMethod || 'paystack',
                // createdAt and updatedAt are handled by Drizzle by default for new inserts
            };
            const [payment] = await db_1.db.insert(schema.referralPayments).values(paymentData).returning();
            // Process the payment using Flutterwave
            let paymentSuccess = false;
            let transactionReference = '';
            try {
                if (flwClient && affiliate.accountNumber && affiliate.bankCode) {
                    const payload = {
                        account_bank: affiliate.bankCode,
                        account_number: affiliate.accountNumber,
                        amount: pendingAmount,
                        narration: `ChainSync affiliate payout - ${affiliate.code}`,
                        currency: 'NGN', // Use different currency if needed
                        reference: `aff-pay-${payment.id}-${Date.now()}`,
                    };
                    const response = await flwClient.Transfer.initiate(payload);
                    if (response && response.status === 'success') {
                        paymentSuccess = true;
                        transactionReference = response.data?.reference || '';
                    }
                }
                else {
                    // Simulate successful payment for development
                    paymentSuccess = true;
                    transactionReference = `sim-pay-${payment.id}-${Date.now()}`;
                }
            }
            catch (error) {
                console.error(`Error processing payment for affiliate ${affiliate.id}:`, error);
            }
            // Update the payment record
            const updatedPayment = await db_1.db
                .update(schema.referralPayments)
                .set({
                status: paymentSuccess ? 'completed' : 'failed',
                transactionReference,
                paymentDate: paymentSuccess ? new Date() : undefined,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(schema.referralPayments.id, payment.id))
                .returning();
            if (paymentSuccess) {
                // Update the affiliate's earnings
                const totalEarnings = parseFloat(affiliate.totalEarnings?.toString() ?? '0') + pendingAmount;
                await db_1.db
                    .update(schema.affiliates)
                    .set({
                    totalEarnings: totalEarnings.toString(),
                    pendingEarnings: affiliate.pendingEarnings?.toString() ?? '0',
                    updatedAt: new Date(),
                })
                    .where((0, drizzle_orm_1.eq)(schema.affiliates.id, affiliate.id));
            }
            payments.push(updatedPayment[0]);
        }
        return payments;
    }
    catch (error) {
        console.error('Error processing affiliate payouts:', error);
        throw error;
    }
}
/**
 * Get affiliate dashboard stats
 */
async function getAffiliateDashboardStats(userId) {
    try {
        // Get the affiliate
        const affiliate = await getAffiliateByUserId(userId);
        if (!affiliate) {
            throw new Error('User is not an affiliate');
        }
        // Get referral stats
        const referrals = await db_1.db
            .select()
            .from(schema.referrals)
            .where((0, drizzle_orm_1.eq)(schema.referrals.affiliateId, affiliate.id));
        const totalReferrals = referrals.length;
        const activeReferrals = referrals.filter(r => r.status === 'active').length;
        const pendingReferrals = referrals.filter(r => r.status === 'pending').length;
        // Get latest payment
        const [lastPayment] = await db_1.db
            .select()
            .from(schema.referralPayments)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.referralPayments.affiliateId, affiliate.id), (0, drizzle_orm_1.eq)(schema.referralPayments.status, 'completed')))
            .orderBy((0, drizzle_orm_1.desc)(schema.referralPayments.paymentDate))
            .limit(1);
        return {
            affiliate,
            referrals: {
                total: totalReferrals,
                active: activeReferrals,
                pending: pendingReferrals,
            },
            earnings: {
                total: affiliate.totalEarnings?.toString() ?? '0',
                pending: affiliate.pendingEarnings?.toString() ?? '0',
                lastPayment: lastPayment
                    ? {
                        amount: lastPayment.amount.toString(),
                        date: lastPayment.paymentDate,
                    }
                    : undefined,
            },
            clicks: 0, // Would require additional tracking implementation
            conversions: activeReferrals,
        };
    }
    catch (error) {
        console.error('Error getting affiliate dashboard stats:', error);
        throw error;
    }
}
/**
 * Get all referrals for an affiliate
 */
async function getAffiliateReferrals(userId) {
    try {
        const affiliate = await getAffiliateByUserId(userId);
        if (!affiliate) {
            return [];
        }
        const referrals = await db_1.db
            .select({
            id: schema.referrals.id,
            status: schema.referrals.status,
            signupDate: schema.referrals.signupDate,
            activationDate: schema.referrals.activationDate,
            expiryDate: schema.referrals.expiryDate,
            username: schema.users.name, // Assuming 'name' is the correct field
            fullName: schema.users.name, // Assuming 'name' is the correct field
        })
            .from(schema.referrals)
            .leftJoin(schema.users, (0, drizzle_orm_1.eq)(schema.referrals.referredUserId, schema.users.id))
            .where((0, drizzle_orm_1.eq)(schema.referrals.affiliateId, affiliate.id))
            .orderBy((0, drizzle_orm_1.desc)(schema.referrals.signupDate));
        return referrals;
    }
    catch (error) {
        console.error('Error getting affiliate referrals:', error);
        throw error;
    }
}
/**
 * Get all payments for an affiliate
 */
async function getAffiliatePayments(userId) {
    try {
        const affiliate = await getAffiliateByUserId(userId);
        if (!affiliate) {
            return [];
        }
        const payments = await db_1.db
            .select()
            .from(schema.referralPayments)
            .where((0, drizzle_orm_1.eq)(schema.referralPayments.affiliateId, affiliate.id))
            .orderBy((0, drizzle_orm_1.desc)(schema.referralPayments.createdAt));
        return payments;
    }
    catch (error) {
        console.error('Error getting affiliate payments:', error);
        throw error;
    }
}
/**
 * Track a click on an affiliate link (implementation would require a separate tracking system)
 */
async function trackAffiliateClick(referralCode, source) {
    try {
        // In a production system, you'd store this in a separate clicks tracking table
        // For the MVP, we'll just log it
        console.log(`Click tracked for referral code: ${referralCode}, source: ${source || 'unknown'}`);
        return true;
    }
    catch (error) {
        console.error('Error tracking affiliate click:', error);
        return false;
    }
}
/**
 * Update affiliate bank details
 */
async function updateAffiliateBankDetails(userId, bankDetails) {
    try {
        const affiliate = await getAffiliateByUserId(userId);
        if (!affiliate) {
            return null;
        }
        const [updatedAffiliate] = await db_1.db
            .update(schema.affiliates)
            .set({
            ...bankDetails,
            paymentMethod: bankDetails.paymentMethod,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema.affiliates.id, affiliate.id))
            .returning();
        return updatedAffiliate;
    }
    catch (error) {
        console.error('Error updating affiliate bank details:', error);
        throw error;
    }
}
