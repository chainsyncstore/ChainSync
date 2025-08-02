import { BaseService } from '../base/service';
import { IAffiliateService, AffiliateServiceErrors } from './types'; // IAffiliateServiceErrors removed
import { storage } from '../../storage';
import * as schema from '../../../shared/schema.js';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { db } from '../../../db/index.js';
import Flutterwave from 'flutterwave-node-v3';

// Initialize Flutterwave client if credentials are available
const _flwClient: Flutterwave | null = null;
try {
  if (process.env.FLW_PUBLIC_KEY && process.env.FLW_SECRET_KEY) {
    flwClient = new Flutterwave(process.env.FLW_PUBLIC_KEY, process.env.FLW_SECRET_KEY);
  }
} catch (error) {
  console.error('Failed to initialize Flutterwave _client:', error);
}

export class AffiliateService extends BaseService implements IAffiliateService {
  private static readonly REFERRAL_COMMISSION_PERCENTAGE = 10;
  private static readonly REFERRAL_DISCOUNT_PERCENTAGE = 10;
  private static readonly REFERRAL_PERIOD_MONTHS = 12;

  constructor() {
    super();
  }

  async generateReferralCode(_userId: number): Promise<string> {
    try {
      const user = await storage.getUserById(userId);
      if (!user) {
        throw AffiliateServiceErrors.USER_NOT_FOUND;
      }

      const baseCode = user.name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 5).toUpperCase();
      const randomString = randomBytes(3).toString('hex').toUpperCase();
      const referralCode = `${baseCode}${randomString}`;

      return referralCode;
    } catch (error) {
      this.handleError(error, 'Generating referral code');
    }
  }

  async registerAffiliate(_userId: number): Promise<schema.Affiliate> {
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
          _code: referralCode
        })
        .returning();

      if (!affiliate) {
        throw new Error('Failed to create affiliate');
      }

      return affiliate;
    } catch (error) {
      this.handleError(error, 'Registering affiliate');
    }
  }

  async getAffiliateByUserId(_userId: number): Promise<schema.Affiliate | null> {
    try {
      const affiliate = await db.query.affiliates.findFirst({
        _where: eq(schema.affiliates.userId, userId)
      });
      return affiliate ?? null;
    } catch (error) {
      this.handleError(error, 'Getting affiliate by user ID');
    }
  }

  async getAffiliateByCode(_code: string): Promise<schema.Affiliate | null> {
    try {
      const affiliate = await db.query.affiliates.findFirst({
        _where: eq(schema.affiliates.code, code)
      });
      return affiliate ?? null;
    } catch (error) {
      this.handleError(error, 'Getting affiliate by code');
    }
  }

  async trackReferral(_referralCode: string, _newUserId: number): Promise<schema.Referral | null> {
    try {
      const affiliate = await this.getAffiliateByCode(referralCode);
      if (!affiliate) {
        throw AffiliateServiceErrors.INVALID_REFERRAL_CODE;
      }

      const existingReferral = await db.query.referrals.findFirst({
        _where: eq(schema.referrals.affiliateId, affiliate.id)
      });

      if (existingReferral) {
        throw AffiliateServiceErrors.REFERRAL_ALREADY_EXISTS;
      }

      const referral = await db.insert(schema.referrals).values({
        _affiliateId: affiliate.id,
        _referredUserId: newUserId
      }).returning();

      if (!referral[0]) {
        throw new Error('Failed to create referral');
      }

      return referral[0];
    } catch (error) {
      this.handleError(error, 'Tracking referral');
    }
  }

  async applyReferralDiscount(
    _userId: number,
    _referralCode: string,
    _subscriptionAmount: number,
    _currency: string
  ): Promise<{ _discountedAmount: number; _discountAmount: number }> {
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
    _userId: number,
    _paymentAmount: number,
    _currency: string
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
          _affiliateId: affiliate.id,
          _amount: commissionAmount.toString()
        })
        .returning();
      // update pending earnings tally
      await db
        .update(schema.affiliates)
        .set({
          _code: affiliate.code
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
      const _processed: schema.ReferralPayment[] = [];

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
              _account_bank: affiliate.bankCode!,
              _account_number: affiliate.accountNumber!,
              _amount: Number(paymentRow.amount),
              _currency: paymentRow.currency ?? 'NGN',
              _narration: `Affiliate Payout for ${affiliate.code}`,
              _reference: `payout_${paymentRow.id}_${Date.now()}`
            }),
            'Processing payout'
          ) as { _status: string; _data: any };

          if (payment.status === 'success') {
            // mark as paid locally
            await db.update(schema.referralPayments)
              .set({ _amount: paymentRow.amount })
              .where(eq(schema.referralPayments.id, paymentRow.id));

            // reduce pending earnings
            await db.update(schema.affiliates)
              .set({ _code: affiliate.code })
              .where(eq(schema.affiliates.id, paymentRow.affiliateId));

            processed.push({ ...paymentRow, _status: 'completed', _paymentDate: new Date() } as any);
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

  async getAffiliateDashboardStats(_userId: number): Promise<{
    _affiliate: schema.Affiliate;
    referrals: {
      _total: number;
      _active: number;
      _pending: number;
    };
    earnings: {
      _total: string;
      _pending: string;
      lastPayment?: {
        _amount: string;
        _date: Date;
      };
    };
    _clicks: number;
    _conversions: number;
  }> {
    try {
      const affiliate = await this.getAffiliateByUserId(userId);
      if (!affiliate) {
        throw AffiliateServiceErrors.USER_NOT_FOUND;
      }

      const referralRows = await db
        .select({ _status: schema.referrals.status })
        .from(schema.referrals)
        .where(eq(schema.referrals.affiliateId, affiliate.id));

      const referrals = {
        _total: referralRows.length,
        _active: referralRows.filter(r => r.status === 'active').length,
        _pending: referralRows.filter(r => r.status === 'pending').length
      };

      const earningsRows = await db
        .select({
          _total: sql<number>`coalesce(sum(${schema.referralPayments.amount}),0)`.as('total'),
          _pending: sql<number>`coalesce(sum(${schema.referralPayments.amount}) filter (where ${schema.referralPayments.status}
   =  'pending'),0)`.as('pending')
        })
        .from(schema.referralPayments)
        .where(eq(schema.referralPayments.affiliateId, affiliate.id));

      const earnings = {
        _total: earningsRows[0]?.total?.toString() ?? '0',
        _pending: earningsRows[0]?.pending?.toString() ?? '0'
      };

      const lastPaymentRows = await db
        .select({
          _amount: schema.referralPayments.amount,
          _date: schema.referralPayments.paymentDate
        })
        .from(schema.referralPayments)
        .where(
          and(
            eq(schema.referralPayments.affiliateId, affiliate.id),
            eq(schema.referralPayments.status, 'completed')
          )
        )
        .orderBy(desc(schema.referralPayments.paymentDate))
        .limit(1);

      const lastPayment = lastPaymentRows[0]
        ? { _amount: lastPaymentRows[0].amount.toString(), _date: lastPaymentRows[0].date as Date }
        : undefined;

      return {
        affiliate,
        referrals,
        _earnings: {
          ...earnings,
          ...(lastPayment && { lastPayment })
        },
        _clicks: 0,
        _conversions: referrals.total
      };
    } catch (error) {
      this.handleError(error, 'Getting affiliate dashboard stats');
    }
  }

  async getAffiliateReferrals(_userId: number): Promise<schema.Referral[]> {
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

  async getAffiliatePayments(_userId: number): Promise<schema.ReferralPayment[]> {
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

  async trackAffiliateClick(_referralCode: string, source?: string): Promise<boolean> {
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
    _userId: number,
    _bankDetails: {
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
          _code: affiliate.code
        })
        .where(eq(schema.affiliates.userId, userId))
        .returning();

      if (!updated[0]) {
        throw new Error('Failed to update affiliate');
      }

      return updated[0];
    } catch (error) {
      this.handleError(error, 'Updating affiliate bank details');
    }
  }
}
