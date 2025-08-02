import { ErrorCode, ErrorCategory } from '@shared/types/errors';
import * as schema from '@shared/schema';
import { ServiceError } from '../base/base-service';

export interface IAffiliateService {
  generateReferralCode(_userId: number): Promise<string>;
  registerAffiliate(_userId: number): Promise<schema.Affiliate>;
  getAffiliateByUserId(_userId: number): Promise<schema.Affiliate | null>;
  getAffiliateByCode(_code: string): Promise<schema.Affiliate | null>;
  trackReferral(_referralCode: string, _newUserId: number): Promise<schema.Referral | null>;
  applyReferralDiscount(
    _userId: number,
    _referralCode: string,
    _subscriptionAmount: number,
    _currency: string
  ): Promise<{
    _discountedAmount: number;
    _discountAmount: number;
  }>;
  processAffiliateCommission(
    _userId: number,
    _paymentAmount: number,
    _currency: string
  ): Promise<boolean>;
  processAffiliatePayout(affiliateId?: number): Promise<schema.ReferralPayment[]>;
  getAffiliateDashboardStats(_userId: number): Promise<{
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
  }>;
  getAffiliateReferrals(_userId: number): Promise<schema.Referral[]>;
  getAffiliatePayments(_userId: number): Promise<schema.ReferralPayment[]>;
  trackAffiliateClick(_referralCode: string, source?: string): Promise<boolean>;
  updateAffiliateBankDetails(
    _userId: number,
    _bankDetails: {
      bankName?: string;
      accountNumber?: string;
      accountName?: string;
      bankCode?: string;
      paymentMethod?: string;
    }
  ): Promise<schema.Affiliate | null>;
}

export interface IAffiliateServiceErrors {
  _USER_NOT_FOUND: ServiceError;
  _INVALID_REFERRAL_CODE: ServiceError;
  _REFERRAL_ALREADY_EXISTS: ServiceError;
  _INSUFFICIENT_BALANCE: ServiceError;
  _PAYOUT_FAILED: ServiceError;
  _INVALID_BANK_DETAILS: ServiceError;
}

export const _AffiliateServiceErrors: IAffiliateServiceErrors = {
  _USER_NOT_FOUND: new ServiceError(
    ErrorCode.RESOURCE_NOT_FOUND,
    'User not found',
    { _category: ErrorCategory.RESOURCE }
  ),
  _INVALID_REFERRAL_CODE: new ServiceError(
    ErrorCode.INVALID_FIELD_VALUE,
    'Invalid referral code',
    { _category: ErrorCategory.VALIDATION }
  ),
  _REFERRAL_ALREADY_EXISTS: new ServiceError(
    ErrorCode.RESOURCE_ALREADY_EXISTS,
    'Referral already exists',
    { _category: ErrorCategory.RESOURCE }
  ),
  _INSUFFICIENT_BALANCE: new ServiceError(
    ErrorCode.INSUFFICIENT_BALANCE,
    'Insufficient balance for payout',
    { _category: ErrorCategory.BUSINESS }
  ),
  _PAYOUT_FAILED: new ServiceError(
    ErrorCode.INTERNAL_SERVER_ERROR,
    'Failed to process payout',
    { _category: ErrorCategory.SYSTEM, _retryable: true, _timeout: 5000 }
  ),
  _INVALID_BANK_DETAILS: new ServiceError(
    ErrorCode.INVALID_FIELD_VALUE,
    'Invalid bank details provided',
    { _category: ErrorCategory.VALIDATION }
  )
};
