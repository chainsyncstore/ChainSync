'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.LoyaltyTransactionFormatter = exports.LoyaltyMemberFormatter = exports.LoyaltyProgramFormatter = void 0;
/**
 * Loyalty Formatter
 *
 * A formatter class for the Loyalty module that standardizes
 * conversion between database rows and domain objects.
 */
const service_helpers_1 = require('@shared/utils/service-helpers');
/**
 * Formatter for loyalty program data from database to domain objects
 */
class LoyaltyProgramFormatter extends service_helpers_1.ResultFormatter {
  /**
     * Format a single database result row into a LoyaltyProgram domain object
     *
     * @param dbResult The raw database result row
     * @returns A properly formatted LoyaltyProgram object
     */
  formatResult(dbResult) {
    if (!dbResult) {
      throw new Error('Cannot format null or undefined loyalty program result');
    }
    // First apply base formatting (snake_case to camelCase)
    const base = this.baseFormat(dbResult);
    // Parse metadata if present
    const metadata = this.handleMetadata(base.metadata);
    // Convert date strings to Date objects
    const withDates = this.formatDates(base, ['createdAt', 'updatedAt', 'startDate', 'endDate']);
    // Format the loyalty program with specific type handling
    return {
      ...withDates,
      id: Number(withDates.id),
      storeId: Number(withDates.storeId),
      name: String(withDates.name),
      description: withDates.description || '',
      active: Boolean(withDates.active)
    };
  }
}
exports.LoyaltyProgramFormatter = LoyaltyProgramFormatter;
/**
 * Formatter for loyalty member data from database to domain objects
 */
class LoyaltyMemberFormatter extends service_helpers_1.ResultFormatter {
  /**
     * Format a single database result row into a LoyaltyMember domain object
     *
     * @param dbResult The raw database result row
     * @returns A properly formatted LoyaltyMember object
     */
  formatResult(dbResult) {
    if (!dbResult) {
      throw new Error('Cannot format null or undefined loyalty member result');
    }
    // First apply base formatting (snake_case to camelCase)
    const base = this.baseFormat(dbResult);
    // Parse metadata if present
    const metadata = this.handleMetadata(base.metadata);
    // Convert date strings to Date objects
    const withDates = this.formatDates(base, ['createdAt', 'updatedAt', 'enrollmentDate', 'lastActivityDate']);
    // Format the loyalty member with specific type handling
    return {
      ...withDates,
      id: Number(withDates.id),
      programId: Number(withDates.programId),
      userId: Number(withDates.userId),
      loyaltyId: String(withDates.loyaltyId || ''),
      points: Number(withDates.points || 0),
      currentPoints: String(withDates.currentPoints || '0.00'),
      customerId: Number(withDates.customerId)
    };
  }
}
exports.LoyaltyMemberFormatter = LoyaltyMemberFormatter;
/**
 * Formatter for loyalty transaction data from database to domain objects
 */
class LoyaltyTransactionFormatter extends service_helpers_1.ResultFormatter {
  /**
     * Format a single database result row into a LoyaltyTransaction domain object
     *
     * @param dbResult The raw database result row
     * @returns A properly formatted LoyaltyTransaction object
     */
  formatResult(dbResult) {
    if (!dbResult) {
      throw new Error('Cannot format null or undefined loyalty transaction result');
    }
    // First apply base formatting (snake_case to camelCase)
    const base = this.baseFormat(dbResult);
    // Parse metadata if present
    const metadata = this.handleMetadata(base.metadata);
    // Convert date strings to Date objects
    const withDates = this.formatDates(base, ['createdAt', 'updatedAt', 'transactionDate']);
    // Format the loyalty transaction with specific type handling
    return {
      ...withDates,
      id: Number(withDates.id),
      memberId: Number(withDates.memberId),
      programId: Number(withDates.programId),
      pointsEarned: Number(withDates.pointsEarned || 0),
      pointsRedeemed: Number(withDates.pointsRedeemed || 0),
      pointsBalance: Number(withDates.pointsBalance || 0),
      transactionType: (withDates.transactionType || 'earn'),
      source: String(withDates.source || ''),
      transactionId: withDates.transactionId || null,
      description: withDates.description || ''
    };
  }
}
exports.LoyaltyTransactionFormatter = LoyaltyTransactionFormatter;
