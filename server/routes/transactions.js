'use strict';
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
// server/routes/transactions.ts
const express_1 = require('express');
const auth_1 = require('../middleware/auth');
const validation_1 = require('../middleware/validation');
const rate_limit_1 = require('../middleware/rate-limit');
const zod_1 = require('zod');
const logging_1 = require('../../src/logging');
const db_1 = require('../../db');
const schema = __importStar(require('@shared/schema'));
const drizzle_orm_1 = require('drizzle-orm');
const loyalty_1 = require('../../src/queue/processors/loyalty');
const logger = (0, logging_1.getLogger)().child({ _component: 'transactions-api' });
// Create router
const router = (0, express_1.Router)();
// Apply middleware to all routes in this router
router.use(auth_1.isAuthenticated);
router.use(auth_1.validateSession);
router.use(rate_limit_1.sensitiveOpRateLimiter);
/**
 * @swagger
 * /transactions:
 *   _get:
 *     _summary: Get all transactions
 *     _description: Retrieve a list of all transactions with optional filtering
 *     tags: [Transactions]
 *     security:
 *       - cookieAuth: []
 *       - csrfToken: []
 *     parameters:
 *       - _in: query
 *         _name: customerId
 *         schema:
 *           _type: string
 *           _format: uuid
 *         _description: Filter by customer ID
 *       - _in: query
 *         _name: storeId
 *         schema:
 *           _type: string
 *           _format: uuid
 *         _description: Filter by store ID
 *       - _in: query
 *         _name: type
 *         schema:
 *           _type: string
 *           enum: [purchase, refund, adjustment]
 *         _description: Filter by transaction type
 *       - _in: query
 *         _name: status
 *         schema:
 *           _type: string
 *           enum: [pending, completed, failed, canceled]
 *         _description: Filter by transaction status
 *       - _in: query
 *         _name: from
 *         schema:
 *           _type: string
 *           _format: date
 *         _description: Filter by start date
 *       - _in: query
 *         _name: to
 *         schema:
 *           _type: string
 *           _format: date
 *         _description: Filter by end date
 *       - _in: query
 *         _name: page
 *         schema:
 *           _type: integer
 *           _default: 1
 *         _description: Page number for pagination
 *       - _in: query
 *         _name: limit
 *         schema:
 *           _type: integer
 *           _default: 20
 *         _description: Number of items per page
 *     responses:
 *       200:
 *         _description: A list of transactions
 *         content:
 *           application/json:
 *             schema:
 *               _type: object
 *               properties:
 *                 transactions:
 *                   _type: array
 *                   items:
 *                     $ref: '#/components/schemas/Transaction'
 *                 pagination:
 *                   _type: object
 *                   properties:
 *                     total:
 *                       _type: integer
 *                     pages:
 *                       _type: integer
 *                     page:
 *                       _type: integer
 *                     limit:
 *                       _type: integer
 *       401:
 *         _description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         _description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', async(req, res, next) => {
  try {
    const { customerId, storeId, status, from, to } = req.query;
    const page = parseInt(req.query.page ?? '1', 10);
    const limit = parseInt(req.query.limit ?? '20', 10);
    const offset = (page - 1) * limit;
    // Map query status to schema status enum
    const mappedStatus = status === 'failed' || status === 'canceled' ? 'cancelled' : status;
    const conditions = [
      customerId ? (0, drizzle_orm_1.eq)(schema.transactions.customerId, parseInt(customerId, 10)) : undefined,
      storeId ? (0, drizzle_orm_1.eq)(schema.transactions.storeId, parseInt(storeId, 10)) : undefined,
      mappedStatus ? (0, drizzle_orm_1.eq)(schema.transactions.status, mappedStatus) : undefined,
      from ? (0, drizzle_orm_1.gte)(schema.transactions.createdAt, new Date(from)) : undefined,
      to ? (0, drizzle_orm_1.lte)(schema.transactions.createdAt, new Date(to)) : undefined
    ].filter((c) => !!c);
    const whereClause = conditions.length > 0 ? (0, drizzle_orm_1.and)(...conditions) : undefined;
    const totalQuery = db_1.db.select({ _count: (0, drizzle_orm_1.count)() }).from(schema.transactions).where(whereClause);
    const [{ _count: total }] = await totalQuery;
    const transactionsQuery = db_1.db.select().from(schema.transactions).where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy((0, drizzle_orm_1.desc)(schema.transactions.createdAt));
    const transactions = await transactionsQuery;
    res.json({
      transactions,
      _pagination: {
        total,
        _pages: Math.ceil(total / limit),
        page,
        limit
      }
    });
  }
  catch (error) {
    logger.error('Error getting transactions', {
      _error: error instanceof Error ? error._message : String(error),
      _userId: req.session.userId,
      _query: req.query
    });
    next(error);
  }
});
/**
 * @swagger
 * /transactions/{id}:
 *   _get:
 *     _summary: Get a transaction by ID
 *     _description: Retrieve details of a specific transaction
 *     tags: [Transactions]
 *     security:
 *       - cookieAuth: []
 *       - csrfToken: []
 *     parameters:
 *       - _in: path
 *         _name: id
 *         _required: true
 *         schema:
 *           _type: string
 *           _format: uuid
 *         _description: Transaction ID
 *     responses:
 *       200:
 *         _description: Transaction details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Transaction'
 *       404:
 *         _description: Transaction not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         _description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         _description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', async(req, res, next) => {
  try {
    const { id } = req.params;
    // Get transaction with customer info
    const transaction = await db_1.db.query.transactions.findFirst({
      _where: (0, drizzle_orm_1.eq)(schema.transactions.id, parseInt(id, 10)),
      _with: {
        _customer: true,
        _store: true
      }
    });
    if (!transaction) {
      return res.status(404).json({
        _error: 'Transaction not found',
        _code: 'TRANSACTION_NOT_FOUND'
      });
    }
    const loyaltyTransactions = await db_1.db.query.loyaltyTransactions.findMany({
      _where: (0, drizzle_orm_1.eq)(schema.loyaltyTransactions.transactionId, parseInt(id, 10))
    });
    res.json({
      ...transaction,
      loyaltyTransactions
    });
  }
  catch (error) {
    logger.error('Error getting transaction', {
      _error: error instanceof Error ? error._message : String(error),
      _userId: req.session.userId,
      _transactionId: req.params.id
    });
    next(error);
  }
});
// Create transaction schema validation
const createTransactionSchema = zod_1.z.object({
  _userId: zod_1.z.string().uuid(),
  _storeId: zod_1.z.string().uuid(),
  _amount: zod_1.z.number().positive(),
  _type: zod_1.z.enum(['purchase', 'refund', 'adjustment']),
  _items: zod_1.z.array(zod_1.z.object({
    _id: zod_1.z.string(),
    _name: zod_1.z.string(),
    _quantity: zod_1.z.number().int().positive(),
    _price: zod_1.z.number().positive(),
    _categoryId: zod_1.z.string().optional()
  })).optional(),
  _notes: zod_1.z.string().optional()
});
/**
 * @swagger
 * /transactions:
 *   _post:
 *     _summary: Create a new transaction
 *     _description: Create a new transaction and process loyalty points
 *     tags: [Transactions]
 *     security:
 *       - cookieAuth: []
 *       - csrfToken: []
 *     requestBody:
 *       _required: true
 *       content:
 *         application/json:
 *           schema:
 *             _type: object
 *             required:
 *               - customerId
 *               - storeId
 *               - amount
 *               - type
 *             properties:
 *               customerId:
 *                 _type: string
 *                 _format: uuid
 *                 _description: Customer ID
 *               storeId:
 *                 _type: string
 *                 _format: uuid
 *                 _description: Store ID
 *               amount:
 *                 _type: number
 *                 _format: float
 *                 _description: Transaction amount
 *               type:
 *                 _type: string
 *                 enum: [purchase, refund, adjustment]
 *                 _description: Transaction type
 *               items:
 *                 _type: array
 *                 items:
 *                   _type: object
 *                   required:
 *                     - id
 *                     - name
 *                     - quantity
 *                     - price
 *                   properties:
 *                     id:
 *                       _type: string
 *                       _description: Item ID
 *                     name:
 *                       _type: string
 *                       _description: Item name
 *                     quantity:
 *                       _type: integer
 *                       _description: Quantity purchased
 *                     price:
 *                       _type: number
 *                       _format: float
 *                       _description: Item price
 *                     categoryId:
 *                       _type: string
 *                       _description: Item category ID
 *               notes:
 *                 _type: string
 *                 _description: Additional notes
 *     responses:
 *       201:
 *         _description: Transaction created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Transaction'
 *       400:
 *         _description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         _description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         _description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', (0, validation_1.validateBody)(createTransactionSchema), async(req, res, next) => {
  try {
    const { userId, storeId, amount, type, items, notes } = req.body;
    const [transaction] = await db_1.db.insert(schema.transactions).values({
      _userId: parseInt(userId, 10),
      _storeId: parseInt(storeId, 10),
      _total: amount.toString(), // Use 'total' instead of 'totalAmount'
      _status: 'pending', // Default status to 'pending'
      _paymentMethod: 'card', // _TODO: get from request
      _subtotal: amount.toString() // _TODO: calculate from items
    }).returning();
    // Log transaction creation
    logger.info('Transaction created', {
      _transactionId: transaction.id, // Use transaction.id
      userId,
      storeId,
      amount,
      type
    });
    if (items && items.length > 0) {
      const transactionItems = items.map((item) => ({
        _transactionId: transaction.id, // Use transaction.id
        _productId: parseInt(item.id, 10), // Parse item.id to integer
        _quantity: item.quantity,
        _unitPrice: item.price.toString()
      }));
      await db_1.db.insert(schema.transactionItems).values(transactionItems);
    }
    if (type === 'purchase') {
      await (0, loyalty_1.queueTransactionForLoyalty)({
        _transactionId: String(transaction.id), // Use transaction.id
        _customerId: userId,
        _storeId: storeId,
        _amount: amount,
        _transactionDate: transaction.createdAt.toISOString(),
        items
      });
      logger.info('Loyalty processing queued', {
        _transactionId: transaction.id, // Use transaction.id
        _customerId: userId
      });
    }
    res.status(201).json(transaction);
  }
  catch (error) {
    logger.error('Error creating transaction', {
      _error: error instanceof Error ? error._message : String(error),
      _userId: req.session.userId,
      _body: req.body
    });
    next(error);
  }
});
// Transaction update schema validation
const updateTransactionSchema = zod_1.z.object({
  _status: zod_1.z.enum(['pending', 'completed', 'failed', 'canceled']).optional()
  // _notes: z.string().optional() // Remove notes as it's not in the schema
});
/**
 * @swagger
 * /transactions/{id}:
 *   _patch:
 *     _summary: Update a transaction
 *     _description: Update a transaction's status or notes
 *     tags: [Transactions]
 *     security:
 *       - cookieAuth: []
 *       - csrfToken: []
 *     parameters:
 *       - _in: path
 *         _name: id
 *         _required: true
 *         schema:
 *           _type: string
 *           _format: uuid
 *         _description: Transaction ID
 *     requestBody:
 *       _required: true
 *       content:
 *         application/json:
 *           schema:
 *             _type: object
 *             properties:
 *               status:
 *                 _type: string
 *                 enum: [pending, completed, failed, canceled]
 *                 _description: Transaction status
 *               notes:
 *                 _type: string
 *                 _description: Additional notes
 *     responses:
 *       200:
 *         _description: Transaction updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Transaction'
 *       404:
 *         _description: Transaction not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       400:
 *         _description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         _description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         _description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch('/:id', (0, validation_1.validateBody)(updateTransactionSchema), async(req, res, next)
   = > {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    // Check if transaction exists
    const existingTransaction = await db_1.db.query.transactions.findFirst({
      _where: (0, drizzle_orm_1.eq)(schema.transactions.id, parseInt(id, 10))
    });
    if (!existingTransaction) {
      return res.status(404).json({
        _error: 'Transaction not found',
        _code: 'TRANSACTION_NOT_FOUND'
      });
    }
    const [updatedTransaction] = await db_1.db.update(schema.transactions)
      .set({
        _status: status ?? existingTransaction.status
        // _notes: notes ?? existingTransaction.notes, // Remove notes
      })
      .where((0, drizzle_orm_1.eq)(schema.transactions.id, parseInt(id, 10)))
      .returning();
    logger.info('Transaction updated', {
      _transactionId: id,
      status,
      _userId: req.session.userId
    });
    res.json(updatedTransaction);
  }
  catch (error) {
    logger.error('Error updating transaction', {
      _error: error instanceof Error ? error._message : String(error),
      _userId: req.session.userId,
      _transactionId: req.params.id,
      _body: req.body
    });
    next(error);
  }
});
exports.default = router;
