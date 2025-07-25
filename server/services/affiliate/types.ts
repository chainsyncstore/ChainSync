import { ErrorCode, ErrorCategory } from '@shared/types/errors';
import * as schema from '@shared/schema';
import { ServiceError } from '../base/base-service';

export interface IAffiliateService {
  generateReferralCode(userId: number): Promise<string>;
  registerAffiliate(userId: number): Promise<schema.Affiliate>;
  getAffiliateByUserId(userId: number): Promise<schema.Affiliate | null>;
  getAffiliateByCode(code: string): Promise<schema.Affiliate | null>;
  trackReferral(referralCode: string, newUserId: number): Promise<schema.Referral | null>;
  applyReferralDiscount(
    userId: number,
    referralCode: string,
    subscriptionAmount: number,
    currency: string
  ): Promise<{
    discountedAmount: number;
    discountAmount: number;
  }>;
  processAffiliateCommission(
    userId: number,
    paymentAmount: number,
    currency: string
  ): Promise<boolean>;
  processAffiliatePayout(affiliateId?: number): Promise<schema.ReferralPayment[]>;
  getAffiliateDashboardStats(userId: number): Promise<{
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
  }>;
  getAffiliateReferrals(userId: number): Promise<schema.Referral[]>;
  getAffiliatePayments(userId: number): Promise<schema.ReferralPayment[]>;
  trackAffiliateClick(referralCode: string, source?: string): Promise<boolean>;
  updateAffiliateBankDetails(
    userId: number,
    bankDetails: {
      bankName?: string;
      accountNumber?: string;
      accountName?: string;
      bankCode?: string;
      paymentMethod?: string;
    }
  ): Promise<schema.Affiliate | null>;
}

export interface IAffiliateServiceErrors {
  USER_NOT_FOUND: ServiceError;
  INVALID_REFERRAL_CODE: ServiceError;
  REFERRAL_ALREADY_EXISTS: ServiceError;
  INSUFFICIENT_BALANCE: ServiceError;
  PAYOUT_FAILED: ServiceError;
  INVALID_BANK_DETAILS: ServiceError;
}

export const AffiliateServiceErrors: IAffiliateServiceErrors = {
  USER_NOT_FOUND: new ServiceError(
    ErrorCode.RESOURCE_NOT_FOUND,
    'User not found',
    { category: ErrorCategory.RESOURCE }
  ),
  INVALID_REFERRAL_CODE: new ServiceError(
    ErrorCode.INVALID_FIELD_VALUE,
    'Invalid referral code',
    { category: ErrorCategory.VALIDATION }
  ),
  REFERRAL_ALREADY_EXISTS: new ServiceError(
    ErrorCode.RESOURCE_ALREADY_EXISTS,
    'Referral already exists',
    { category: ErrorCategory.RESOURCE }
  ),
  INSUFFICIENT_BALANCE: new ServiceError(
    ErrorCode.INSUFFICIENT_BALANCE,
    'Insufficient balance for payout',
    { category: ErrorCategory.BUSINESS }
  ),
  PAYOUT_FAILED: new ServiceError(
    ErrorCode.INTERNAL_SERVER_ERROR,
    'Failed to process payout',
    { category: ErrorCategory.SYSTEM, retryable: true, timeout: 5000 }
  ),
  INVALID_BANK_DETAILS: new ServiceError(
    ErrorCode.INVALID_FIELD_VALUE,
    'Invalid bank details provided',
    { category: ErrorCategory.VALIDATION }
  ),
};
