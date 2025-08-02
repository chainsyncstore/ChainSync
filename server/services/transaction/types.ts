/**
 * Transaction Service Types
 *
 * This file defines the interfaces and types for the transaction service.
 */

import { InferSelectModel } from 'drizzle-orm';
import * as schema from '@shared/schema';

export type SelectTransaction = InferSelectModel<typeof schema.transactions>;
export type TransactionItem = InferSelectModel<typeof schema.transactionItems>;
export type TransactionPayment = InferSelectModel<typeof schema.transactionPayments>;

export enum PaymentMethod {
  CASH = 'cash',
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  MOBILE_MONEY = 'mobile_money',
  BANK_TRANSFER = 'bank_transfer',
  STORE_CREDIT = 'store_credit',
  LOYALTY_POINTS = 'loyalty_points',
  OTHER = 'other'
}

export enum TransactionType {
  SALE = 'SALE',
  RETURN = 'RETURN',
  REFUND = 'REFUND',
  EXCHANGE = 'EXCHANGE',
  LAYAWAY = 'LAYAWAY',
  PAYMENT = 'PAYMENT',
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  ADJUSTMENT = 'ADJUSTMENT'
}

export type CreateTransactionItemParams = Omit<TransactionItem, 'id' | 'transactionId' | 'createdAt' | 'updatedAt'>;
export type UpdateTransactionItemParams = Partial<CreateTransactionItemParams>;
export type CreateTransactionPaymentParams = Omit<TransactionPayment, 'id' | 'transactionId' | 'createdAt' | 'updatedAt'>;
export type UpdateTransactionPaymentParams = Partial<CreateTransactionPaymentParams>;

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
  FAILED = 'failed'
}

export interface CreateTransactionParams {
  _storeId: number;
  customerId?: number;
  _userId: number;
  _type: TransactionType;
  _subtotal: string;
  _tax: string;
  discount?: string;
  _total: string;
  _paymentMethod: PaymentMethod;
  notes?: string;
  reference?: string;
  _items: Array<{
    _productId: number;
    _quantity: number;
    _unitPrice: string;
    discount?: string;
    notes?: string;
  }>;
  payments?: Array<{
    _amount: string;
    _method: PaymentMethod;
    reference?: string;
  }>;
  loyaltyPoints?: {
    _earned: number;
    _redeemed: number;
  };
}

export interface UpdateTransactionParams {
  _userId: number;
  _transactionId: number;
  customerId?: number;
  type?: TransactionType;
  status?: TransactionStatus;
  notes?: string;
  reference?: string;
}

export interface TransactionSearchParams {
  _storeId: number;
  keyword?: string;
  startDate?: Date;
  endDate?: Date;
  customerId?: number;
  userId?: number;
  type?: TransactionType;
  status?: TransactionStatus;
  paymentMethod?: PaymentMethod;
  minAmount?: string;
  maxAmount?: string;
  reference?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface RefundParams {
  _transactionId: number;
  customerId?: number;
  _reason: string;
  _userId: number;
  _refundMethod: PaymentMethod;
  fullRefund?: boolean;
  items?: Array<{
    _productId: number;
    _transactionItemId: number;
    _quantity: number;
    _unitPrice: string;
    isRestocked?: boolean;
  }>;
  amount?: string;
  notes?: string;
}

export interface TransactionServiceErrors {
  _TRANSACTION_NOT_FOUND: Error;
  _TRANSACTION_ITEM_NOT_FOUND: Error;
  _STORE_NOT_FOUND: Error;
  _PRODUCT_NOT_FOUND: Error;
  _CUSTOMER_NOT_FOUND: Error;
  _USER_NOT_FOUND: Error;
  _INVALID_REFUND: Error;
  _INSUFFICIENT_STOCK: Error;
  _PAYMENT_VALIDATION_FAILED: Error;
  _INVALID_PAYMENT_AMOUNT: Error;
  _INVALID_TRANSACTION_STATUS: Error;
  _INVALID_REFUND_AMOUNT: Error;
}

export const _TransactionServiceErrors: TransactionServiceErrors = {
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
