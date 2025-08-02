/**
 * Transaction Formatter
 *
 * A formatter class for the Transaction module that standardizes
 * conversion between database rows and domain objects.
 */
import { ResultFormatter } from '@shared/utils/service-helpers';
import {
  TransactionItem,
  TransactionPayment,
  TransactionStatus,
  PaymentMethod
} from './types';
import { SelectTransaction as Transaction } from '@shared/schema';

/**
 * Formatter for transaction data from database to domain objects
 */
export class TransactionFormatter extends ResultFormatter<Transaction> {
  /**
   * Format a single database result row into a Transaction domain object
   *
   * @param dbResult The raw database result row
   * @returns A properly formatted Transaction object
   */
  formatResult(dbResult: Record<string, unknown>): Transaction {
    if (!dbResult) {
      throw new Error('Cannot format null or undefined transaction result');
    }

    // First apply base formatting (snake_case to camelCase)
    const base = this.baseFormat(dbResult);

    // Parse metadata if present
    const metadata = this.handleMetadata(base.metadata);

    // Convert date strings to Date objects
    const withDates = this.formatDates(
      base,
      ['createdAt', 'updatedAt', 'transactionDate', 'completedAt']
    );

    // Format the transaction with specific type handling
    return {
      ...withDates,
      id: Number(withDates.id),
      storeId: Number(withDates.storeId),
      userId: Number(withDates.userId),
      customerId: Number(withDates.customerId || null),
      status: (withDates.status || 'pending') as 'pending' | 'completed' | 'cancelled' | null,
      subtotal: String(withDates.subtotal || '0.00'),
      tax: String(withDates.tax || '0.00'),
      discount: String(withDates.discount || '0.00'),
      total: String(withDates.total || '0.00'),
      paymentMethod: (withDates.paymentMethod || 'cash') as 'cash' | 'card' | 'mobile',
      items: withDates.items || null
    } as Transaction;
  }
}

/**
 * Formatter for transaction item data from database to domain objects
 */
export class TransactionItemFormatter extends ResultFormatter<TransactionItem> {
  /**
   * Format a single database result row into a TransactionItem domain object
   *
   * @param dbResult The raw database result row
   * @returns A properly formatted TransactionItem object
   */
  formatResult(dbResult: Record<string, unknown>): TransactionItem {
    if (!dbResult) {
      throw new Error('Cannot format null or undefined transaction item result');
    }

    // First apply base formatting (snake_case to camelCase)
    const base = this.baseFormat(dbResult);

    // Parse metadata if present
    const metadata = this.handleMetadata(base.metadata);

    // Convert date strings to Date objects
    const withDates = this.formatDates(
      base,
      ['createdAt', 'updatedAt']
    );

    // Format the transaction item with specific type handling
    return {
      ...withDates,
      id: Number(withDates.id),
      transactionId: Number(withDates.transactionId),
      productId: Number(withDates.productId),
      quantity: Number(withDates.quantity || 0),
      unitPrice: String(withDates.unitPrice || '0.00')
    } as TransactionItem;
  }
}

/**
 * Formatter for transaction payment data from database to domain objects
 */
export class TransactionPaymentFormatter extends ResultFormatter<TransactionPayment> {
  /**
   * Format a single database result row into a TransactionPayment domain object
   *
   * @param dbResult The raw database result row
   * @returns A properly formatted TransactionPayment object
   */
  formatResult(dbResult: Record<string, unknown>): TransactionPayment {
    if (!dbResult) {
      throw new Error('Cannot format null or undefined transaction payment result');
    }

    // First apply base formatting (snake_case to camelCase)
    const base = this.baseFormat(dbResult);

    // Parse metadata if present
    const metadata = this.handleMetadata(base.metadata);

    // Convert date strings to Date objects
    const withDates = this.formatDates(
      base,
      ['createdAt', 'updatedAt', 'paymentDate', 'settledAt']
    );

    // Format the transaction payment with specific type handling
    return {
      ...withDates,
      id: Number(withDates.id),
      transactionId: Number(withDates.transactionId),
      amount: String(withDates.amount || '0.00'),
      method: (withDates.method || 'cash') as 'cash' | 'card' | 'mobile'
    } as TransactionPayment;
  }
}
