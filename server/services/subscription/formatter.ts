/**
 * Subscription Formatter
 *
 * A formatter class for the Subscription module that standardizes
 * conversion between database rows and domain objects.
 */
import { ResultFormatter } from '@shared/utils/service-helpers';
import { SelectSubscription, SubscriptionStatus } from './types';

/**
 * Formatter for subscription data from database to domain objects
 */
export class SubscriptionFormatter extends ResultFormatter<SelectSubscription> {
  /**
   * Format a single database result row into a Subscription domain object
   *
   * @param dbResult The raw database result row
   * @returns A properly formatted Subscription object
   */
  formatResult(_dbResult: Record<string, unknown>): SelectSubscription {
    if (!dbResult) {
      throw new Error('Cannot format null or undefined subscription result');
    }

    // First apply base formatting (snake_case to camelCase)
    const base = this.baseFormat(dbResult);

    // Parse metadata if present
    const metadata = this.handleMetadata(base.metadata);

    // Convert date strings to Date objects
    const withDates = this.formatDates(
      base,
      ['createdAt', 'updatedAt', 'startDate', 'endDate']
    );

    // Format the subscription with specific type handling
    return {
      ...withDates,
      _id: Number(withDates.id),
      _userId: Number(withDates.userId),
      _planId: String(withDates.planId),
      _status: (withDates.status || 'active') as 'active' | 'cancelled' | 'expired' | null,
      _amount: String(withDates.amount),
      _currency: String(withDates.currency || 'NGN'),
      _referralCode: withDates.referralCode || '',
      _autoRenew: Boolean(withDates.autoRenew),
      _paymentMethod: String(withDates.paymentMethod || ''),
      _metadata: metadata,
      _currentPeriodStart: withDates.currentPeriodStart,
      _currentPeriodEnd: withDates.currentPeriodEnd,
      _endDate: withDates.endDate,
      _createdAt: withDates.createdAt,
      _updatedAt: withDates.updatedAt
    };
  }
}
