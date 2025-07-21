import { BaseService } from '../base/service';
import { IAffiliateService, AffiliateServiceErrors } from './types'; // IAffiliateServiceErrors removed
import { storage } from '../../storage';
import * as schema from '@shared/schema';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
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
      const [affiliate] = await db
        .insert(schema.affiliates)
        .values({
          userId,
          code: referralCode,
        })
        .returning();
      return affiliate;
    } catch (error) {
      this.handleError(error, 'Registering affiliate');
    }
  }

  async getAffiliateByUserId(userId: number): Promise<schema.Affiliate | null> {
    try {
      const affiliate = await db.query.affiliates.findFirst({
        where: eq(schema.affiliates.userId, userId)
      });
      return affiliate ?? null;
    } catch (error) {
      this.handleError(error, 'Getting affiliate by user ID');
      return null;
    }
  }

  async getAffiliateByCode(code: string): Promise<schema.Affiliate | null> {
    try {
      const affiliate = await db.query.affiliates.findFirst({
        where: eq(schema.affiliates.code, code)
      });
      return affiliate ?? null;
    } catch (error) {
      this.handleError(error, 'Getting affiliate by code');
      return null;
    }
  }

  async trackReferral(referralCode: string, newUserId: number): Promise<schema.Referral | null> {
    try {
      const affiliate = await this.getAffiliateByCode(referralCode);
      if (!affiliate) {
        throw AffiliateServiceErrors.INVALID_REFERRAL_CODE;
      }

      const existingReferral = await db.query.referrals.findFirst({
        where: eq(schema.referrals.affiliateId, affiliate.id)
      });

      if (existingReferral) {
        throw AffiliateServiceErrors.REFERRAL_ALREADY_EXISTS;
      }

      const referral = await db.insert(schema.referrals).values({
        affiliateId: affiliate.id,
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

      const commissionAmount = (paymentAmount * AffiliateService.REFERRAL_COMMISSION_PERCENTAGE) / 100;
      const [payment] = await db
        .insert(schema.referralPayments)
        .values({
          affiliateId: affiliate.id,
          amount: commissionAmount.toString(),
          currency,
          status: 'pending',
          paymentDate: new Date(),
        })
        .returning();
      // update pending earnings tally
      await db
        .update(schema.affiliates)
        .set({
          pendingEarnings: sql`${schema.affiliates.pendingEarnings} + ${commissionAmount}`,
          totalEarnings: sql`${schema.affiliates.totalEarnings} + ${commissionAmount}`,
        })
        .where(eq(schema.affiliates.id, affiliate.id));
      return !!payment;
    } catch (error) {
      this.handleError(error, 'Processing affiliate commission');
    }
  }

  async processAffiliatePayout(affiliateId?: number): Promise<schema.ReferralPayment[]> {
    try {
      const whereClauses = [eq(schema.referralPayments.status, 'pending')];
      if (affiliateId) {
        whereClauses.push(eq(schema.referralPayments.affiliateId, affiliateId));
      }

      const pendingPayments = await db
        .select()
        .from(schema.referralPayments)
        .where(and(...whereClauses))
        .orderBy(desc(schema.referralPayments.paymentDate));
      const processed: schema.ReferralPayment[] = [];

      for (const paymentRow of pendingPayments) {
        if (!flwClient) {
          throw AffiliateServiceErrors.PAYOUT_FAILED;
        }

        try {
          const affiliate = await this.getAffiliateByUserId(paymentRow.affiliateId);
          if (!affiliate || !affiliate.bankCode || !affiliate.accountNumber) {
            console.error(`Affiliate or bank details not found for payment ${paymentRow.id}`);
            continue;
          }

          // Simulate payout
          const payment = await this.withRetry(
            () => flwClient!.Transfer.initiate({
              account_bank: affiliate.bankCode!,
              account_number: affiliate.accountNumber!,
              amount: Number(paymentRow.amount),
              currency: paymentRow.currency,
              narration: `Affiliate Payout for ${affiliate.code}`,
              reference: `payout_${paymentRow.id}_${Date.now()}`
            }),
            'Processing payout'
          ) as { status: string; data: any };

          if (payment.status === 'success') {
            // mark as paid locally
            await db.update(schema.referralPayments)
              .set({ status: 'paid', paymentDate: new Date() })
              .where(eq(schema.referralPayments.id, paymentRow.id));

            // reduce pending earnings
            await db.update(schema.affiliates)
              .set({ pendingEarnings: sql`${schema.affiliates.pendingEarnings} - ${paymentRow.amount}` })
              .where(eq(schema.affiliates.id, paymentRow.affiliateId));

            processed.push({ ...paymentRow, status: 'paid', paymentDate: new Date() } as any);
          }
        } catch (error) {
          // Log but continue processing other payouts
          console.error(`Failed to process payout for commission ${paymentRow.id}:`, error);
        }
      }

      return processed;
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

      const referralRows = await db
        .select({ status: schema.referrals.status })
        .from(schema.referrals)
        .where(eq(schema.referrals.affiliateId, affiliate.id));

      const referrals = {
        total: referralRows.length,
        active: referralRows.filter(r => r.status === 'active').length,
        pending: referralRows.filter(r => r.status === 'pending').length,
      };

      const earningsRows = await db
        .select({
          total: sql<number>`coalesce(sum(${schema.referralPayments.amount}),0)`.as('total'),
          pending: sql<number>`coalesce(sum(${schema.referralPayments.amount}) filter (where ${schema.referralPayments.status} = 'pending'),0)`.as('pending'),
        })
        .from(schema.referralPayments)
        .where(eq(schema.referralPayments.affiliateId, affiliate.id));

      const earnings = {
        total: earningsRows[0]?.total?.toString() ?? '0',
        pending: earningsRows[0]?.pending?.toString() ?? '0',
      };

      const lastPaymentRows = await db
        .select({
          amount: schema.referralPayments.amount,
          date: schema.referralPayments.paymentDate,
        })
        .from(schema.referralPayments)
        .where(
          and(
            eq(schema.referralPayments.affiliateId, affiliate.id),
            eq(schema.referralPayments.status, 'paid'),
          ),
        )
        .orderBy(desc(schema.referralPayments.paymentDate))
        .limit(1);

      const lastPayment = lastPaymentRows[0]
        ? { amount: lastPaymentRows[0].amount.toString(), date: lastPaymentRows[0].date as Date }
        : undefined;

      return {
        affiliate,
        referrals,
        earnings: { ...earnings, lastPayment },
        clicks: 0,
        conversions: referrals.total,
      };
    } catch (error) {
      this.handleError(error, 'Getting affiliate dashboard stats');
    }
  }

  async getAffiliateReferrals(userId: number): Promise<schema.Referral[]> {
    try {
      const affiliate = await this.getAffiliateByUserId(userId);
      if (!affiliate) throw AffiliateServiceErrors.USER_NOT_FOUND;
      return await db
        .select()
        .from(schema.referrals)
        .where(eq(schema.referrals.affiliateId, affiliate.id))
        .orderBy(desc(schema.referrals.createdAt));
    } catch (error) {
      this.handleError(error, 'Getting affiliate referrals');
    }
  }

  async getAffiliatePayments(userId: number): Promise<schema.ReferralPayment[]> {
    try {
      const affiliate = await this.getAffiliateByUserId(userId);
      if (!affiliate) throw AffiliateServiceErrors.USER_NOT_FOUND;
      return await db
        .select()
        .from(schema.referralPayments)
        .where(eq(schema.referralPayments.affiliateId, affiliate.id))
        .orderBy(desc(schema.referralPayments.paymentDate));
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
        .set(bankDetails)
        .where(eq(schema.affiliates.userId, userId))
        .returning();

      return updated[0];
    } catch (error) {
      this.handleError(error, 'Updating affiliate bank details');
    }
  }
}
