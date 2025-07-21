/**
 * Transaction Service Types
 * 
 * This file defines the interfaces and types for the transaction service.
 */

import { InferModel } from 'drizzle-orm';
import * as schema from '@shared/schema';

export type Transaction = InferModel<typeof schema.transactions>;
export type TransactionItem = InferModel<typeof schema.transactionItems>;
export type TransactionPayment = InferModel<typeof schema.transactionPayments>;

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
  storeId: number;
  customerId?: number;
  userId: number;
  type: TransactionType;
  subtotal: string;
  tax: string;
  discount?: string;
  total: string;
  paymentMethod: PaymentMethod;
  notes?: string;
  reference?: string;
  items: Array<{
    productId: number;
    quantity: number;
    unitPrice: string;
    discount?: string;
    notes?: string;
  }>;
  payments?: Array<{
    amount: string;
    method: PaymentMethod;
    reference?: string;
  }>;
  loyaltyPoints?: {
    earned: number;
    redeemed: number;
  };
}

export interface UpdateTransactionParams {
  userId: number;
  transactionId: number;
  customerId?: number;
  type?: TransactionType;
  status?: TransactionStatus;
  notes?: string;
  reference?: string;
}

export interface TransactionSearchParams {
  storeId: number;
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
  transactionId: number;
  customerId?: number;
  reason: string;
  userId: number;
  refundMethod: PaymentMethod;
  fullRefund?: boolean;
  items?: Array<{
    productId: number;
    transactionItemId: number;
    quantity: number;
    unitPrice: string;
    isRestocked?: boolean;
  }>;
  amount?: string;
  notes?: string;
}

export interface TransactionServiceErrors {
  TRANSACTION_NOT_FOUND: Error;
  TRANSACTION_ITEM_NOT_FOUND: Error;
  STORE_NOT_FOUND: Error;
  PRODUCT_NOT_FOUND: Error;
  CUSTOMER_NOT_FOUND: Error;
  USER_NOT_FOUND: Error;
  INVALID_REFUND: Error;
  INSUFFICIENT_STOCK: Error;
  PAYMENT_VALIDATION_FAILED: Error;
  INVALID_PAYMENT_AMOUNT: Error;
  INVALID_TRANSACTION_STATUS: Error;
  INVALID_REFUND_AMOUNT: Error;
}

export const TransactionServiceErrors: TransactionServiceErrors = {
  TRANSACTION_NOT_FOUND: new Error("Transaction not found"),
  TRANSACTION_ITEM_NOT_FOUND: new Error("Transaction item not found"),
  STORE_NOT_FOUND: new Error("Store not found"),
  PRODUCT_NOT_FOUND: new Error("Product not found"),
  CUSTOMER_NOT_FOUND: new Error("Customer not found"),
  USER_NOT_FOUND: new Error("User not found"),
  INVALID_REFUND: new Error("Invalid refund operation"),
  INSUFFICIENT_STOCK: new Error("Insufficient stock available"),
  PAYMENT_VALIDATION_FAILED: new Error("Payment validation failed"),
  INVALID_PAYMENT_AMOUNT: new Error("Invalid payment amount"),
  INVALID_TRANSACTION_STATUS: new Error("Invalid transaction status"),
  INVALID_REFUND_AMOUNT: new Error("Invalid refund amount")
};
