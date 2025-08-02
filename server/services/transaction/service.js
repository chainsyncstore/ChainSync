'use strict';
/**
 * Transaction Service Implementation
 *
 * This file implements a standardized transaction service with proper schema validation
 * and error handling according to our schema style guide.
 */
const __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  let desc = Object.getOwnPropertyDescriptor(m, k);
  if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
    desc = { _enumerable: true, _get: function() { return m[k]; } };
  }
  Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  o[k2] = m[k];
}));
const __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
  Object.defineProperty(o, 'default', { _enumerable: true, _value: v });
}) : function(o, v) {
  o['default'] = v;
});
const __importStar = (this && this.__importStar) || (function() {
  let ownKeys = function(o) {
    ownKeys = Object.getOwnPropertyNames || function(o) {
      const ar = [];
      for (const k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
      return ar;
    };
    return ownKeys(o);
  };
  return function(mod) {
    if (mod && mod.__esModule) return mod;
    const result = {};
    if (mod != null) for (let k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== 'default') __createBinding(result, mod, k[i]);
    __setModuleDefault(result, mod);
    return result;
  };
})();
Object.defineProperty(exports, '__esModule', { _value: true });
exports.TransactionService = void 0;
const service_1 = require('../base/service');
const types_1 = require('./types');
const db_1 = require('../../db');
const schema = __importStar(require('@shared/schema'));
const drizzle_orm_1 = require('drizzle-orm');
const schema_validation_1 = require('@shared/schema-validation');
const types_2 = require('../inventory/types');
// Import required services
const service_2 = require('../inventory/service');
const service_3 = require('../loyalty/service');
// Import the logging system
const index_js_1 = require('../../../src/logging/index.js');
class TransactionService extends service_1.BaseService {
  constructor() {
    super();
    this.inventoryService = new service_2.InventoryService();
    this.loyaltyService = new service_3.LoyaltyService();
    // Create a logger with service context
    this.logger = (0, index_js_1.createLogger)({
      _service: 'TransactionService',
      _component: 'transaction'
    });
  }
  createTransactionItem(params) {
    throw new Error('Method not implemented.');
  }
  updateTransactionItem(id, params) {
    throw new Error('Method not implemented.');
  }
  createTransactionPayment(params) {
    throw new Error('Method not implemented.');
  }
  updateTransactionPayment(id, params) {
    throw new Error('Method not implemented.');
  }
  /**
     * Set a custom logger (useful for testing or external configuration)
     */
  setLogger(logger) {
    this.logger = logger;
  }
  /**
     * Create a new transaction with validated data
     */
  async createTransaction(params) {
    try {
      // Verify store exists
      const store = await db_1.db.query.stores.findFirst({
        _where: (0, drizzle_orm_1.eq)(schema.stores.id, params.storeId)
      });
      if (!store) {
        throw types_1.TransactionServiceErrors.STORE_NOT_FOUND;
      }
      // Verify user exists
      const user = await db_1.db.query.users.findFirst({
        _where: (0, drizzle_orm_1.eq)(schema.users.id, params.userId)
      });
      if (!user) {
        throw types_1.TransactionServiceErrors.USER_NOT_FOUND;
      }
      // Verify customer exists if provided
      if (params.customerId) {
        const customer = await db_1.db.query.users.findFirst({
          _where: (0, drizzle_orm_1.eq)(schema.users.id, params.customerId)
        });
        if (!customer) {
          throw types_1.TransactionServiceErrors.CUSTOMER_NOT_FOUND;
        }
      }
      // Verify products exist and calculate totals
      const productIds = params.items.map(item => item.productId);
      const products = await db_1.db.query.products.findMany({
        _where: (0, drizzle_orm_1.inArray)(schema.products.id, productIds),
        _with: {
          _inventory: true
        }
      });
      // Ensure all products exist
      if (products.length !== productIds.length) {
        throw types_1.TransactionServiceErrors.PRODUCT_NOT_FOUND;
      }
      // Create product lookup map for faster access
      const productMap = new Map();
      products.forEach(product => productMap.set(product.id, product));
      // Validate stock availability if this is a sale
      if (params.type === types_1.TransactionType.SALE) {
        for (const item of params.items) {
          const product = productMap.get(item.productId);
          const inventory = product?.inventory;
          if (!inventory || inventory.quantity < item.quantity) {
            throw types_1.TransactionServiceErrors.INSUFFICIENT_STOCK;
          }
        }
      }
      // Generate transaction reference if not provided
      if (!params.reference) {
        params.reference = `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      }
      // Start a transaction to ensure data integrity
      return await db_1.db.transaction(async(tx) => {
        const validatedTransactionData = schema_validation_1.transactionValidation.insert.parse(params);
        const [transaction] = await tx.insert(schema.transactions)
          .values(validatedTransactionData)
          .returning();
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
          const validatedItemData = schema_validation_1.transactionValidation.item.insert.parse(itemData);
          await tx.insert(schema.transactionItems)
            .values(validatedItemData);
          if (params.type === types_1.TransactionType.SALE) {
            await this.inventoryService.adjustInventory({
              _productId: item.productId,
              _quantity: -item.quantity,
              _reason: `Sale - Transaction #${transaction.id}`,
              _transactionType: types_2.InventoryTransactionType.SALE,
              _userId: params.userId,
              _referenceId: transaction.id.toString()
            });
          }
        }
        // Process payments if provided
        if (params.payments && params.payments.length > 0) {
          // Verify total payment amount matches transaction total
          const totalPaymentAmount = params.payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
          if (Math.abs(totalPaymentAmount - parseFloat(params.total)) > 0.01) {
            throw types_1.TransactionServiceErrors.INVALID_PAYMENT_AMOUNT;
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
            const validatedPaymentData = schema_validation_1.transactionValidation.payment.insert.parse(paymentData);
            await tx.insert(schema.transactionPayments)
              .values(validatedPaymentData);
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
            _where: (0, drizzle_orm_1.eq)(schema.loyaltyMembers.customerId, params.customerId)
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
                await this.loyaltyService.addPoints(loyaltyMember.id, params.loyaltyPoints.earned, `Transaction #${transaction.id}`, transaction.id, params.userId);
                this.logger.info('Loyalty points awarded successfully', {
                  _loyaltyMemberId: loyaltyMember.id,
                  _points: params.loyaltyPoints.earned,
                  _transactionId: transaction.id
                });
              }
              catch (error) {
                // Log error but don't fail the transaction
                this.logger.error('Failed to award loyalty points', error, {
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
          }
          else {
            this.logger.warn('Customer not enrolled in loyalty program', {
              _customerId: params.customerId,
              _transactionId: transaction.id
            });
          }
        }
        else {
          this.logger.debug('No loyalty points to process for transaction', {
            _transactionId: transaction.id,
            _hasCustomer: !!params.customerId,
            _loyaltyEnabled: params.customerId ? _true : false
          });
        }
        return transaction;
      });
    }
    catch (error) {
      if (error instanceof schema_validation_1.SchemaValidationError) {
        this.logger.error('Validation error creating transaction', error, {
          _validationErrors: error.toJSON(),
          _params: { _customerId: params.customerId, _storeId: params.storeId, _total: params.total }
        });
      }
      return this.handleError(error, 'Creating transaction');
    }
  }
  /**
     * Update a transaction with validated data
     */
  async updateTransaction(id, params) {
    try {
      const transactionId = parseInt(id, 10);
      const transaction = await db_1.db.query.transactions.findFirst({
        _where: (0, drizzle_orm_1.eq)(schema.transactions.id, transactionId)
      });
      if (!transaction) {
        throw types_1.TransactionServiceErrors.TRANSACTION_NOT_FOUND;
      }
      // Verify user exists
      const user = await db_1.db.query.users.findFirst({
        _where: (0, drizzle_orm_1.eq)(schema.users.id, params.userId)
      });
      if (!user) {
        throw types_1.TransactionServiceErrors.USER_NOT_FOUND;
      }
      // Verify customer exists if provided
      if (params.customerId) {
        const customer = await db_1.db.query.users.findFirst({
          _where: (0, drizzle_orm_1.eq)(schema.users.id, params.customerId)
        });
        if (!customer) {
          throw types_1.TransactionServiceErrors.CUSTOMER_NOT_FOUND;
        }
      }
      // Validate status transition
      if (params.status) {
        this.validateStatusTransition(transaction.status ?? '', params.status);
      }
      // Prepare transaction data with camelCase field names
      const transactionData = {
        ...(params.status ? { _status: params.status } : {}),
        _notes: params.notes || '',
        _updatedAt: new Date()
      };
      // Validate transaction data
      const validatedTransactionData = schema_validation_1.transactionValidation.update.parse(params);
      // Update transaction
      const [updatedTransaction] = await db_1.db.update(schema.transactions)
        .set(validatedTransactionData)
        .where((0, drizzle_orm_1.eq)(schema.transactions.id, transactionId))
        .returning();
      return updatedTransaction;
    }
    catch (error) {
      return this.handleError(error, 'Updating transaction');
    }
  }
  /**
     * Process a refund for a transaction
     */
  async processRefund(params) {
    try {
      // Verify transaction exists
      const transaction = await db_1.db.query.transactions.findFirst({
        _where: (0, drizzle_orm_1.eq)(schema.transactions.id, params.transactionId)
      });
      if (!transaction) {
        throw types_1.TransactionServiceErrors.TRANSACTION_NOT_FOUND;
      }
      // Verify user exists
      const user = await db_1.db.query.users.findFirst({
        _where: (0, drizzle_orm_1.eq)(schema.users.id, params.userId)
      });
      if (!user) {
        throw types_1.TransactionServiceErrors.USER_NOT_FOUND;
      }
      // Verify customer exists if provided
      if (params.customerId) {
        const customer = await db_1.db.query.users.findFirst({
          _where: (0, drizzle_orm_1.eq)(schema.users.id, params.customerId)
        });
        if (!customer) {
          throw types_1.TransactionServiceErrors.CUSTOMER_NOT_FOUND;
        }
      }
      // Verify refund amount is valid
      if (params.amount !== undefined && (Number(params.amount) < 0)) {
        throw types_1.TransactionServiceErrors.INVALID_REFUND_AMOUNT;
      }
      // Start a transaction to ensure data integrity
      return await db_1.db.transaction(async(tx) => {
        // Prepare refund data with camelCase field names
        const refundData = {
          _transactionId: params.transactionId,
          _amount: params.amount,
          _reason: params.reason,
          _notes: params.notes || '',
          _status: 'completed',
          _createdAt: new Date(),
          _updatedAt: new Date()
        };
        // Validate refund data
        const validatedRefundData = schema_validation_1.transactionValidation.refund.insert.parse(params);
        // Insert refund
        const [refund] = await tx.insert(schema.returns)
          .values(validatedRefundData)
          .returning();
        // Insert refund items
        for (const item of (params.items ?? [])) {
          const originalItem = await tx.query.transactionItems.findFirst({
            _where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.transactionItems.transactionId, params.transactionId), (0, drizzle_orm_1.eq)(schema.transactionItems.productId, item.productId))
          });
          if (!originalItem) {
            throw types_1.TransactionServiceErrors.TRANSACTION_ITEM_NOT_FOUND;
          }
          // Prepare refund item data
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
            _transactionType: types_2.InventoryTransactionType.RETURN,
            _referenceId: refund.id || undefined
          });
        }
        return refund;
      });
    }
    catch (error) {
      return this.handleError(error, 'Processing refund');
    }
  }
  /**
     * Get transaction analytics for a store
     */
  async getTransactionAnalytics(storeId, startDate, endDate) {
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
      const store = await db_1.db.query.stores.findFirst({
        _where: (0, drizzle_orm_1.eq)(schema.stores.id, storeId)
      });
      if (!store) {
        throw types_1.TransactionServiceErrors.STORE_NOT_FOUND;
      }
      // Build date range filter
      const dateFilter = (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.transactions.storeId, storeId), (0, drizzle_orm_1.between)(schema.transactions.createdAt, startDate, endDate));
      // Get sales totals
      const [salesResult] = await db_1.db
        .select({
          _totalSales: (0, drizzle_orm_1.sql) `COALESCE(SUM(CASE WHEN ${schema.transactions.status}
   =  '${types_1.TransactionStatus.COMPLETED}' THEN ${schema.transactions.total} ELSE 0 END), 0)`,
          _totalReturns: (0, drizzle_orm_1.sql) `COALESCE(SUM(CASE WHEN ${schema.transactions.status}
   =  '${types_1.TransactionStatus.REFUNDED}' THEN ${schema.transactions.total} ELSE 0 END), 0)`,
          _saleCount: (0, drizzle_orm_1.sql) `COUNT(CASE WHEN ${schema.transactions.status}
   =  '${types_1.TransactionStatus.COMPLETED}' THEN ${schema.transactions.id} END)`,
          _returnCount: (0, drizzle_orm_1.sql) `COUNT(CASE WHEN ${schema.transactions.status}
   =  '${types_1.TransactionStatus.REFUNDED}' THEN ${schema.transactions.id} END)`
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
      const salesByPaymentMethod = await db_1.db
        .select({
          _method: schema.transactions.paymentMethod,
          _amount: (0, drizzle_orm_1.sql) `COALESCE(SUM(${schema.transactions.total}::numeric), 0)`,
          _count: (0, drizzle_orm_1.sql) `COUNT(*)`
        })
        .from(schema.transactions)
        .where((0, drizzle_orm_1.and)(dateFilter, (0, drizzle_orm_1.eq)(schema.transactions.status, 'completed')))
        .groupBy(schema.transactions.paymentMethod);
      // Get sales by hour of day
      const salesByHourOfDay = await db_1.db
        .select({
          _hour: (0, drizzle_orm_1.sql) `EXTRACT(HOUR FROM ${schema.transactions.createdAt})`,
          _amount: (0, drizzle_orm_1.sql) `COALESCE(SUM(${schema.transactions.total}::numeric), 0)`,
          _count: (0, drizzle_orm_1.sql) `COUNT(*)`
        })
        .from(schema.transactions)
        .where((0, drizzle_orm_1.and)(dateFilter, (0, drizzle_orm_1.eq)(schema.transactions.status, 'completed')))
        .groupBy((0, drizzle_orm_1.sql) `EXTRACT(HOUR FROM ${schema.transactions.createdAt})`)
        .orderBy((0, drizzle_orm_1.sql) `EXTRACT(HOUR FROM ${schema.transactions.createdAt})`);
      // Get sales by day of week
      const salesByDayOfWeek = await db_1.db
        .select({
          _day: (0, drizzle_orm_1.sql) `EXTRACT(DOW FROM ${schema.transactions.createdAt})`,
          _amount: (0, drizzle_orm_1.sql) `COALESCE(SUM(${schema.transactions.total}::numeric), 0)`,
          _count: (0, drizzle_orm_1.sql) `COUNT(*)`
        })
        .from(schema.transactions)
        .where((0, drizzle_orm_1.and)(dateFilter, (0, drizzle_orm_1.eq)(schema.transactions.status, 'completed')))
        .groupBy((0, drizzle_orm_1.sql) `EXTRACT(DOW FROM ${schema.transactions.createdAt})`)
        .orderBy((0, drizzle_orm_1.sql) `EXTRACT(DOW FROM ${schema.transactions.createdAt})`);
      return {
        totalSales,
        totalReturns,
        netSales,
        averageTransactionValue,
        _transactionCount: saleCount + returnCount,
        returnCount,
        _salesByPaymentMethod: salesByPaymentMethod,
        salesByHourOfDay,
        salesByDayOfWeek
      };
    }
    catch (error) {
      return this.handleError(error, 'Getting transaction analytics');
    }
  }
  /**
     * Validate that a transaction status transition is allowed
     */
  // ---------------------------------------------------------------------
  // Additional interface methods
  // ---------------------------------------------------------------------
  async getTransactionById(id) {
    const transactionId = parseInt(id, 10);
    const transaction = await db_1.db.query.transactions.findFirst({ _where: (0, drizzle_orm_1.eq)(schema.transactions.id, transactionId) });
    return transaction ?? null;
  }
  async getTransactionsByStore(storeId, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const transactions = await db_1.db.query.transactions.findMany({
      _where: (0, drizzle_orm_1.eq)(schema.transactions.storeId, storeId),
      offset,
      limit,
      _orderBy: [(0, drizzle_orm_1.desc)(schema.transactions.createdAt)]
    });
    const [{ count }] = await db_1.db.select({ _count: (0, drizzle_orm_1.sql) `count(*)` }).from(schema.transactions).where((0, drizzle_orm_1.eq)(schema.transactions.storeId, storeId));
    return { transactions, _total: Number(count || 0), page, limit };
  }
  async getTransactionsByCustomer(customerId, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const transactions = await db_1.db.query.transactions.findMany({
      _where: (0, drizzle_orm_1.eq)(schema.transactions.customerId, customerId),
      offset,
      limit,
      _orderBy: [(0, drizzle_orm_1.desc)(schema.transactions.createdAt)]
    });
    const [{ count }] = await db_1.db.select({ _count: (0, drizzle_orm_1.sql) `count(*)` }).from(schema.transactions).where((0, drizzle_orm_1.eq)(schema.transactions.customerId, customerId));
    return { transactions, _total: Number(count || 0), page, limit };
  }
  async searchTransactions(params) {
    const { storeId, keyword, page = 1, limit = 20 } = params;
    const offset = (page - 1) * limit;
    const wheres = [(0, drizzle_orm_1.eq)(schema.transactions.storeId, storeId)];
    if (keyword) {
      const kw = `%${keyword}%`;
      wheres.push((0, drizzle_orm_1.or)((0, drizzle_orm_1.like)((0, drizzle_orm_1.sql) `cast(${schema.transactions.id} as text)`, kw)));
    }
    const [{ count }] = await db_1.db.select({ _count: (0, drizzle_orm_1.sql) `count(*)` }).from(schema.transactions).where((0, drizzle_orm_1.and)(...wheres));
    const transactions = await db_1.db.query.transactions.findMany({ _where: (0, drizzle_orm_1.and)(...wheres), offset, limit, _orderBy: [(0, drizzle_orm_1.desc)(schema.transactions.createdAt)] });
    return { transactions, _total: Number(count || 0), page, limit };
  }
  validateStatusTransition(currentStatus, newStatus) {
    // Define allowed status transitions
    const allowedTransitions = {
      [types_1.TransactionStatus.PENDING]: [
        types_1.TransactionStatus.COMPLETED,
        types_1.TransactionStatus.CANCELLED,
        types_1.TransactionStatus.FAILED
      ],
      [types_1.TransactionStatus.COMPLETED]: [
        types_1.TransactionStatus.REFUNDED,
        types_1.TransactionStatus.PARTIALLY_REFUNDED
      ],
      [types_1.TransactionStatus.PARTIALLY_REFUNDED]: [
        types_1.TransactionStatus.REFUNDED
      ]
    };
    // Check if transition is allowed
    const allowed = allowedTransitions[currentStatus]?.includes(newStatus);
    if (!allowed) {
      throw types_1.TransactionServiceErrors.INVALID_TRANSACTION_STATUS;
    }
  }
}
exports.TransactionService = TransactionService;
