/**
 * Transaction Formatter
 * 
 * A formatter class for the Transaction module that standardizes
 * conversion between database rows and domain objects.
 */
import { ResultFormatter } from '@shared/utils/service-helpers';
import { 
  Transaction, 
  TransactionItem, 
  TransactionPayment, 
  TransactionStatus,
  PaymentStatus,
  PaymentMethod
} from './types';

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
      cashierId: Number(withDates.cashierId || null),
      customerName: withDates.customerName || '',
      customerEmail: withDates.customerEmail || '',
      customerPhone: withDates.customerPhone || '',
      transactionNumber: String(withDates.transactionNumber),
      status: (withDates.status || 'pending') as TransactionStatus,
      subtotal: String(withDates.subtotal || '0.00'),
      tax: String(withDates.tax || '0.00'),
      discount: String(withDates.discount || '0.00'),
      total: String(withDates.total || '0.00'),
      notes: withDates.notes || '',
      channel: withDates.channel || 'in-store',
      deviceId: withDates.deviceId || null,
      reference: withDates.reference || null,
      metadata: metadata
    };
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
      inventoryItemId: Number(withDates.inventoryItemId || null),
      name: String(withDates.name),
      description: withDates.description || '',
      sku: String(withDates.sku || ''),
      quantity: Number(withDates.quantity || 0),
      unit: withDates.unit || 'each',
      unitPrice: String(withDates.unitPrice || '0.00'),
      subtotal: String(withDates.subtotal || '0.00'),
      tax: String(withDates.tax || '0.00'),
      discount: String(withDates.discount || '0.00'),
      total: String(withDates.total || '0.00'),
      notes: withDates.notes || '',
      metadata: metadata
    };
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
      method: (withDates.method || 'cash') as PaymentMethod,
      status: (withDates.status || 'pending') as PaymentStatus,
      reference: withDates.reference || '',
      authorizationCode: withDates.authorizationCode || '',
      receiptNumber: withDates.receiptNumber || '',
      paymentProcessor: withDates.paymentProcessor || '',
      processorTransactionId: withDates.processorTransactionId || null,
      notes: withDates.notes || '',
      metadata: metadata
    };
  }
}
