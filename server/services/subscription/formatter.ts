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
  // Ensure type compatibility with Subscription type from schema
  formatResult(dbResult: Record<string, any>): Subscription {
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
      createdAt: withDates.createdAt ? new Date(withDates.createdAt) : new Date(),
      updatedAt: withDates.updatedAt ? new Date(withDates.updatedAt) : new Date(),
      deletedAt: withDates.deletedAt ? new Date(withDates.deletedAt) : null,
      userId: Number(withDates.userId),
      plan: String(withDates.plan),
      status: (withDates.status || 'active') as SubscriptionStatus,
      amount: String(withDates.amount),
      currency: String(withDates.currency || 'NGN'),
      referralCode: typeof withDates.referralCode === 'string' ? withDates.referralCode : '',
      discountApplied: typeof withDates.discountApplied === 'boolean' ? withDates.discountApplied : false,
      discountAmount: typeof withDates.discountAmount === 'string' ? withDates.discountAmount : '0.00',
      startDate: withDates.startDate instanceof Date ? withDates.startDate : new Date(withDates.startDate),
      endDate: withDates.endDate instanceof Date ? withDates.endDate : new Date(withDates.endDate),
      autoRenew: typeof withDates.autoRenew === 'boolean' ? withDates.autoRenew : false,
      paymentProvider: typeof withDates.paymentProvider === 'string' ? withDates.paymentProvider : '',
      paymentReference: typeof withDates.paymentReference === 'string' ? withDates.paymentReference : '',
      metadata: metadata ?? {}
    };
  }
}
