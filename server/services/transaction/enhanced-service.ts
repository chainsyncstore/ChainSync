/**
 * Enhanced Transaction Service
 *
 * Refactored to use the enhanced base service, schema validation,
 * and formatter patterns for consistency and type safety.
 */
import { db } from '@server/db';
import { EnhancedBaseService } from '@server/services/base/enhanced-service';
import { transactionValidation } from '@shared/schema-validation';
import { sql } from 'drizzle-orm';

import { TransactionServiceErrors } from './errors';
import {
  TransactionFormatter,
  TransactionItemFormatter,
  TransactionPaymentFormatter,
} from './formatter';
import { ITransactionService } from './interface';
import {
  CreateTransactionParams,
  UpdateTransactionParams,
  Transaction,
  TransactionItem,
  TransactionPayment,
  CreateTransactionItemParams,
  UpdateTransactionItemParams,
  CreateTransactionPaymentParams,
  UpdateTransactionPaymentParams,
} from './types';

export class EnhancedTransactionService extends EnhancedBaseService implements ITransactionService {
  private formatter = new TransactionFormatter();
  private itemFormatter = new TransactionItemFormatter();
  private paymentFormatter = new TransactionPaymentFormatter();

  async createTransaction(params: CreateTransactionParams): Promise<Transaction> {
    try {
      const validated = transactionValidation.insert(params);
      const tx = await this.rawInsertWithFormatting(
        'transactions',
        validated,
        this.formatter.formatResult.bind(this.formatter)
      );
      return this.ensureExists(tx, 'Transaction');
    } catch (error: unknown) {
      return this.handleError(error, 'creating transaction');
    }
  }

  async updateTransaction(id: number, params: UpdateTransactionParams): Promise<Transaction> {
    try {
      const validated = transactionValidation.update(params);
      const tx = await this.rawUpdateWithFormatting(
        'transactions',
        validated,
        `id = ${id}`,
        this.formatter.formatResult.bind(this.formatter)
      );
      return this.ensureExists(tx, 'Transaction');
    } catch (error: unknown) {
      return this.handleError(error, 'updating transaction');
    }
  }

  async getTransactionById(id: number): Promise<Transaction | null> {
    try {
      const query = `SELECT * FROM transactions WHERE id = ${id}`;
      return await this.executeSqlWithFormatting(
        query,
        [],
        this.formatter.formatResult.bind(this.formatter)
      );
    } catch (error: unknown) {
      return this.handleError(error, 'getting transaction by id');
    }
  }

  async createTransactionItem(params: CreateTransactionItemParams): Promise<TransactionItem> {
    try {
      const validated = transactionValidation.itemInsert(params);
      const item = await this.rawInsertWithFormatting(
        'transaction_items',
        validated,
        this.itemFormatter.formatResult.bind(this.itemFormatter)
      );
      return this.ensureExists(item, 'Transaction Item');
    } catch (error: unknown) {
      return this.handleError(error, 'creating transaction item');
    }
  }

  async updateTransactionItem(
    id: number,
    params: UpdateTransactionItemParams
  ): Promise<TransactionItem> {
    try {
      const validated = transactionValidation.itemUpdate(params);
      const item = await this.rawUpdateWithFormatting(
        'transaction_items',
        validated,
        `id = ${id}`,
        this.itemFormatter.formatResult.bind(this.itemFormatter)
      );
      return this.ensureExists(item, 'Transaction Item');
    } catch (error: unknown) {
      return this.handleError(error, 'updating transaction item');
    }
  }

  async createTransactionPayment(
    params: CreateTransactionPaymentParams
  ): Promise<TransactionPayment> {
    try {
      const validated = transactionValidation.paymentInsert(params);
      const payment = await this.rawInsertWithFormatting(
        'transaction_payments',
        validated,
        this.paymentFormatter.formatResult.bind(this.paymentFormatter)
      );
      return this.ensureExists(payment, 'Transaction Payment');
    } catch (error: unknown) {
      return this.handleError(error, 'creating transaction payment');
    }
  }

  async updateTransactionPayment(
    id: number,
    params: UpdateTransactionPaymentParams
  ): Promise<TransactionPayment> {
    try {
      const validated = transactionValidation.paymentUpdate(params);
      const payment = await this.rawUpdateWithFormatting(
        'transaction_payments',
        validated,
        `id = ${id}`,
        this.paymentFormatter.formatResult.bind(this.paymentFormatter)
      );
      return this.ensureExists(payment, 'Transaction Payment');
    } catch (error: unknown) {
      return this.handleError(error, 'updating transaction payment');
    }
  }

  // Additional methods for fetching items/payments by transaction can be added similarly
}
