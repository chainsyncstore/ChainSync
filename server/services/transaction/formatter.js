"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionPaymentFormatter = exports.TransactionItemFormatter = exports.TransactionFormatter = void 0;
/**
 * Transaction Formatter
 *
 * A formatter class for the Transaction module that standardizes
 * conversion between database rows and domain objects.
 */
const service_helpers_1 = require("@shared/utils/service-helpers");
/**
 * Formatter for transaction data from database to domain objects
 */
class TransactionFormatter extends service_helpers_1.ResultFormatter {
    /**
     * Format a single database result row into a Transaction domain object
     *
     * @param dbResult The raw database result row
     * @returns A properly formatted Transaction object
     */
    formatResult(dbResult) {
        if (!dbResult) {
            throw new Error('Cannot format null or undefined transaction result');
        }
        // First apply base formatting (snake_case to camelCase)
        const base = this.baseFormat(dbResult);
        // Parse metadata if present
        const metadata = this.handleMetadata(base.metadata);
        // Convert date strings to Date objects
        const withDates = this.formatDates(base, ['createdAt', 'updatedAt', 'transactionDate', 'completedAt']);
        // Format the transaction with specific type handling
        return {
            ...withDates,
            id: Number(withDates.id),
            storeId: Number(withDates.storeId),
            userId: Number(withDates.userId),
            customerId: Number(withDates.customerId || null),
            status: (withDates.status || 'pending'),
            subtotal: String(withDates.subtotal || '0.00'),
            tax: String(withDates.tax || '0.00'),
            discount: String(withDates.discount || '0.00'),
            total: String(withDates.total || '0.00'),
            paymentMethod: (withDates.paymentMethod || 'cash'),
            items: withDates.items || null,
        };
    }
}
exports.TransactionFormatter = TransactionFormatter;
/**
 * Formatter for transaction item data from database to domain objects
 */
class TransactionItemFormatter extends service_helpers_1.ResultFormatter {
    /**
     * Format a single database result row into a TransactionItem domain object
     *
     * @param dbResult The raw database result row
     * @returns A properly formatted TransactionItem object
     */
    formatResult(dbResult) {
        if (!dbResult) {
            throw new Error('Cannot format null or undefined transaction item result');
        }
        // First apply base formatting (snake_case to camelCase)
        const base = this.baseFormat(dbResult);
        // Parse metadata if present
        const metadata = this.handleMetadata(base.metadata);
        // Convert date strings to Date objects
        const withDates = this.formatDates(base, ['createdAt', 'updatedAt']);
        // Format the transaction item with specific type handling
        return {
            ...withDates,
            id: Number(withDates.id),
            transactionId: Number(withDates.transactionId),
            productId: Number(withDates.productId),
            quantity: Number(withDates.quantity || 0),
            unitPrice: String(withDates.unitPrice || '0.00'),
        };
    }
}
exports.TransactionItemFormatter = TransactionItemFormatter;
/**
 * Formatter for transaction payment data from database to domain objects
 */
class TransactionPaymentFormatter extends service_helpers_1.ResultFormatter {
    /**
     * Format a single database result row into a TransactionPayment domain object
     *
     * @param dbResult The raw database result row
     * @returns A properly formatted TransactionPayment object
     */
    formatResult(dbResult) {
        if (!dbResult) {
            throw new Error('Cannot format null or undefined transaction payment result');
        }
        // First apply base formatting (snake_case to camelCase)
        const base = this.baseFormat(dbResult);
        // Parse metadata if present
        const metadata = this.handleMetadata(base.metadata);
        // Convert date strings to Date objects
        const withDates = this.formatDates(base, ['createdAt', 'updatedAt', 'paymentDate', 'settledAt']);
        // Format the transaction payment with specific type handling
        return {
            ...withDates,
            id: Number(withDates.id),
            transactionId: Number(withDates.transactionId),
            amount: String(withDates.amount || '0.00'),
            method: (withDates.method || 'cash'),
        };
    }
}
exports.TransactionPaymentFormatter = TransactionPaymentFormatter;
