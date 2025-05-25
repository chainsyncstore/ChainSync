/**
 * Loyalty Formatter
 * 
 * A formatter class for the Loyalty module that standardizes
 * conversion between database rows and domain objects.
 */
import { ResultFormatter } from '@shared/utils/service-helpers';
import { LoyaltyProgram, LoyaltyMember, LoyaltyTransaction, LoyaltyProgramStatus } from './types';

/**
 * Formatter for loyalty program data from database to domain objects
 */
export class LoyaltyProgramFormatter extends ResultFormatter<LoyaltyProgram> {
  /**
   * Format a single database result row into a LoyaltyProgram domain object
   * 
   * @param dbResult The raw database result row
   * @returns A properly formatted LoyaltyProgram object
   */
  formatResult(dbResult: Record<string, unknown>): LoyaltyProgram {
    if (!dbResult) {
      throw new Error('Cannot format null or undefined loyalty program result');
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
    
    // Format the loyalty program with specific type handling
    return {
      ...withDates,
      id: Number(withDates.id),
      storeId: Number(withDates.storeId),
      name: String(withDates.name),
      description: withDates.description || '',
      status: (withDates.status || 'active') as LoyaltyProgramStatus,
      pointsPerPurchase: Number(withDates.pointsPerPurchase || 0),
      minimumPurchase: String(withDates.minimumPurchase || '0.00'),
      pointsValue: String(withDates.pointsValue || '0.01'),
      tierLevels: withDates.tierLevels || [],
      rules: withDates.rules || {},
      isActive: Boolean(withDates.isActive),
      metadata: metadata
    };
  }
}

/**
 * Formatter for loyalty member data from database to domain objects
 */
export class LoyaltyMemberFormatter extends ResultFormatter<LoyaltyMember> {
  /**
   * Format a single database result row into a LoyaltyMember domain object
   * 
   * @param dbResult The raw database result row
   * @returns A properly formatted LoyaltyMember object
   */
  formatResult(dbResult: Record<string, unknown>): LoyaltyMember {
    if (!dbResult) {
      throw new Error('Cannot format null or undefined loyalty member result');
    }
    
    // First apply base formatting (snake_case to camelCase)
    const base = this.baseFormat(dbResult);
    
    // Parse metadata if present
    const metadata = this.handleMetadata(base.metadata);
    
    // Convert date strings to Date objects
    const withDates = this.formatDates(
      base, 
      ['createdAt', 'updatedAt', 'enrollmentDate', 'lastActivityDate']
    );
    
    // Format the loyalty member with specific type handling
    return {
      ...withDates,
      id: Number(withDates.id),
      programId: Number(withDates.programId),
      userId: Number(withDates.userId),
      membershipId: String(withDates.membershipId || ''),
      points: Number(withDates.points || 0),
      tierLevel: Number(withDates.tierLevel || 1),
      totalSpent: String(withDates.totalSpent || '0.00'),
      lifetimePoints: Number(withDates.lifetimePoints || 0),
      isActive: Boolean(withDates.isActive),
      metadata: metadata
    };
  }
}

/**
 * Formatter for loyalty transaction data from database to domain objects
 */
export class LoyaltyTransactionFormatter extends ResultFormatter<LoyaltyTransaction> {
  /**
   * Format a single database result row into a LoyaltyTransaction domain object
   * 
   * @param dbResult The raw database result row
   * @returns A properly formatted LoyaltyTransaction object
   */
  formatResult(dbResult: Record<string, unknown>): LoyaltyTransaction {
    if (!dbResult) {
      throw new Error('Cannot format null or undefined loyalty transaction result');
    }
    
    // First apply base formatting (snake_case to camelCase)
    const base = this.baseFormat(dbResult);
    
    // Parse metadata if present
    const metadata = this.handleMetadata(base.metadata);
    
    // Convert date strings to Date objects
    const withDates = this.formatDates(
      base, 
      ['createdAt', 'updatedAt', 'transactionDate']
    );
    
    // Format the loyalty transaction with specific type handling
    return {
      ...withDates,
      id: Number(withDates.id),
      memberId: Number(withDates.memberId),
      programId: Number(withDates.programId),
      pointsEarned: Number(withDates.pointsEarned || 0),
      pointsRedeemed: Number(withDates.pointsRedeemed || 0),
      pointsBalance: Number(withDates.pointsBalance || 0),
      transactionType: String(withDates.transactionType || 'earn'),
      referenceId: withDates.referenceId || null,
      description: withDates.description || '',
      amount: String(withDates.amount || '0.00'),
      metadata: metadata
    };
  }
}
