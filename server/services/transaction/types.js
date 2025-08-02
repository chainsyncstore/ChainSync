'use strict';
/**
 * Transaction Service Types
 *
 * This file defines the interfaces and types for the transaction service.
 */
Object.defineProperty(exports, '__esModule', { _value: true });
exports.TransactionServiceErrors = exports.TransactionStatus = exports.TransactionType = exports.PaymentMethod = void 0;
let PaymentMethod;
(function(PaymentMethod) {
  PaymentMethod['CASH'] = 'cash';
  PaymentMethod['CREDIT_CARD'] = 'credit_card';
  PaymentMethod['DEBIT_CARD'] = 'debit_card';
  PaymentMethod['MOBILE_MONEY'] = 'mobile_money';
  PaymentMethod['BANK_TRANSFER'] = 'bank_transfer';
  PaymentMethod['STORE_CREDIT'] = 'store_credit';
  PaymentMethod['LOYALTY_POINTS'] = 'loyalty_points';
  PaymentMethod['OTHER'] = 'other';
})(PaymentMethod || (exports.PaymentMethod = PaymentMethod = {}));
let TransactionType;
(function(TransactionType) {
  TransactionType['SALE'] = 'SALE';
  TransactionType['RETURN'] = 'RETURN';
  TransactionType['REFUND'] = 'REFUND';
  TransactionType['EXCHANGE'] = 'EXCHANGE';
  TransactionType['LAYAWAY'] = 'LAYAWAY';
  TransactionType['PAYMENT'] = 'PAYMENT';
  TransactionType['DEPOSIT'] = 'DEPOSIT';
  TransactionType['WITHDRAWAL'] = 'WITHDRAWAL';
  TransactionType['ADJUSTMENT'] = 'ADJUSTMENT';
})(TransactionType || (exports.TransactionType = TransactionType = {}));
let TransactionStatus;
(function(TransactionStatus) {
  TransactionStatus['PENDING'] = 'pending';
  TransactionStatus['COMPLETED'] = 'completed';
  TransactionStatus['CANCELLED'] = 'cancelled';
  TransactionStatus['REFUNDED'] = 'refunded';
  TransactionStatus['PARTIALLY_REFUNDED'] = 'partially_refunded';
  TransactionStatus['FAILED'] = 'failed';
})(TransactionStatus || (exports.TransactionStatus = TransactionStatus = {}));
exports.TransactionServiceErrors = {
  _TRANSACTION_NOT_FOUND: new Error('Transaction not found'),
  _TRANSACTION_ITEM_NOT_FOUND: new Error('Transaction item not found'),
  _STORE_NOT_FOUND: new Error('Store not found'),
  _PRODUCT_NOT_FOUND: new Error('Product not found'),
  _CUSTOMER_NOT_FOUND: new Error('Customer not found'),
  _USER_NOT_FOUND: new Error('User not found'),
  _INVALID_REFUND: new Error('Invalid refund operation'),
  _INSUFFICIENT_STOCK: new Error('Insufficient stock available'),
  _PAYMENT_VALIDATION_FAILED: new Error('Payment validation failed'),
  _INVALID_PAYMENT_AMOUNT: new Error('Invalid payment amount'),
  _INVALID_TRANSACTION_STATUS: new Error('Invalid transaction status'),
  _INVALID_REFUND_AMOUNT: new Error('Invalid refund amount')
};
