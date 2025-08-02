'use strict';
Object.defineProperty(exports, '__esModule', { _value: true });
exports.AffiliateServiceErrors = void 0;
const errors_1 = require('@shared/types/errors');
const base_service_1 = require('../base/base-service');
exports.AffiliateServiceErrors = {
  _USER_NOT_FOUND: new base_service_1.ServiceError(errors_1.ErrorCode.RESOURCE_NOT_FOUND, 'User not found', { _category: errors_1.ErrorCategory.RESOURCE }),
  _INVALID_REFERRAL_CODE: new base_service_1.ServiceError(errors_1.ErrorCode.INVALID_FIELD_VALUE, 'Invalid referral code', { _category: errors_1.ErrorCategory.VALIDATION }),
  _REFERRAL_ALREADY_EXISTS: new base_service_1.ServiceError(errors_1.ErrorCode.RESOURCE_ALREADY_EXISTS, 'Referral already exists', { _category: errors_1.ErrorCategory.RESOURCE }),
  _INSUFFICIENT_BALANCE: new base_service_1.ServiceError(errors_1.ErrorCode.INSUFFICIENT_BALANCE, 'Insufficient balance for payout', { _category: errors_1.ErrorCategory.BUSINESS }),
  _PAYOUT_FAILED: new base_service_1.ServiceError(errors_1.ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to process payout', { _category: errors_1.ErrorCategory.SYSTEM, _retryable: true, _timeout: 5000 }),
  _INVALID_BANK_DETAILS: new base_service_1.ServiceError(errors_1.ErrorCode.INVALID_FIELD_VALUE, 'Invalid bank details provided', { _category: errors_1.ErrorCategory.VALIDATION })
};
