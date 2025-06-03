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
      // ...withDates, // Spread only known properties after explicit mapping
      id: Number(withDates.id),
      storeId: Number(withDates.storeId),
      name: String(withDates.name),
      description: String(withDates.description || ''),
      status: (withDates.status || 'active') as LoyaltyProgramStatus,
      createdAt: new Date(withDates.createdAt),
      updatedAt: new Date(withDates.updatedAt),
      // Removed: pointsPerPurchase, minimumPurchase, pointsValue, tierLevels, rules, isActive
      // These should be in metadata if needed, or the LoyaltyProgram interface updated.
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
      // ...withDates, // Spread only known properties after explicit mapping
      id: Number(withDates.id),
      loyaltyId: String(withDates.loyaltyId || ''), // Ensure loyaltyId is mapped
      customerId: Number(withDates.customerId), // Changed from userId
      programId: Number(withDates.programId),
      tierId: withDates.tierId ? Number(withDates.tierId) : null, // Changed from tierLevel
      points: Number(withDates.points || 0),
      lifetimePoints: Number(withDates.lifetimePoints || withDates.points || 0), // Default lifetimePoints to points if not available
      status: (withDates.status || 'active') as LoyaltyMember['status'], // Changed from isActive
      enrollmentDate: new Date(withDates.enrollmentDate || withDates.createdAt), // Default to createdAt if enrollmentDate not present
      lastActivityDate: new Date(withDates.lastActivityDate || withDates.updatedAt), // Default to updatedAt if lastActivityDate not present
      createdAt: new Date(withDates.createdAt),
      updatedAt: new Date(withDates.updatedAt),
      // Removed: membershipId (use loyaltyId), tierLevel (use tierId), totalSpent, isActive
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
      // ...withDates, // Spread only known properties after explicit mapping
      id: Number(withDates.id),
      memberId: Number(withDates.memberId),
      programId: Number(withDates.programId),
      transactionId: withDates.transactionId ? Number(withDates.transactionId) : null, // Map from referenceId or transaction_id
      type: (withDates.type || 'earn') as LoyaltyTransaction['type'], // Changed from transactionType
      points: Number(withDates.points || 0), // Use points directly
      notes: withDates.notes || String(withDates.description || ''), // Map from description or notes
      rewardId: withDates.rewardId ? Number(withDates.rewardId) : null,
      userId: Number(withDates.userId), // Assuming userId is present in dbResult
      createdAt: new Date(withDates.createdAt),
      // Removed: pointsEarned, pointsRedeemed, pointsBalance, amount, metadata (unless added to interface)
      // Ensure all fields in LoyaltyTransaction interface are covered
    };
  }
}
