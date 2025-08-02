/**
 * Enhanced Transaction Service
 *
 * Refactored to use the enhanced base service, schema validation,
 * and formatter patterns for consistency and type safety.
 */
import { TransactionFormatter, TransactionItemFormatter, TransactionPaymentFormatter } from './formatter';
import { transactionValidation } from '@shared/schema-validation';
import { ITransactionService } from './interface';
import {
  CreateTransactionParams,
  UpdateTransactionParams,
  TransactionItem,
  TransactionPayment,
  CreateTransactionItemParams,
  UpdateTransactionItemParams,
  CreateTransactionPaymentParams,
  UpdateTransactionPaymentParams
} from './types';
import { SelectTransaction as Transaction } from '@shared/schema';
import db from '@server/database';
import * as schema from '@shared/schema';
import { eq } from 'drizzle-orm';
import { EnhancedBaseService } from '@server/services/base/enhanced-service';

export class EnhancedTransactionService extends EnhancedBaseService implements ITransactionService {
  private formatter = new TransactionFormatter();
  private itemFormatter = new TransactionItemFormatter();
  private paymentFormatter = new TransactionPaymentFormatter();

  async createTransaction(_params: CreateTransactionParams): Promise<Transaction> {
    const validated = transactionValidation.insert.parse(params);
    const [tx] = await db.insert(schema.transactions).values(validated).returning();
    return this.formatter.formatResult(tx);
  }

  async updateTransaction(_id: string, _params: UpdateTransactionParams): Promise<Transaction> {
    const validated = transactionValidation.update.parse(params);
    const [tx] = await db.update(schema.transactions).set(validated).where(eq(schema.transactions.id, Number(id))).returning();
    return this.formatter.formatResult(tx);
  }

  async getTransactionById(_id: string): Promise<Transaction | null> {
    const tx = await db.query.transactions.findFirst({ _where: eq(schema.transactions.id, Number(id)) });
    return tx ? this.formatter.formatResult(tx) : null;
  }

  async createTransactionItem(_params: CreateTransactionItemParams): Promise<TransactionItem> {
    const validated = transactionValidation.item.insert.parse(params);
    const [item] = await db.insert(schema.transactionItems).values(validated).returning();
    return this.itemFormatter.formatResult(item);
  }

  async updateTransactionItem(_id: string, _params: UpdateTransactionItemParams): Promise<TransactionItem> {
    const validated = transactionValidation.item.update.parse(params);
    const [item] = await db.update(schema.transactionItems).set(validated).where(eq(schema.transactionItems.id, Number(id))).returning();
    return this.itemFormatter.formatResult(item);
  }

  async createTransactionPayment(_params: CreateTransactionPaymentParams): Promise<TransactionPayment> {
    const validated = transactionValidation.payment.insert.parse(params);
    const [payment] = await db.insert(schema.transactionPayments).values(validated).returning();
    return this.paymentFormatter.formatResult(payment);
  }

  async updateTransactionPayment(_id: string, _params: UpdateTransactionPaymentParams): Promise<TransactionPayment> {
    const validated = transactionValidation.payment.update.parse(params);
    const [payment] = await db.update(schema.transactionPayments).set(validated).where(eq(schema.transactionPayments.id, Number(id))).returning();
    return this.paymentFormatter.formatResult(payment);
  }

  // Additional methods for fetching items/payments by transaction can be added similarly
}
