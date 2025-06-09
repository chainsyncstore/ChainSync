/**
 * Transaction Service Implementation
 *
 * This file implements a standardized transaction service with proper schema validation
 * and error handling according to our schema style guide.
 */

import { Logger, getLogger } from '@shared/logging';
import * as schema from '@shared/schema';
import { transactionValidation, SchemaValidationError } from '@shared/schema-validation';
import { eq, and, or, like, gte, lte, desc, asc, sql, between, inArray } from 'drizzle-orm';

import {
  ITransactionService,
  TransactionServiceErrors,
  CreateTransactionParams,
  UpdateTransactionParams,
  TransactionSearchParams,
  RefundParams,
  PaymentMethod,
  TransactionType,
  TransactionStatus,
} from './types';
import { db } from '../../db';
import { BaseService } from '../base/service';
import { InventoryService } from '../inventory/service';
import { InventoryAdjustmentType } from '../inventory/types';

// Import required services
import { LoyaltyService } from '../loyalty/service';

// Import the logging system

export class TransactionService extends BaseService implements ITransactionService {
  private inventoryService: InventoryService;
  private loyaltyService: LoyaltyService;
  protected logger: Logger;

  constructor() {
    const logger = getLogger('TransactionService', {
      service: 'TransactionService',
      component: 'transaction',
    });
    super(logger);
    this.logger = logger;
    this.inventoryService = new InventoryService(this.logger);
    this.loyaltyService = new LoyaltyService({ logger: this.logger });
  }

  /**
   * Set a custom logger (useful for testing or external configuration)
   */
  setLogger(logger: Logger): void {
    this.logger = logger;
  }

  /**
   * Create a new transaction with validated data
   */
  async createTransaction(params: CreateTransactionParams): Promise<schema.Transaction> {
    try {
      // Verify store exists
      const store = await db.query.stores.findFirst({
        where: eq(schema.stores.id, params.storeId),
      });

      if (!store) {
        throw TransactionServiceErrors.STORE_NOT_FOUND;
      }

      // Verify user exists
      const user = await db.query.users.findFirst({
        where: eq(schema.users.id, params.userId),
      });

      if (!user) {
        throw TransactionServiceErrors.USER_NOT_FOUND;
      }

      // Verify customer exists if provided
      if (params.customerId) {
        const customer = await db.query.customers.findFirst({
          where: eq(schema.customers.id, params.customerId),
        });

        if (!customer) {
          throw TransactionServiceErrors.CUSTOMER_NOT_FOUND;
        }
      }

      // Verify products exist and calculate totals
      const productIds = params.items.map(item => item.productId);
      const products = await db.query.products.findMany({
        where: inArray(schema.products.id, productIds),
        with: {
          inventory: true,
        },
      });

      // Ensure all products exist
      if (products.length !== productIds.length) {
        throw TransactionServiceErrors.PRODUCT_NOT_FOUND;
      }

      // Create product lookup map for faster access
      const productMap = new Map<number, schema.Product>();
      products.forEach(product => productMap.set(product.id, product));

      // Validate stock availability if this is a sale
      if (params.type === TransactionType.SALE) {
        for (const item of params.items) {
          const product = productMap.get(item.productId);
          const inventory = product?.inventory?.[0];

          if (!inventory || inventory.availableQuantity < item.quantity) {
            throw TransactionServiceErrors.INSUFFICIENT_STOCK;
          }
        }
      }

      // Generate transaction reference if not provided
      if (!params.reference) {
        params.reference = `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      }

      // Start a transaction to ensure data integrity
      return await db.transaction(async tx => {
        // Prepare transaction data with camelCase field names
        const transactionData = {
          storeId: params.storeId,
          customerId: params.customerId,
          userId: params.userId,
          type: params.type,
          subtotal: params.subtotal,
          tax: params.tax,
          discount: params.discount || '0.00',
          total: params.total,
          paymentMethod: params.paymentMethod,
          status: TransactionStatus.COMPLETED,
          notes: params.notes || '',
          reference: params.reference,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Validate transaction data
        const validatedTransactionData = transactionValidation.insert(transactionData);

        // Insert transaction
        const [transaction] = await tx
          .insert(schema.transactions)
          .values(validatedTransactionData)
          .returning();

        // Insert transaction items
        for (const item of params.items) {
          const product = productMap.get(item.productId);

          // Prepare item data
          const itemData = {
            transactionId: transaction.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount || '0.00',
            subtotal: (parseFloat(item.unitPrice) * item.quantity).toFixed(2),
            notes: item.notes || '',
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          // Validate item data
          const validatedItemData = transactionValidation.item.insert(itemData);

          // Insert item
          await tx.insert(schema.transactionItems).values(validatedItemData);

          // Update inventory if this is a sale
          if (params.type === TransactionType.SALE) {
            await this.inventoryService.adjustInventory({
              productId: item.productId,
              quantity: -item.quantity,
              reason: `Sale - Transaction #${transaction.id}`,
              type: InventoryAdjustmentType.SALE,
              userId: params.userId,
              reference: transaction.reference,
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

          for (const payment of params.payments) {
            const paymentData = {
              transactionId: transaction.id,
              amount: payment.amount,
              method: payment.method,
              reference: payment.reference || '',
              status: 'completed',
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            // Validate payment data
            const validatedPaymentData = transactionValidation.payment.insert(paymentData);

            // Insert payment
            await tx.insert(schema.payment).values(validatedPaymentData);
          }
        }

        // Process loyalty points if applicable
        if (params.loyaltyPoints && params.customerId) {
          this.logger.info('Processing loyalty points for transaction', {
            transactionId: transaction.id,
            customerId: params.customerId,
            earnedPoints: params.loyaltyPoints.earned,
            redeemedPoints: params.loyaltyPoints.redeemed,
            total: params.total,
          });

          // Find loyalty member for this customer
          const loyaltyMember = await tx.query.loyaltyMembers.findFirst({
            where: eq(schema.loyaltyMembers.customerId, params.customerId),
          });

          if (loyaltyMember) {
            this.logger.debug('Found loyalty member', {
              loyaltyMemberId: loyaltyMember.id,
              customerId: params.customerId,
              transactionId: transaction.id,
              currentPoints: loyaltyMember.points,
            });

            // Award points if earned
            if (params.loyaltyPoints.earned > 0) {
              try {
                this.logger.info('Awarding loyalty points', {
                  loyaltyMemberId: loyaltyMember.id,
                  points: params.loyaltyPoints.earned,
                  transactionId: transaction.id,
                });

                await this.loyaltyService.awardPoints(
                  loyaltyMember.id,
                  params.loyaltyPoints.earned,
                  `Transaction #${transaction.id}`,
                  params.userId
                );

                this.logger.info('Loyalty points awarded successfully', {
                  loyaltyMemberId: loyaltyMember.id,
                  points: params.loyaltyPoints.earned,
                  transactionId: transaction.id,
                });
              } catch (error: unknown) {
                // Log error but don't fail the transaction
                this.logger.error('Failed to award loyalty points', error, {
                  loyaltyMemberId: loyaltyMember.id,
                  points: params.loyaltyPoints.earned,
                  transactionId: transaction.id,
                });
              }
            }

            // Redeem points if specified
            if (params.loyaltyPoints.redeemed > 0) {
              this.logger.info('Redeeming loyalty points', {
                loyaltyMemberId: loyaltyMember.id,
                points: params.loyaltyPoints.redeemed,
                transactionId: transaction.id,
              });

              // Implement loyalty point redemption logic
              // This would typically be a call to a loyalty service method
              // Example: await this.loyaltyService.redeemPoints(...)
            }
          } else {
            this.logger.warn('Customer not enrolled in loyalty program', {
              customerId: params.customerId,
              transactionId: transaction.id,
            });
          }
        } else {
          this.logger.debug('No loyalty points to process for transaction', {
            transactionId: transaction.id,
            hasCustomer: !!params.customerId,
            loyaltyEnabled: params.customerId ? true : false,
          });
        }

        return transaction;
      });
    } catch (error: unknown) {
      if (error instanceof SchemaValidationError) {
        this.logger.error(`Validation error creating transaction`, error, {
          validationErrors: error.toJSON(),
          params: { customerId: params.customerId, storeId: params.storeId, total: params.total },
        });
      }
      return this.handleError(error, 'Creating transaction');
    }
  }

  /**
   * Update a transaction with validated data
   */
  async updateTransaction(params: UpdateTransactionParams): Promise<schema.Transaction> {
    try {
      // Verify transaction exists
      const transaction = await db.query.transactions.findFirst({
        where: eq(schema.transactions.id, params.transactionId),
      });

      if (!transaction) {
        throw TransactionServiceErrors.TRANSACTION_NOT_FOUND;
      }

      // Verify user exists
      const user = await db.query.users.findFirst({
        where: eq(schema.users.id, params.userId),
      });

      if (!user) {
        throw TransactionServiceErrors.USER_NOT_FOUND;
      }

      // Verify customer exists if provided
      if (params.customerId) {
        const customer = await db.query.customers.findFirst({
          where: eq(schema.customers.id, params.customerId),
        });

        if (!customer) {
          throw TransactionServiceErrors.CUSTOMER_NOT_FOUND;
        }
      }

      // Validate status transition
      this.validateStatusTransition(transaction.status, params.status);

      // Prepare transaction data with camelCase field names
      const transactionData = {
        status: params.status,
        notes: params.notes || '',
        updatedAt: new Date(),
      };

      // Validate transaction data
      const validatedTransactionData = transactionValidation.update(transactionData);

      // Update transaction
      const [updatedTransaction] = await db
        .update(schema.transactions)
        .set(validatedTransactionData)
        .where(eq(schema.transactions.id, params.transactionId))
        .returning();

      return updatedTransaction;
    } catch (error: unknown) {
      return this.handleError(error, 'Updating transaction');
    }
  }

  /**
   * Process a refund for a transaction
   */
  async processRefund(params: RefundParams): Promise<typeof schema.returns> {
    try {
      // Verify transaction exists
      const transaction = await db.query.transactions.findFirst({
        where: eq(schema.transactions.id, params.transactionId),
      });

      if (!transaction) {
        throw TransactionServiceErrors.TRANSACTION_NOT_FOUND;
      }

      // Verify user exists
      const user = await db.query.users.findFirst({
        where: eq(schema.users.id, params.userId),
      });

      if (!user) {
        throw TransactionServiceErrors.USER_NOT_FOUND;
      }

      // Verify customer exists if provided
      if (params.customerId) {
        const customer = await db.query.customers.findFirst({
          where: eq(schema.customers.id, params.customerId),
        });

        if (!customer) {
          throw TransactionServiceErrors.CUSTOMER_NOT_FOUND;
        }
      }

      // Verify refund amount is valid
      if (params.amount < 0) {
        throw TransactionServiceErrors.INVALID_REFUND_AMOUNT;
      }

      // Start a transaction to ensure data integrity
      return await db.transaction(async tx => {
        // Prepare refund data with camelCase field names
        const refundData = {
          transactionId: params.transactionId,
          amount: params.amount,
          reason: params.reason,
          notes: params.notes || '',
          status: 'completed',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Validate refund data
        const validatedRefundData = transactionValidation.refund.insert(refundData);

        // Insert refund
        const [refund] = await tx.insert(schema.returns).values(validatedRefundData).returning();

        // Insert refund items
        for (const item of params.items) {
          const originalItem = await tx.query.transactionItems.findFirst({
            where: and(
              eq(schema.transactionItems.transactionId, params.transactionId),
              eq(schema.transactionItems.productId, item.productId)
            ),
          });

          if (!originalItem) {
            throw TransactionServiceErrors.TRANSACTION_ITEM_NOT_FOUND;
          }

          // Prepare refund item data
          const refundItemData = {
            returnId: refund.id,
            productId: item.productId,
            quantity: item.quantity,
            reason: `Refund - Return #${refund.id}`,
            type: InventoryAdjustmentType.RETURN,
            userId: params.userId,
            reference: refund.reference,
          };

          // Update inventory
          await this.inventoryService.adjustInventory(refundItemData);
        }

        return refund;
      });
    } catch (error: unknown) {
      return this.handleError(error, 'Processing refund');
    }
  }

  /**
   * Get transaction analytics for a store
   */
  async getTransactionAnalytics(
    storeId: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalSales: string;
    totalReturns: string;
    netSales: string;
    averageTransactionValue: string;
    transactionCount: number;
    returnCount: number;
    salesByPaymentMethod: Array<{
      method: PaymentMethod;
      amount: string;
      count: number;
    }>;
    salesByHourOfDay: Array<{
      hour: number;
      amount: string;
      count: number;
    }>;
    salesByDayOfWeek: Array<{
      day: number;
      amount: string;
      count: number;
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
        where: eq(schema.stores.id, storeId),
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
          totalSales: sql<string>`COALESCE(SUM(CASE WHEN ${schema.transactions.type} = '${TransactionType.SALE}' THEN ${schema.transactions.total} ELSE 0 END), 0)`,
          totalReturns: sql<string>`COALESCE(SUM(CASE WHEN ${schema.transactions.type} = '${TransactionType.RETURN}' THEN ${schema.transactions.total} ELSE 0 END), 0)`,
          saleCount: sql<number>`COUNT(CASE WHEN ${schema.transactions.type} = '${TransactionType.SALE}' THEN ${schema.transactions.id} END)`,
          returnCount: sql<number>`COUNT(CASE WHEN ${schema.transactions.type} = '${TransactionType.RETURN}' THEN ${schema.transactions.id} END)`,
        })
        .from(schema.transactions)
        .where(dateFilter);

      const totalSales = salesResult?.totalSales || '0';
      const totalReturns = salesResult?.totalReturns || '0';
      const saleCount = Number(salesResult?.saleCount || 0);
      const returnCount = Number(salesResult?.returnCount || 0);

      // Calculate net sales and average transaction value
      const netSales = (parseFloat(totalSales) - parseFloat(totalReturns)).toFixed(2);
      const averageTransactionValue =
        saleCount > 0 ? (parseFloat(totalSales) / saleCount).toFixed(2) : '0.00';

      // Get sales by payment method
      const salesByPaymentMethod = await db
        .select({
          method: schema.transactions.paymentMethod,
          amount: sql<string>`COALESCE(SUM(${schema.transactions.total}::numeric), 0)`,
          count: sql<number>`COUNT(*)`,
        })
        .from(schema.transactions)
        .where(and(dateFilter, eq(schema.transactions.type, TransactionType.SALE)))
        .groupBy(schema.transactions.paymentMethod);

      // Get sales by hour of day
      const salesByHourOfDay = await db
        .select({
          hour: sql<number>`EXTRACT(HOUR FROM ${schema.transactions.createdAt})`,
          amount: sql<string>`COALESCE(SUM(${schema.transactions.total}::numeric), 0)`,
          count: sql<number>`COUNT(*)`,
        })
        .from(schema.transactions)
        .where(and(dateFilter, eq(schema.transactions.type, TransactionType.SALE)))
        .groupBy(sql`EXTRACT(HOUR FROM ${schema.transactions.createdAt})`)
        .orderBy(sql`EXTRACT(HOUR FROM ${schema.transactions.createdAt})`);

      // Get sales by day of week
      const salesByDayOfWeek = await db
        .select({
          day: sql<number>`EXTRACT(DOW FROM ${schema.transactions.createdAt})`,
          amount: sql<string>`COALESCE(SUM(${schema.transactions.total}::numeric), 0)`,
          count: sql<number>`COUNT(*)`,
        })
        .from(schema.transactions)
        .where(and(dateFilter, eq(schema.transactions.type, TransactionType.SALE)))
        .groupBy(sql`EXTRACT(DOW FROM ${schema.transactions.createdAt})`)
        .orderBy(sql`EXTRACT(DOW FROM ${schema.transactions.createdAt})`);

      return {
        totalSales,
        totalReturns,
        netSales,
        averageTransactionValue,
        transactionCount: saleCount + returnCount,
        returnCount,
        salesByPaymentMethod,
        salesByHourOfDay,
        salesByDayOfWeek,
      };
    } catch (error: unknown) {
      return this.handleError(error, 'Getting transaction analytics');
    }
  }

  /**
   * Validate that a transaction status transition is allowed
   */
  private validateStatusTransition(currentStatus: string, newStatus: string): void {
    // Define allowed status transitions
    const allowedTransitions: Record<string, string[]> = {
      [TransactionStatus.PENDING]: [
        TransactionStatus.COMPLETED,
        TransactionStatus.CANCELLED,
        TransactionStatus.FAILED,
      ],
      [TransactionStatus.COMPLETED]: [
        TransactionStatus.REFUNDED,
        TransactionStatus.PARTIALLY_REFUNDED,
      ],
      [TransactionStatus.PARTIALLY_REFUNDED]: [TransactionStatus.REFUNDED],
    };

    // Check if transition is allowed
    const allowed = allowedTransitions[currentStatus]?.includes(newStatus);

    if (!allowed) {
      throw TransactionServiceErrors.INVALID_TRANSACTION_STATUS;
    }
  }
}
