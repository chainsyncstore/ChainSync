'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.AffiliateServiceErrors = void 0;
const errors_1 = require('@shared/types/errors');
const base_service_1 = require('../base/base-service');
exports.AffiliateServiceErrors = {
  USER_NOT_FOUND: new base_service_1.ServiceError(errors_1.ErrorCode.RESOURCE_NOT_FOUND, 'User not found', { category: errors_1.ErrorCategory.RESOURCE }),
  INVALID_REFERRAL_CODE: new base_service_1.ServiceError(errors_1.ErrorCode.INVALID_FIELD_VALUE, 'Invalid referral code', { category: errors_1.ErrorCategory.VALIDATION }),
  REFERRAL_ALREADY_EXISTS: new base_service_1.ServiceError(errors_1.ErrorCode.RESOURCE_ALREADY_EXISTS, 'Referral already exists', { category: errors_1.ErrorCategory.RESOURCE }),
  INSUFFICIENT_BALANCE: new base_service_1.ServiceError(errors_1.ErrorCode.INSUFFICIENT_BALANCE, 'Insufficient balance for payout', { category: errors_1.ErrorCategory.BUSINESS }),
  PAYOUT_FAILED: new base_service_1.ServiceError(errors_1.ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to process payout', { category: errors_1.ErrorCategory.SYSTEM, retryable: true, timeout: 5000 }),
  INVALID_BANK_DETAILS: new base_service_1.ServiceError(errors_1.ErrorCode.INVALID_FIELD_VALUE, 'Invalid bank details provided', { category: errors_1.ErrorCategory.VALIDATION })
};
