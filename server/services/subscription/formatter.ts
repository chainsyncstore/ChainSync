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
  formatResult(dbResult: Record<string, unknown>): SelectSubscription {
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
      id: Number(withDates.id),
      userId: Number(withDates.userId),
      planId: String(withDates.planId),
      status: (withDates.status || 'active') as 'active' | 'cancelled' | 'expired' | null,
      amount: String(withDates.amount),
      currency: String(withDates.currency || 'NGN'),
      referralCode: withDates.referralCode || '',
      autoRenew: Boolean(withDates.autoRenew),
      paymentMethod: String(withDates.paymentMethod || ''),
      metadata: metadata,
      currentPeriodStart: withDates.currentPeriodStart,
      currentPeriodEnd: withDates.currentPeriodEnd,
      endDate: withDates.endDate,
      createdAt: withDates.createdAt,
      updatedAt: withDates.updatedAt
    };
  }
}
