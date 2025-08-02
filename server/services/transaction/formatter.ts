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
  formatResult(_dbResult: Record<string, unknown>): Transaction {
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
      _id: Number(withDates.id),
      _storeId: Number(withDates.storeId),
      _userId: Number(withDates.userId),
      _customerId: Number(withDates.customerId || null),
      _status: (withDates.status || 'pending') as 'pending' | 'completed' | 'cancelled' | null,
      _subtotal: String(withDates.subtotal || '0.00'),
      _tax: String(withDates.tax || '0.00'),
      _discount: String(withDates.discount || '0.00'),
      _total: String(withDates.total || '0.00'),
      _paymentMethod: (withDates.paymentMethod || 'cash') as 'cash' | 'card' | 'mobile',
      _items: withDates.items || null
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
  formatResult(_dbResult: Record<string, unknown>): TransactionItem {
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
      _id: Number(withDates.id),
      _transactionId: Number(withDates.transactionId),
      _productId: Number(withDates.productId),
      _quantity: Number(withDates.quantity || 0),
      _unitPrice: String(withDates.unitPrice || '0.00')
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
  formatResult(_dbResult: Record<string, unknown>): TransactionPayment {
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
      _id: Number(withDates.id),
      _transactionId: Number(withDates.transactionId),
      _amount: String(withDates.amount || '0.00'),
      _method: (withDates.method || 'cash') as 'cash' | 'card' | 'mobile'
    } as TransactionPayment;
  }
}
