/**
 * Subscription Formatter
 * 
 * A formatter class for the Subscription module that standardizes
 * conversion between database rows and domain objects.
 */
import { ResultFormatter } from '@shared/utils/service-helpers';
import { Subscription, SubscriptionStatus } from './types';

/**
 * Formatter for subscription data from database to domain objects
 */
export class SubscriptionFormatter extends ResultFormatter<Subscription> {
  /**
   * Format a single database result row into a Subscription domain object
   * 
   * @param dbResult The raw database result row
   * @returns A properly formatted Subscription object
   */
  formatResult(dbResult: Record<string, unknown>): Subscription {
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
      plan: String(withDates.plan),
      status: (withDates.status || 'active') as SubscriptionStatus,
      amount: String(withDates.amount),
      currency: String(withDates.currency || 'NGN'),
      referralCode: withDates.referralCode || '',
      discountApplied: Boolean(withDates.discountApplied),
      discountAmount: String(withDates.discountAmount || '0.00'),
      autoRenew: Boolean(withDates.autoRenew),
      paymentProvider: String(withDates.paymentProvider || ''),
      paymentReference: withDates.paymentReference || '',
      metadata: metadata
    };
  }
}
