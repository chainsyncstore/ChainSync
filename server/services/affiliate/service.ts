import { BaseService } from '../base/service';
import { IAffiliateService, AffiliateServiceErrors } from './types'; // IAffiliateServiceErrors removed
import { storage } from '../../storage';
import * as schema from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm'; // gte, lte removed
import { randomBytes } from 'crypto';
import { db } from '../../../db';
import Flutterwave from 'flutterwave-node-v3';

// Initialize Flutterwave client if credentials are available
let flwClient: Flutterwave | null = null;
try {
  if (process.env.FLW_PUBLIC_KEY && process.env.FLW_SECRET_KEY) {
    flwClient = new Flutterwave(process.env.FLW_PUBLIC_KEY, process.env.FLW_SECRET_KEY);
  }
} catch (error) {
  console.error('Failed to initialize Flutterwave client:', error);
}

export class AffiliateService extends BaseService implements IAffiliateService {
  private static readonly REFERRAL_COMMISSION_PERCENTAGE = 10;
  private static readonly REFERRAL_DISCOUNT_PERCENTAGE = 10;
  private static readonly REFERRAL_PERIOD_MONTHS = 12;

  async generateReferralCode(userId: number): Promise<string> {
    try {
      const user = await storage.getUserById(userId);
      if (!user) {
        throw AffiliateServiceErrors.USER_NOT_FOUND;
      }

      const baseCode = user.username.replace(/[^a-zA-Z0-9]/g, '').substring(0, 5).toUpperCase();
      const randomString = randomBytes(3).toString('hex').toUpperCase();
      const referralCode = `${baseCode}${randomString}`;

      return referralCode;
    } catch (error) {
      this.handleError(error, 'Generating referral code');
    }
  }

  async registerAffiliate(userId: number): Promise<schema.Affiliate> {
    try {
      const user = await storage.getUserById(userId);
      if (!user) {
        throw AffiliateServiceErrors.USER_NOT_FOUND;
      }

      const referralCode = await this.generateReferralCode(userId);
      const affiliate = await db.insert(schema.affiliates).values({
        userId,
        referralCode,
        status: 'active',
        commissionRate: AffiliateService.REFERRAL_COMMISSION_PERCENTAGE / 100
      }).returning();

      return affiliate[0];
    } catch (error) {
      this.handleError(error, 'Registering affiliate');
    }
  }

  async getAffiliateByUserId(userId: number): Promise<schema.Affiliate | null> {
    try {
      return await db.query.affiliates.findFirst({
        where: eq(schema.affiliates.userId, userId)
      });
    } catch (error) {
      this.handleError(error, 'Getting affiliate by user ID');
    }
  }

  async getAffiliateByCode(code: string): Promise<schema.Affiliate | null> {
    try {
      return await db.query.affiliates.findFirst({
        where: eq(schema.affiliates.referralCode, code)
      });
    } catch (error) {
      this.handleError(error, 'Getting affiliate by code');
    }
  }

  async trackReferral(referralCode: string, newUserId: number): Promise<schema.Referral | null> {
    try {
      const affiliate = await this.getAffiliateByCode(referralCode);
      if (!affiliate) {
        throw AffiliateServiceErrors.INVALID_REFERRAL_CODE;
      }

      const existingReferral = await db.query.referrals.findFirst({
        where: eq(schema.referrals.referringUserId, affiliate.userId)
      });

      if (existingReferral) {
        throw AffiliateServiceErrors.REFERRAL_ALREADY_EXISTS;
      }

      const referral = await db.insert(schema.referrals).values({
        referringUserId: affiliate.userId,
        referredUserId: newUserId,
        status: 'active',
        createdAt: new Date()
      }).returning();

      return referral[0];
    } catch (error) {
      this.handleError(error, 'Tracking referral');
    }
  }

  async applyReferralDiscount(
    userId: number,
    referralCode: string,
    subscriptionAmount: number,
    currency: string
  ): Promise<{ discountedAmount: number; discountAmount: number }> {
    try {
      const affiliate = await this.getAffiliateByCode(referralCode);
      if (!affiliate) {
        throw AffiliateServiceErrors.INVALID_REFERRAL_CODE;
      }

      const discountAmount = (subscriptionAmount * AffiliateService.REFERRAL_DISCOUNT_PERCENTAGE) / 100;
      const discountedAmount = subscriptionAmount - discountAmount;

      return {
        discountedAmount,
        discountAmount
      };
    } catch (error) {
      this.handleError(error, 'Applying referral discount');
    }
  }

  async processAffiliateCommission(
    userId: number,
    paymentAmount: number,
    currency: string
  ): Promise<boolean> {
    try {
      const affiliate = await this.getAffiliateByUserId(userId);
      if (!affiliate) {
        throw AffiliateServiceErrors.USER_NOT_FOUND;
      }

      const commissionAmount = paymentAmount * affiliate.commissionRate;
      const commission = await db.insert(schema.affiliateCommissions).values({
        affiliateId: affiliate.id,
        amount: commissionAmount,
        currency,
        status: 'pending',
        createdAt: new Date()
      }).returning();

      return commission[0] !== undefined;
    } catch (error) {
      this.handleError(error, 'Processing affiliate commission');
    }
  }

  async processAffiliatePayout(affiliateId?: number): Promise<schema.ReferralPayment[]> {
    try {
      const query = db
        .select()
        .from(schema.affiliateCommissions)
        .where(eq(schema.affiliateCommissions.status, 'pending'))
        .orderBy(desc(schema.affiliateCommissions.createdAt));

      if (affiliateId) {
        query.where(eq(schema.affiliateCommissions.affiliateId, affiliateId));
      }

      const commissions = await query;
      const payments: schema.ReferralPayment[] = [];

      for (const commission of commissions) {
        if (!flwClient) {
          throw AffiliateServiceErrors.PAYOUT_FAILED;
        }

        try {
          // Simulate payout
          const payment = await this.withRetry(
            () => flwClient.Payout.createPayout(
              commission.amount,
              commission.currency,
              affiliate.bankDetails
            ),
            'Processing payout'
          );

          if (payment.status === 'success') {
            await db.update(schema.affiliateCommissions)
              .set({
                status: 'paid',
                paidAt: new Date(),
                paymentId: payment.data.id
              })
              .where(eq(schema.affiliateCommissions.id, commission.id))
              .returning();

            payments.push(payment.data);
          }
        } catch (error) {
          // Log but continue processing other payouts
          console.error(`Failed to process payout for commission ${commission.id}:`, error);
        }
      }

      return payments;
    } catch (error) {
      this.handleError(error, 'Processing affiliate payouts');
    }
  }

  async getAffiliateDashboardStats(userId: number): Promise<{
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
    clicks: number;
    conversions: number;
  }> {
    try {
      const affiliate = await this.getAffiliateByUserId(userId);
      if (!affiliate) {
        throw AffiliateServiceErrors.USER_NOT_FOUND;
      }

      const referrals = await db
        .select({
          total: schema.referrals.id.count(), // Using Drizzle's count aggregation
          active: schema.referrals.id.count().filter(eq(schema.referrals.status, 'active')), // Using Drizzle's count with filter
          pending: schema.referrals.id.count().filter(eq(schema.referrals.status, 'pending')) // Using Drizzle's count with filter
        })
        .from(schema.referrals)
        .where(eq(schema.referrals.referringUserId, affiliate.userId));

      const earnings = await db
        .select({
          total: schema.affiliateCommissions.amount.sum(), // Using Drizzle's sum aggregation
          pending: schema.affiliateCommissions.amount.sum().filter(eq(schema.affiliateCommissions.status, 'pending')) // Using Drizzle's sum with filter
        })
        .from(schema.affiliateCommissions)
        .where(eq(schema.affiliateCommissions.affiliateId, affiliate.id));

      const lastPayment = await db
        .select({
          amount: schema.affiliateCommissions.amount,
          date: schema.affiliateCommissions.paidAt
        })
        .from(schema.affiliateCommissions)
        .where(
          and(
            eq(schema.affiliateCommissions.affiliateId, affiliate.id),
            eq(schema.affiliateCommissions.status, 'paid')
          )
        )
        .orderBy(desc(schema.affiliateCommissions.paidAt))
        .limit(1);

      return {
        affiliate,
        referrals: {
          total: referrals[0].total,
          active: referrals[0].active,
          pending: referrals[0].pending
        },
        earnings: {
          total: earnings[0].total?.toString() || '0',
          pending: earnings[0].pending?.toString() || '0',
          lastPayment: lastPayment[0]
        },
        clicks: 0, // This would require additional tracking
        conversions: referrals[0].total
      };
    } catch (error) {
      this.handleError(error, 'Getting affiliate dashboard stats');
    }
  }

  async getAffiliateReferrals(userId: number): Promise<schema.Referral[]> {
    try {
      return await db
        .select()
        .from(schema.referrals)
        .where(eq(schema.referrals.referringUserId, userId))
        .orderBy(desc(schema.referrals.createdAt));
    } catch (error) {
      this.handleError(error, 'Getting affiliate referrals');
    }
  }

  async getAffiliatePayments(userId: number): Promise<schema.ReferralPayment[]> {
    try {
      return await db
        .select()
        .from(schema.affiliateCommissions)
        .where(eq(schema.affiliateCommissions.affiliateId, userId))
        .orderBy(desc(schema.affiliateCommissions.createdAt));
    } catch (error) {
      this.handleError(error, 'Getting affiliate payments');
    }
  }

  async trackAffiliateClick(referralCode: string, source?: string): Promise<boolean> {
    try {
      const affiliate = await this.getAffiliateByCode(referralCode);
      if (!affiliate) {
        throw AffiliateServiceErrors.INVALID_REFERRAL_CODE;
      }

      // This would require additional tracking table
      return true;
    } catch (error) {
      this.handleError(error, 'Tracking affiliate click');
    }
  }

  async updateAffiliateBankDetails(
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
      const affiliate = await this.getAffiliateByUserId(userId);
      if (!affiliate) {
        throw AffiliateServiceErrors.USER_NOT_FOUND;
      }

      const updated = await db
        .update(schema.affiliates)
        .set({
          bankDetails: {
            bankName: bankDetails.bankName,
            accountNumber: bankDetails.accountNumber,
            accountName: bankDetails.accountName,
            bankCode: bankDetails.bankCode,
            paymentMethod: bankDetails.paymentMethod
          }
        })
        .where(eq(schema.affiliates.userId, userId))
        .returning();

      return updated[0];
    } catch (error) {
      this.handleError(error, 'Updating affiliate bank details');
    }
  }
}
