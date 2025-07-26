"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseOperationError = exports.InvalidTierError = exports.MemberAlreadyEnrolledError = exports.ProgramAlreadyExistsError = exports.RewardNotFoundError = exports.InsufficientPointsError = exports.LoyaltyMemberNotFoundError = exports.LoyaltyProgramNotFoundError = void 0;
const errors_1 = require("@shared/types/errors");
// Error classes
class LoyaltyProgramNotFoundError extends errors_1.AppError {
    constructor(programId) {
        super(`Loyalty program with ID ${programId} not found`, errors_1.ErrorCategory.RESOURCE, errors_1.ErrorCode.NOT_FOUND, { programId }, 404);
    }
}
exports.LoyaltyProgramNotFoundError = LoyaltyProgramNotFoundError;
class LoyaltyMemberNotFoundError extends errors_1.AppError {
    constructor(memberId) {
        super(`Loyalty member with ID ${memberId} not found`, errors_1.ErrorCategory.RESOURCE, errors_1.ErrorCode.NOT_FOUND, { memberId }, 404);
    }
}
exports.LoyaltyMemberNotFoundError = LoyaltyMemberNotFoundError;
class InsufficientPointsError extends errors_1.AppError {
    constructor(memberId, requiredPoints) {
        super(`Member ${memberId} has insufficient points. Required: ${requiredPoints}`, errors_1.ErrorCategory.BUSINESS, errors_1.ErrorCode.INSUFFICIENT_BALANCE, { memberId, requiredPoints }, 400);
    }
}
exports.InsufficientPointsError = InsufficientPointsError;
class RewardNotFoundError extends errors_1.AppError {
    constructor(rewardId) {
        super(`Reward with ID ${rewardId} not found`, errors_1.ErrorCategory.RESOURCE, errors_1.ErrorCode.NOT_FOUND, { rewardId }, 404);
    }
}
exports.RewardNotFoundError = RewardNotFoundError;
class ProgramAlreadyExistsError extends errors_1.AppError {
    constructor(name, storeId) {
        super(`A loyalty program with name "${name}" already exists for store ${storeId}`, errors_1.ErrorCategory.BUSINESS, errors_1.ErrorCode.CONFLICT, { name, storeId }, 409);
    }
}
exports.ProgramAlreadyExistsError = ProgramAlreadyExistsError;
class MemberAlreadyEnrolledError extends errors_1.AppError {
    constructor(customerId, programId) {
        super(`Customer ${customerId} is already enrolled in program ${programId}`, errors_1.ErrorCategory.BUSINESS, errors_1.ErrorCode.CONFLICT, { customerId, programId }, 409);
    }
}
exports.MemberAlreadyEnrolledError = MemberAlreadyEnrolledError;
class InvalidTierError extends errors_1.AppError {
    constructor(message) {
        super(message, errors_1.ErrorCategory.VALIDATION, errors_1.ErrorCode.INVALID_FIELD_VALUE, {}, 400);
    }
}
exports.InvalidTierError = InvalidTierError;
class DatabaseOperationError extends errors_1.AppError {
    constructor(operation, error) {
        super(`Database operation "${operation}" failed`, errors_1.ErrorCategory.DATABASE, errors_1.ErrorCode.DATABASE_ERROR, { error: error?.message }, 500, true // retryable
        );
    }
}
exports.DatabaseOperationError = DatabaseOperationError;
