import { storage } from "../storage";
import * as schema from "@shared/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { AppError, ErrorCode, ErrorCategory } from '../../shared/types/errors';
import { randomBytes } from "crypto";
import { db } from "../../db";
import Flutterwave from "flutterwave-node-v3";

// Initialize Flutterwave client if credentials are available
let flwClient: unknown = null;
try {
  if (process.env.FLW_PUBLIC_KEY && process.env.FLW_SECRET_KEY) {
    flwClient = new Flutterwave(process.env.FLW_PUBLIC_KEY, process.env.FLW_SECRET_KEY);
    console.log("Flutterwave client initialized successfully");
  } else {
    console.log("Flutterwave credentials not found. Payouts will be simulated.");
  }
} catch (error: unknown) {
  console.error("Failed to initialize Flutterwave client:", error);
}

// Constants
const REFERRAL_COMMISSION_PERCENTAGE = 10; // 10% commission
const REFERRAL_DISCOUNT_PERCENTAGE = 10; // 10% discount
const REFERRAL_PERIOD_MONTHS = 12; // 12 months

/**
 * Generate a unique referral code for a user
 */
export async function generateReferralCode(userId: number): Promise<string> {
  try {
    const user = await storage.getUserById(userId);
    if (!user) {
      // Consider throwing an AppError here for consistency if this case is expected
      throw new AppError("User not found", ErrorCategory.RESOURCE, ErrorCode.USER_NOT_FOUND);
    }

    // Generate a base code from username or name
    const baseCode = user.username.replace(/[^a-zA-Z0-9]/g, "").substring(0, 5).toUpperCase();
    
    // Add random characters to ensure uniqueness
    const randomString = randomBytes(3).toString("hex").toUpperCase();
    const referralCode = `${baseCode}${randomString}`;
    
    return referralCode;
  } catch (error: unknown) {
    console.error("Error generating referral code:", error);
    throw error instanceof AppError ? error : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

/**
 * Register a user as an affiliate
 */
export async function registerAffiliate(userId: number, bankDetails?: unknown): Promise<schema.Affiliate> {
  try {
    // Check if user is already an affiliate
    const existingAffiliate = await getAffiliateByUserId(userId);
    if (existingAffiliate) {
      return existingAffiliate;
    }

    const referralCode = await generateReferralCode(userId); // This already throws AppError if user not found
    
    const affiliateData: schema.AffiliateInsert = {
      userId,
      code: referralCode,
      totalReferrals: 0,
      totalEarnings: "0",
      pendingEarnings: "0",
      ...bankDetails
    };
    
    const [newAffiliate] = await db.insert(schema.affiliates).values(affiliateData).returning();
    
    return newAffiliate;
  } catch (error: unknown) {
    console.error("Error registering affiliate:", error);
    throw error instanceof AppError ? error : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

/**
 * Get affiliate by user ID
 */
export async function getAffiliateByUserId(userId: number): Promise<schema.Affiliate | null> {
  try {
    const [affiliate] = await db.select().from(schema.affiliates).where(eq(schema.affiliates.userId, userId)).limit(1);
    return affiliate || null;
  } catch (error: unknown) {
    console.error("Error getting affiliate by user ID:", error);
    throw error instanceof AppError ? error : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

/**
 * Get affiliate by referral code
 */
export async function getAffiliateByCode(code: string): Promise<schema.Affiliate | null> {
  try {
    const [affiliate] = await db.select().from(schema.affiliates).where(eq(schema.affiliates.code, code)).limit(1);
    return affiliate || null;
  } catch (error: unknown) {
    console.error("Error getting affiliate by code:", error);
    throw error instanceof AppError ? error : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

/**
 * Track a referral when a new user signs up using a referral code
 */
export async function trackReferral(referralCode: string, newUserId: number): Promise<schema.Referral | null> {
  try {
    // Get the affiliate from the referral code
    const affiliate = await getAffiliateByCode(referralCode);
    if (!affiliate) {
      // This case might not need an error throw if it's an expected outcome (e.g., invalid code entered)
      // but logging is good. If an error is desired:
      // throw new AppError(`Affiliate not found for code: ${referralCode}`, ErrorCategory.VALIDATION, ErrorCode.NOT_FOUND);
      console.error(`No affiliate found for referral code: ${referralCode}`);
      return null;
    }
    
    // Create a new referral
    const referralData: schema.ReferralInsert = {
      affiliateId: affiliate.id,
      referredUserId: newUserId,
      status: "pending",
      discountApplied: false,
      commissionPaid: false,
      signupDate: new Date()
    };
    
    const [newReferral] = await db.insert(schema.referrals).values(referralData).returning();
    
    // Update the affiliate's total referrals
    await db.update(schema.affiliates)
      .set({ 
        totalReferrals: affiliate.totalReferrals + 1,
        updatedAt: new Date()
      })
      .where(eq(schema.affiliates.id, affiliate.id));
    
    return newReferral;
  } catch (error: unknown) {
    console.error("Error tracking referral:", error);
    throw error instanceof AppError ? error : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

/**
 * Apply discount to a subscription based on referral code
 */
export async function applyReferralDiscount(userId: number, referralCode: string, subscriptionAmount: number, currency: string = "NGN"): Promise<{ 
  discountedAmount: number, 
  discountAmount: number 
}> {
  try {
    // Check if the referral code is valid
    const affiliate = await getAffiliateByCode(referralCode);
    if (!affiliate) {
      // Similar to above, this might be an expected outcome (invalid code)
      // rather than an error to throw.
      console.warn(`Referral discount attempted with invalid code: ${referralCode}`);
      return { 
        discountedAmount: subscriptionAmount, 
        discountAmount: 0 
      };
    }
    
    // Calculate the discount amount
    const discountAmount = (subscriptionAmount * REFERRAL_DISCOUNT_PERCENTAGE) / 100;
    const discountedAmount = subscriptionAmount - discountAmount;
    
    // Get the referral record
    const [referral] = await db.select()
      .from(schema.referrals)
      .where(
        and(
          eq(schema.referrals.affiliateId, affiliate.id),
          eq(schema.referrals.referredUserId, userId)
        )
      )
      .limit(1);
    
    if (referral) {
      // Mark the referral as active and set discount applied to true
      const activationDate = new Date();
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + REFERRAL_PERIOD_MONTHS);
      
      await db.update(schema.referrals)
        .set({ 
          status: "active",
          discountApplied: true,
          activationDate,
          expiryDate,
          updatedAt: new Date()
        })
        .where(eq(schema.referrals.id, referral.id));
    }
    
    return { 
      discountedAmount, 
      discountAmount 
    };
  } catch (error: unknown) {
    console.error("Error applying referral discount:", error);
    throw error instanceof AppError ? error : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

/**
 * Process affiliate commission when a referred user makes a payment
 */
export async function processAffiliateCommission(userId: number, paymentAmount: number, currency: string = "NGN"): Promise<boolean> {
  try {
    // Find the referral for this user
    const [referral] = await db.select()
      .from(schema.referrals)
      .where(
        and(
          eq(schema.referrals.referredUserId, userId),
          eq(schema.referrals.status, "active"),
          gte(schema.referrals.expiryDate, new Date())
        )
      )
      .limit(1);
    
    if (!referral) {
      // Expected outcome if user wasn't referred or referral expired/inactive
      return false;
    }
    
    // Calculate the commission amount
    const commissionAmount = (paymentAmount * REFERRAL_COMMISSION_PERCENTAGE) / 100;
    
    // Update the affiliate's pending earnings
    const affiliate = await getAffiliateByCode(referral.affiliateId.toString());
    if (!affiliate) {
      // This would be an internal inconsistency if referral exists but affiliate doesn't
      throw new AppError(`Affiliate not found for referral ID: ${referral.affiliateId}`, ErrorCategory.SYSTEM, ErrorCode.INTERNAL_SERVER_ERROR);
    }
    
    const newPendingEarnings = parseFloat(affiliate.pendingEarnings.toString()) + commissionAmount;
    await db.update(schema.affiliates)
      .set({ 
        pendingEarnings: newPendingEarnings.toString(),
        updatedAt: new Date()
      })
      .where(eq(schema.affiliates.id, affiliate.id));
    
    return true;
  } catch (error: unknown) {
    console.error("Error processing affiliate commission:", error);
    throw error instanceof AppError ? error : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

/**
 * Process affiliate payouts for all eligible affiliates
 */
export async function processAffiliatePayout(affiliateId?: number): Promise<schema.ReferralPayment[]> {
  try {
    // Build the where clause - always filter by pending earnings
    const baseQuery = gte(schema.affiliates.pendingEarnings, "100");
    
    // If affiliateId is provided, add it to the filter
    const whereClause = affiliateId 
      ? and(baseQuery, eq(schema.affiliates.id, affiliateId)) 
      : baseQuery;
    
    // Get eligible affiliates
    const eligibleAffiliates = await db.select()
      .from(schema.affiliates)
      .where(whereClause);
    
    const payments: schema.ReferralPayment[] = [];
    
    for (const affiliate of eligibleAffiliates) {
      // Skip if no payment details
      if (!affiliate.accountNumber || !affiliate.bankCode) {
        console.log(`Skipping payout for affiliate ${affiliate.id} - missing bank details`);
        continue;
      }
      
      const pendingAmount = parseFloat(affiliate.pendingEarnings.toString());
      
      // Create a new payment record
      const paymentData: schema.ReferralPaymentInsert = {
        affiliateId: affiliate.id,
        amount: pendingAmount.toString(),
        currency: "NGN", // Default to NGN
        status: "pending",
        paymentMethod: affiliate.paymentMethod || "paystack",
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const [payment] = await db.insert(schema.referralPayments).values(paymentData).returning();
      
      // Process the payment using Flutterwave
      let paymentSuccess = false;
      let transactionReference = "";
      
      try {
        if (flwClient && affiliate.accountNumber && affiliate.bankCode) {
          const payload = {
            account_bank: affiliate.bankCode,
            account_number: affiliate.accountNumber,
            amount: pendingAmount,
            narration: `ChainSync affiliate payout - ${affiliate.code}`,
            currency: "NGN", // Use different currency if needed
            reference: `aff-pay-${payment.id}-${Date.now()}`
          };
          
          const response = await flwClient.Transfer.initiate(payload);
          
          if (response && response.status === "success") {
            paymentSuccess = true;
            transactionReference = response.data?.reference || "";
          }
        } else {
          // Simulate successful payment for development
          paymentSuccess = true;
          transactionReference = `sim-pay-${payment.id}-${Date.now()}`;
        }
      } catch (error: unknown) {
        console.error(`Error processing payment for affiliate ${affiliate.id}:`, error);
      }
      
      // Update the payment record
      const updatedPayment = await db.update(schema.referralPayments)
        .set({ 
          status: paymentSuccess ? "completed" : "failed",
          transactionReference,
          paymentDate: paymentSuccess ? new Date() : undefined,
          updatedAt: new Date()
        })
        .where(eq(schema.referralPayments.id, payment.id))
        .returning();
      
      if (paymentSuccess) {
        // Update the affiliate's earnings
        const totalEarnings = parseFloat(affiliate.totalEarnings.toString()) + pendingAmount;
        await db.update(schema.affiliates)
          .set({ 
            totalEarnings: totalEarnings.toString(),
            pendingEarnings: "0",
            updatedAt: new Date()
          })
          .where(eq(schema.affiliates.id, affiliate.id));
      }
      
      payments.push(updatedPayment[0]);
    }
    
    return payments;
  } catch (error: unknown) {
    console.error("Error processing affiliate payouts:", error);
    throw error instanceof AppError ? error : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

/**
 * Get affiliate dashboard stats
 */
export async function getAffiliateDashboardStats(userId: number): Promise<{
  affiliate: schema.Affiliate;
  referrals: {
    total: number;
    active: number;
    pending: number;
  };
  earnings: {
    total: string;
    pending: string;
    lastPayment?: {
      amount: string;
      date: Date;
    };
  };
  clicks: number; // This would require additional tracking
  conversions: number;
}> {
  try {
    // Get the affiliate
    const affiliate = await getAffiliateByUserId(userId);
    if (!affiliate) {
      throw new AppError("User is not an affiliate", ErrorCategory.VALIDATION, ErrorCode.USER_NOT_FOUND);
    }
    
    // Get referral stats
    const referrals = await db.select()
      .from(schema.referrals)
      .where(eq(schema.referrals.affiliateId, affiliate.id));
    
    const totalReferrals = referrals.length;
    const activeReferrals = referrals.filter(r => r.status === "active").length;
    const pendingReferrals = referrals.filter(r => r.status === "pending").length;
    
    // Get latest payment
    const [lastPayment] = await db.select()
      .from(schema.referralPayments)
      .where(
        and(
          eq(schema.referralPayments.affiliateId, affiliate.id),
          eq(schema.referralPayments.status, "completed")
        )
      )
      .orderBy(desc(schema.referralPayments.paymentDate))
      .limit(1);
    
    return {
      affiliate,
      referrals: {
        total: totalReferrals,
        active: activeReferrals,
        pending: pendingReferrals
      },
      earnings: {
        total: affiliate.totalEarnings.toString(),
        pending: affiliate.pendingEarnings.toString(),
        lastPayment: lastPayment ? {
          amount: lastPayment.amount.toString(),
          date: lastPayment.paymentDate!
        } : undefined
      },
      clicks: 0, // Would require additional tracking implementation
      conversions: activeReferrals
    };
  } catch (error: unknown) {
    console.error("Error getting affiliate dashboard stats:", error);
    throw error instanceof AppError ? error : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

/**
 * Get all referrals for an affiliate
 */
export async function getAffiliateReferrals(userId: number): Promise<any[]> {
  try {
    const affiliate = await getAffiliateByUserId(userId);
    if (!affiliate) {
      return [];
    }
    
    const referrals = await db.select({
      id: schema.referrals.id,
      status: schema.referrals.status,
      signupDate: schema.referrals.signupDate,
      activationDate: schema.referrals.activationDate,
      expiryDate: schema.referrals.expiryDate,
      username: schema.users.username,
      fullName: schema.users.fullName
    })
    .from(schema.referrals)
    .leftJoin(schema.users, eq(schema.referrals.referredUserId, schema.users.id))
    .where(eq(schema.referrals.affiliateId, affiliate.id))
    .orderBy(desc(schema.referrals.signupDate));
    
    return referrals;
  } catch (error: unknown) {
    console.error("Error getting affiliate referrals:", error);
    throw error instanceof AppError ? error : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

/**
 * Get all payments for an affiliate
 */
export async function getAffiliatePayments(userId: number): Promise<schema.ReferralPayment[]> {
  try {
    const affiliate = await getAffiliateByUserId(userId);
    if (!affiliate) {
      return [];
    }
    
    const payments = await db.select()
      .from(schema.referralPayments)
      .where(eq(schema.referralPayments.affiliateId, affiliate.id))
      .orderBy(desc(schema.referralPayments.createdAt));
    
    return payments;
  } catch (error: unknown) {
    console.error("Error getting affiliate payments:", error);
    throw error instanceof AppError ? error : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

/**
 * Track a click on an affiliate link (implementation would require a separate tracking system)
 */
export async function trackAffiliateClick(referralCode: string, source?: string): Promise<boolean> {
  try {
    // In a production system, you'd store this in a separate clicks tracking table
    // For the MVP, we'll just log it
    console.log(`Click tracked for referral code: ${referralCode}, source: ${source || 'unknown'}`);
    return true;
  } catch (error: unknown) {
    console.error("Error tracking affiliate click:", error);
    return false;
  }
}

/**
 * Update affiliate bank details
 */
export async function updateAffiliateBankDetails(
  userId: number, 
  bankDetails: {
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
    bankCode?: string;
    paymentMethod?: string;
  }
): Promise<schema.Affiliate | null> {
  try {
    const affiliate = await getAffiliateByUserId(userId);
    if (!affiliate) {
      return null;
    }
    
    const [updatedAffiliate] = await db.update(schema.affiliates)
      .set({ 
        ...bankDetails,
        updatedAt: new Date()
      })
      .where(eq(schema.affiliates.id, affiliate.id))
      .returning();
    
    return updatedAffiliate;
  } catch (error: unknown) {
    console.error("Error updating affiliate bank details:", error);
    throw error instanceof AppError ? error : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
