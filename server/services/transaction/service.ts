/**
 * Transaction Service Implementation
 *
 * This file implements a standardized transaction service with proper schema validation
 * and error handling according to our schema style guide.
 */

import { BaseService } from '../base/service';
import {
  TransactionServiceErrors,
  CreateTransactionParams,
  UpdateTransactionParams,
  TransactionSearchParams,
  RefundParams,
  PaymentMethod,
  TransactionType,
  TransactionStatus,
  CreateTransactionItemParams,
  CreateTransactionPaymentParams,
  TransactionItem,
  TransactionPayment,
  UpdateTransactionItemParams,
  UpdateTransactionPaymentParams,
  SelectTransaction
} from './types';
import { AppError, ErrorCode, ErrorCategory } from '../../../shared/types/errors.js';
import { ITransactionService } from './interface';
import { db } from '../../../db/index.js';
import * as schema from '../../../shared/schema.js';
import { eq, and, or, like, gte, lte, desc, asc, sql, between, inArray } from 'drizzle-orm';
import { transactionValidation, SchemaValidationError } from '../../../shared/schema-validation.js';
import { InventoryTransactionType } from '../inventory/types';

// Import required services
import { InventoryService } from '../inventory/service';
import { LoyaltyService } from '../loyalty/service';

// Import the logging system
import { Logger, LogLevel, createLogger } from '../../../src/logging/index.js';

export class TransactionService extends BaseService implements ITransactionService {
  private _inventoryService: InventoryService;
  private _loyaltyService: LoyaltyService;
  private _logger: Logger;

  constructor() {
    super();
    this.inventoryService = new InventoryService();
    this.loyaltyService = new LoyaltyService();

    // Create a logger with service context
    this.logger = createLogger({
      _service: 'TransactionService',
      _component: 'transaction'
    });
  }
  createTransactionItem(_params: CreateTransactionItemParams): Promise<TransactionItem> {
    throw new Error('Method not implemented.');
  }
  updateTransactionItem(_id: string, _params: UpdateTransactionItemParams): Promise<TransactionItem> {
    throw new Error('Method not implemented.');
  }
  createTransactionPayment(_params: CreateTransactionPaymentParams): Promise<TransactionPayment> {
    throw new Error('Method not implemented.');
  }
  updateTransactionPayment(_id: string, _params: UpdateTransactionPaymentParams): Promise<TransactionPayment> {
    throw new Error('Method not implemented.');
  }

  /**
   * Set a custom logger (useful for testing or external configuration)
   */
  setLogger(_logger: Logger): void {
    this.logger = logger;
  }

  /**
   * Create a new transaction with validated data
   */
  async createTransaction(_params: CreateTransactionParams): Promise<SelectTransaction> {
    try {
      // Verify store exists
      const store = await db.query.stores.findFirst({
        _where: eq(schema.stores.id, params.storeId)
      });

      if (!store) {
        throw TransactionServiceErrors.STORE_NOT_FOUND;
      }

      // Verify user exists
      const user = await db.query.users.findFirst({
        _where: eq(schema.users.id, params.userId)
      });

      if (!user) {
        throw TransactionServiceErrors.USER_NOT_FOUND;
      }

      // Verify customer exists if provided
      if (params.customerId) {
        const customer = await db.query.users.findFirst({
          _where: eq(schema.users.id, params.customerId)
        });

        if (!customer) {
          throw TransactionServiceErrors.CUSTOMER_NOT_FOUND;
        }
      }

      // Verify products exist and calculate totals
      const productIds = params.items.map(item => item.productId);
      const products = await db.query.products.findMany({
        _where: inArray(schema.products.id, productIds),
        _with: {
          _inventory: true
        }
      });

      // Ensure all products exist
      if (products.length !== productIds.length) {
        throw TransactionServiceErrors.PRODUCT_NOT_FOUND;
      }

      // Create product lookup map for faster access
      const productMap = new Map<number, schema.SelectProduct & { _inventory: schema.SelectInventory | null
  }>();
      products.forEach(product => productMap.set(product.id, product));

      // Validate stock availability if this is a sale
      if (params.type === TransactionType.SALE) {
        for (const item of params.items) {
          const product = productMap.get(item.productId);
          const inventory = (product as any)?.inventory;

          if (!inventory || inventory.quantity < item.quantity) {
            throw TransactionServiceErrors.INSUFFICIENT_STOCK;
          }
        }
      }

      // Generate transaction reference if not provided
      if (!params.reference) {
        params.reference = `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      }

      // Start a transaction to ensure data integrity
      return await db.transaction(async(tx) => {
        const validatedTransactionData = transactionValidation.insert.parse(params) as typeof schema.transactions.$inferInsert;

        const [transaction] = await tx.insert(schema.transactions)
          .values(validatedTransactionData)
          .returning();

        if (!transaction) {
          throw new Error('Failed to create transaction');
        }

        for (const item of params.items) {
          const product = productMap.get(item.productId);

          // Prepare item data
          const itemData = {
            _transactionId: transaction.id,
            _productId: item.productId,
            _quantity: item.quantity,
            _unitPrice: item.unitPrice,
            _discount: item.discount || '0.00',
            _subtotal: (parseFloat(item.unitPrice) * item.quantity).toFixed(2),
            _notes: item.notes || '',
            _createdAt: new Date(),
            _updatedAt: new Date()
          };

          const validatedItemData = transactionValidation.item.insert.parse(itemData);

          await tx.insert(schema.transactionItems)
            .values(itemData);

          if (params.type === TransactionType.SALE) {
            await this.inventoryService.adjustInventory({
              _productId: item.productId,
              _quantity: -item.quantity,
              _reason: `Sale - Transaction #${transaction.id}`,
              _transactionType: InventoryTransactionType.SALE,
              _userId: params.userId,
              _referenceId: transaction.id.toString()
            });
          }
        }

        // Process payments if provided
        if (params.payments && params.payments.length > 0) {
          // Verify total payment amount matches transaction total
          const totalPaymentAmount = params.payments.reduce(
            (sum, payment) => sum + parseFloat(payment.amount),
            0
          );

          if (Math.abs(totalPaymentAmount - parseFloat(params.total)) > 0.01) {
            throw TransactionServiceErrors.INVALID_PAYMENT_AMOUNT;
          }

          for (const payment of params.payments || []) {
            const paymentData = {
              _transactionId: transaction.id,
              _amount: payment.amount,
              _method: payment.method,
              _reference: payment.reference || '',
              _status: 'completed',
              _createdAt: new Date(),
              _updatedAt: new Date()
            };

            const validatedPaymentData = transactionValidation.payment.insert.parse(paymentData);

            await tx.insert(schema.transactionPayments)
              .values(validatedPaymentData as any);
          }
        }

        // Process loyalty points if applicable
        if (params.loyaltyPoints && params.customerId) {
          this.logger.info('Processing loyalty points for transaction', {
            _transactionId: transaction.id,
            _customerId: params.customerId,
            _earnedPoints: params.loyaltyPoints.earned,
            _redeemedPoints: params.loyaltyPoints.redeemed,
            _total: params.total
          });

          // Find loyalty member for this customer
          const loyaltyMember = await tx.query.loyaltyMembers.findFirst({
            _where: eq(schema.loyaltyMembers.customerId, params.customerId)
          });

          if (loyaltyMember) {
            this.logger.debug('Found loyalty member', {
              _loyaltyMemberId: loyaltyMember.id,
              _customerId: params.customerId,
              _transactionId: transaction.id,
              _currentPoints: loyaltyMember.points
            });

            // Award points if earned
            if (params.loyaltyPoints.earned > 0) {
              try {
                this.logger.info('Awarding loyalty points', {
                  _loyaltyMemberId: loyaltyMember.id,
                  _points: params.loyaltyPoints.earned,
                  _transactionId: transaction.id
                });

                await this.loyaltyService.addPoints(
                  loyaltyMember.id,
                  params.loyaltyPoints.earned,
                  `Transaction #${transaction.id}`,
                  transaction.id,
                  params.userId
                );

                this.logger.info('Loyalty points awarded successfully', {
                  _loyaltyMemberId: loyaltyMember.id,
                  _points: params.loyaltyPoints.earned,
                  _transactionId: transaction.id
                });
              } catch (error) {
                // Log error but don't fail the transaction
                this.logger.error('Failed to award loyalty points', error as Error, {
                  _loyaltyMemberId: loyaltyMember.id,
                  _points: params.loyaltyPoints.earned,
                  _transactionId: transaction.id
                });
              }
            }

            // Redeem points if specified
            if (params.loyaltyPoints.redeemed > 0) {
              this.logger.info('Redeeming loyalty points', {
                _loyaltyMemberId: loyaltyMember.id,
                _points: params.loyaltyPoints.redeemed,
                _transactionId: transaction.id
              });

              // Implement loyalty point redemption logic
              // This would typically be a call to a loyalty service method
              // _Example: await this.loyaltyService.redeemPoints(...)
            }
          } else {
            this.logger.warn('Customer not enrolled in loyalty program', {
              _customerId: params.customerId,
              _transactionId: transaction.id
            });
          }
        } else {
          this.logger.debug('No loyalty points to process for transaction', {
            _transactionId: transaction.id,
            _hasCustomer: !!params.customerId,
            _loyaltyEnabled: params.customerId ? _true : false
          });
        }

        return transaction;
      });
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        this.logger.error('Validation error creating transaction', error, {
          _validationErrors: error.toJSON(),
          _params: { _customerId: params.customerId, _storeId: params.storeId, _total: params.total }
        });
      }
      return this.handleError(error as Error, 'Creating transaction');
    }
  }

  /**
   * Update a transaction with validated data
   */
  async updateTransaction(_id: string, _params: UpdateTransactionParams): Promise<SelectTransaction> {
    try {
      const transactionId = parseInt(id, 10);
      const transaction = await db.query.transactions.findFirst({
        _where: eq(schema.transactions.id, transactionId)
      });

      if (!transaction) {
        throw TransactionServiceErrors.TRANSACTION_NOT_FOUND;
      }

      // Verify user exists
      const user = await db.query.users.findFirst({
        _where: eq(schema.users.id, params.userId)
      });

      if (!user) {
        throw TransactionServiceErrors.USER_NOT_FOUND;
      }

      // Verify customer exists if provided
      if (params.customerId) {
        const customer = await db.query.users.findFirst({
          _where: eq(schema.users.id, params.customerId)
        });

        if (!customer) {
          throw TransactionServiceErrors.CUSTOMER_NOT_FOUND;
        }
      }

      // Validate status transition
      if (params.status) {
        this.validateStatusTransition(transaction.status ?? '', params.status as string);
      }

      // Prepare transaction data with camelCase field names
      const transactionData = {
        ...(params.status ? { _status: params.status } : {}),
        _notes: params.notes || '',
        _updatedAt: new Date()
      };

      // Validate transaction data
      const validatedTransactionData = transactionValidation.update.parse(params) as Partial<typeof schema.transactions.$inferInsert>;

      // Update transaction
      const updatedTransaction = await db.update(schema.transactions)
        .set(validatedTransactionData)
        .where(eq(schema.transactions.id, transactionId))
        .returning();

      if (!updatedTransaction || updatedTransaction.length === 0) {
        throw new AppError(
          'Transaction not found or update failed',
          ErrorCode.NOT_FOUND,
          ErrorCategory.NOT_FOUND,
          undefined,
          404
        );
      }

      if (!updatedTransaction[0]) {
        throw new Error('Failed to update transaction - no record returned');
      }

      return updatedTransaction[0];
    } catch (error) {
      return this.handleError(error as Error, 'Updating transaction');
    }
  }

  /**
   * Process a refund for a transaction
   */
  async processRefund(_params: RefundParams): Promise<schema.SelectReturn> {
    try {
      // Verify transaction exists
      const transaction = await db.query.transactions.findFirst({
        _where: eq(schema.transactions.id, params.transactionId)
      });

      if (!transaction) {
        throw TransactionServiceErrors.TRANSACTION_NOT_FOUND;
      }

      // Verify user exists
      const user = await db.query.users.findFirst({
        _where: eq(schema.users.id, params.userId)
      });

      if (!user) {
        throw TransactionServiceErrors.USER_NOT_FOUND;
      }

      // Verify customer exists if provided
      if (params.customerId) {
        const customer = await db.query.users.findFirst({
          _where: eq(schema.users.id, params.customerId)
        });

        if (!customer) {
          throw TransactionServiceErrors.CUSTOMER_NOT_FOUND;
        }
      }

      // Verify refund amount is valid
      if (params.amount !== undefined && (Number(params.amount) < 0)) {
        throw TransactionServiceErrors.INVALID_REFUND_AMOUNT;
      }

      // Start a transaction to ensure data integrity
      const result = await db.transaction(async(tx) => {
        // Prepare refund data with camelCase field names
        const refundData = {
          _total: params.amount ?? '0',
          _refundId: `REF-${Date.now()}-${params.transactionId}`
        };

        // Validate refund data
        const validatedRefundData = transactionValidation.refund.insert.parse(params);

        // Insert refund
        const [refund] = await tx.insert(schema.returns)
          .values(refundData)
          .returning();

        // Insert refund items
        for (const item of (params.items ?? [])) {
          const originalItem = await tx.query.transactionItems.findFirst({
            _where: and(
              eq(schema.transactionItems.transactionId, params.transactionId),
              eq(schema.transactionItems.productId, item.productId)
            )
          });

          if (!originalItem) {
            throw TransactionServiceErrors.TRANSACTION_ITEM_NOT_FOUND;
          }

          // Prepare refund item data
          if (!refund) {
            throw new AppError(
              'Failed to create refund',
              ErrorCode.INTERNAL_SERVER_ERROR,
              ErrorCategory.SYSTEM
            );
          }

          const refundItemData = {
            _returnId: refund.id,
            _productId: item.productId,
            _quantity: item.quantity,
            _reason: `Refund - Return #${refund.id}`,

            _userId: params.userId,
            _reference: refund.id
          };

          // Update inventory
          await this.inventoryService.adjustInventory({
            ...refundItemData,
            _transactionType: InventoryTransactionType.RETURN,
            _referenceId: (refund as any).id || undefined
          });
        }

        return refund;
      });

      if (!result) {
        throw new AppError(
          'Failed to process refund',
          ErrorCode.INTERNAL_SERVER_ERROR,
          ErrorCategory.SYSTEM
        );
      }

      return result;
    } catch (error) {
      return this.handleError(error as Error, 'Processing refund');
    }
  }

  /**
   * Get transaction analytics for a store
   */
  async getTransactionAnalytics(_storeId: number, startDate?: Date, endDate?: Date): Promise<{
    _totalSales: string;
    _totalReturns: string;
    _netSales: string;
    _averageTransactionValue: string;
    _transactionCount: number;
    _returnCount: number;
    _salesByPaymentMethod: Array<{
      _method: PaymentMethod;
      _amount: string;
      _count: number;
    }>;
    _salesByHourOfDay: Array<{
      _hour: number;
      _amount: string;
      _count: number;
    }>;
    _salesByDayOfWeek: Array<{
      _day: number;
      _amount: string;
      _count: number;
    }>;
  }> {
    try {
      // Set default date range if not provided
      if (!endDate) {
        endDate = new Date();
      }

      if (!startDate) {
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30); // Default to last 30 days
      }

      // Verify store exists
      const store = await db.query.stores.findFirst({
        _where: eq(schema.stores.id, storeId)
      });

      if (!store) {
        throw TransactionServiceErrors.STORE_NOT_FOUND;
      }

      // Build date range filter
      const dateFilter = and(
        eq(schema.transactions.storeId, storeId),
        between(schema.transactions.createdAt, startDate, endDate)
      );

      // Get sales totals
      const [salesResult] = await db
        .select({
          _totalSales: sql<string>`COALESCE(SUM(CASE WHEN ${schema.transactions.status}
   =  '${TransactionStatus.COMPLETED}' THEN ${schema.transactions.total} ELSE 0 END), 0)`,
          _totalReturns: sql<string>`COALESCE(SUM(CASE WHEN ${schema.transactions.status}
   =  '${TransactionStatus.REFUNDED}' THEN ${schema.transactions.total} ELSE 0 END), 0)`,
          _saleCount: sql<number>`COUNT(CASE WHEN ${schema.transactions.status} = '${TransactionStatus.COMPLETED}' THEN ${schema.transactions.id} END)`,
          _returnCount: sql<number>`COUNT(CASE WHEN ${schema.transactions.status}
   =  '${TransactionStatus.REFUNDED}' THEN ${schema.transactions.id} END)`
        })
        .from(schema.transactions)
        .where(dateFilter);

      const totalSales = salesResult?.totalSales || '0';
      const totalReturns = salesResult?.totalReturns || '0';
      const saleCount = Number(salesResult?.saleCount || 0);
      const returnCount = Number(salesResult?.returnCount || 0);

      // Calculate net sales and average transaction value
      const netSales = (parseFloat(totalSales) - parseFloat(totalReturns)).toFixed(2);
      const averageTransactionValue = saleCount > 0
        ? (parseFloat(totalSales) / saleCount).toFixed(2)
        : '0.00';

      // Get sales by payment method
      const salesByPaymentMethod = await db
        .select({
          _method: schema.transactions.paymentMethod,
          _amount: sql<string>`COALESCE(SUM(${schema.transactions.total}::numeric), 0)`,
          _count: sql<number>`COUNT(*)`
        })
        .from(schema.transactions)
        .where(and(
          dateFilter,
          eq(schema.transactions.status, 'completed')
        ))
        .groupBy(schema.transactions.paymentMethod);

      // Get sales by hour of day
      const salesByHourOfDay = await db
        .select({
          _hour: sql<number>`EXTRACT(HOUR FROM ${schema.transactions.createdAt})`,
          _amount: sql<string>`COALESCE(SUM(${schema.transactions.total}::numeric), 0)`,
          _count: sql<number>`COUNT(*)`
        })
        .from(schema.transactions)
        .where(and(
          dateFilter,
          eq(schema.transactions.status, 'completed')
        ))
        .groupBy(sql`EXTRACT(HOUR FROM ${schema.transactions.createdAt})`)
        .orderBy(sql`EXTRACT(HOUR FROM ${schema.transactions.createdAt})`);

      // Get sales by day of week
      const salesByDayOfWeek = await db
        .select({
          _day: sql<number>`EXTRACT(DOW FROM ${schema.transactions.createdAt})`,
          _amount: sql<string>`COALESCE(SUM(${schema.transactions.total}::numeric), 0)`,
          _count: sql<number>`COUNT(*)`
        })
        .from(schema.transactions)
        .where(and(
          dateFilter,
          eq(schema.transactions.status, 'completed')
        ))
        .groupBy(sql`EXTRACT(DOW FROM ${schema.transactions.createdAt})`)
        .orderBy(sql`EXTRACT(DOW FROM ${schema.transactions.createdAt})`);

      return {
        totalSales,
        totalReturns,
        netSales,
        averageTransactionValue,
        _transactionCount: saleCount + returnCount,
        returnCount,
        _salesByPaymentMethod: salesByPaymentMethod as unknown as Array<{ _method: PaymentMethod; _amount: string; _count: number }>,
        salesByHourOfDay,
        salesByDayOfWeek
      };
    } catch (error) {
      return this.handleError(error as Error, 'Getting transaction analytics');
    }
  }

  /**
   * Validate that a transaction status transition is allowed
   */
  // ---------------------------------------------------------------------
  // Additional interface methods
  // ---------------------------------------------------------------------
  async getTransactionById(_id: string): Promise<SelectTransaction | null> {
    const transactionId = parseInt(id, 10);
    const transaction = await db.query.transactions.findFirst({ _where: eq(schema.transactions.id, transactionId) });
    return transaction ?? null;
  }

  async getTransactionsByStore(_storeId: number, page = 1, limit = 20): Promise<{ _transactions: SelectTransaction[]; _total: number; _page: number; _limit: number }> {
    const offset = (page - 1) * limit;
    const transactions = await db.query.transactions.findMany({
      _where: eq(schema.transactions.storeId, storeId),
      offset,
      limit,
      _orderBy: [desc(schema.transactions.createdAt)]
    });
    const countResult = await db.select({ _count: sql<number>`count(*)` }).from(schema.transactions).where(eq(schema.transactions.storeId, storeId));
    const count = countResult[0]?.count || 0;
    return { transactions, _total: Number(count), page, limit };
  }

  async getTransactionsByCustomer(_customerId: number, page = 1, limit = 20): Promise<{ _transactions: SelectTransaction[]; _total: number; _page: number; _limit: number }> {
    const offset = (page - 1) * limit;
    const transactions = await db.query.transactions.findMany({
      _where: eq(schema.transactions.customerId, customerId),
      offset,
      limit,
      _orderBy: [desc(schema.transactions.createdAt)]
    });
    const countResult = await db.select({ _count: sql<number>`count(*)` }).from(schema.transactions).where(eq(schema.transactions.customerId, customerId));
    const count = countResult[0]?.count || 0;
    return { transactions, _total: Number(count), page, limit };
  }

  async searchTransactions(_params: TransactionSearchParams): Promise<{ _transactions: SelectTransaction[]; _total: number; _page: number; _limit: number }> {
    const { storeId, keyword, page = 1, limit = 20 } = params;
    const offset = (page - 1) * limit;

    const _wheres: (ReturnType<typeof eq> | ReturnType<typeof or>)[] = [eq(schema.transactions.storeId, storeId)];
    if (keyword) {
      const kw = `%${keyword}%`;
      wheres.push(or(like(sql`cast(${schema.transactions.id} as text)`, kw)));
    }

    const countResult = await db.select({ _count: sql<number>`count(*)` }).from(schema.transactions).where(and(...wheres));
    const count = countResult[0]?.count || 0;
    const transactions = await db.query.transactions.findMany({ _where: and(...wheres), offset, limit, _orderBy: [desc(schema.transactions.createdAt)] });
    return { transactions, _total: Number(count), page, limit };
  }

  private validateStatusTransition(_currentStatus: string, _newStatus: string): void {
    // Define allowed status transitions
    const _allowedTransitions: Record<string, string[]> = {
      [TransactionStatus.PENDING]: [
        TransactionStatus.COMPLETED,
        TransactionStatus.CANCELLED,
        TransactionStatus.FAILED
      ],
      [TransactionStatus.COMPLETED]: [
        TransactionStatus.REFUNDED,
        TransactionStatus.PARTIALLY_REFUNDED
      ],
      [TransactionStatus.PARTIALLY_REFUNDED]: [
        TransactionStatus.REFUNDED
      ]
    };

    // Check if transition is allowed
    const allowed = allowedTransitions[currentStatus]?.includes(newStatus);

    if (!allowed) {
      throw TransactionServiceErrors.INVALID_TRANSACTION_STATUS;
    }
  }
}
