'use strict';
const __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  let desc = Object.getOwnPropertyDescriptor(m, k);
  if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
    desc = { enumerable: true, get: function() { return m[k]; } };
  }
  Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  o[k2] = m[k];
}));
const __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
  Object.defineProperty(o, 'default', { enumerable: true, value: v });
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
Object.defineProperty(exports, '__esModule', { value: true });
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
const logger = (0, logging_1.getLogger)().child({ component: 'transactions-api' });
// Create router
const router = (0, express_1.Router)();
// Apply middleware to all routes in this router
router.use(auth_1.isAuthenticated);
router.use(auth_1.validateSession);
router.use(rate_limit_1.sensitiveOpRateLimiter);
/**
 * @swagger
 * /transactions:
 *   get:
 *     summary: Get all transactions
 *     description: Retrieve a list of all transactions with optional filtering
 *     tags: [Transactions]
 *     security:
 *       - cookieAuth: []
 *       - csrfToken: []
 *     parameters:
 *       - in: query
 *         name: customerId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by customer ID
 *       - in: query
 *         name: storeId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by store ID
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [purchase, refund, adjustment]
 *         description: Filter by transaction type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, completed, failed, canceled]
 *         description: Filter by transaction status
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by start date
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by end date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: A list of transactions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transactions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Transaction'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
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
    const totalQuery = db_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema.transactions).where(whereClause);
    const [{ count: total }] = await totalQuery;
    const transactionsQuery = db_1.db.select().from(schema.transactions).where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy((0, drizzle_orm_1.desc)(schema.transactions.createdAt));
    const transactions = await transactionsQuery;
    res.json({
      transactions,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        page,
        limit
      }
    });
  }
  catch (error) {
    logger.error('Error getting transactions', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.session.userId,
      query: req.query
    });
    next(error);
  }
});
/**
 * @swagger
 * /transactions/{id}:
 *   get:
 *     summary: Get a transaction by ID
 *     description: Retrieve details of a specific transaction
 *     tags: [Transactions]
 *     security:
 *       - cookieAuth: []
 *       - csrfToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Transaction ID
 *     responses:
 *       200:
 *         description: Transaction details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Transaction'
 *       404:
 *         description: Transaction not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
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
      where: (0, drizzle_orm_1.eq)(schema.transactions.id, parseInt(id, 10)),
      with: {
        customer: true,
        store: true
      }
    });
    if (!transaction) {
      return res.status(404).json({
        error: 'Transaction not found',
        code: 'TRANSACTION_NOT_FOUND'
      });
    }
    const loyaltyTransactions = await db_1.db.query.loyaltyTransactions.findMany({
      where: (0, drizzle_orm_1.eq)(schema.loyaltyTransactions.transactionId, parseInt(id, 10))
    });
    res.json({
      ...transaction,
      loyaltyTransactions
    });
  }
  catch (error) {
    logger.error('Error getting transaction', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.session.userId,
      transactionId: req.params.id
    });
    next(error);
  }
});
// Create transaction schema validation
const createTransactionSchema = zod_1.z.object({
  userId: zod_1.z.string().uuid(),
  storeId: zod_1.z.string().uuid(),
  amount: zod_1.z.number().positive(),
  type: zod_1.z.enum(['purchase', 'refund', 'adjustment']),
  items: zod_1.z.array(zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    quantity: zod_1.z.number().int().positive(),
    price: zod_1.z.number().positive(),
    categoryId: zod_1.z.string().optional()
  })).optional(),
  notes: zod_1.z.string().optional()
});
/**
 * @swagger
 * /transactions:
 *   post:
 *     summary: Create a new transaction
 *     description: Create a new transaction and process loyalty points
 *     tags: [Transactions]
 *     security:
 *       - cookieAuth: []
 *       - csrfToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customerId
 *               - storeId
 *               - amount
 *               - type
 *             properties:
 *               customerId:
 *                 type: string
 *                 format: uuid
 *                 description: Customer ID
 *               storeId:
 *                 type: string
 *                 format: uuid
 *                 description: Store ID
 *               amount:
 *                 type: number
 *                 format: float
 *                 description: Transaction amount
 *               type:
 *                 type: string
 *                 enum: [purchase, refund, adjustment]
 *                 description: Transaction type
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - id
 *                     - name
 *                     - quantity
 *                     - price
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: Item ID
 *                     name:
 *                       type: string
 *                       description: Item name
 *                     quantity:
 *                       type: integer
 *                       description: Quantity purchased
 *                     price:
 *                       type: number
 *                       format: float
 *                       description: Item price
 *                     categoryId:
 *                       type: string
 *                       description: Item category ID
 *               notes:
 *                 type: string
 *                 description: Additional notes
 *     responses:
 *       201:
 *         description: Transaction created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Transaction'
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', (0, validation_1.validateBody)(createTransactionSchema), async(req, res, next) => {
  try {
    const { userId, storeId, amount, type, items, notes } = req.body;
    const [transaction] = await db_1.db.insert(schema.transactions).values({
      userId: parseInt(userId, 10),
      storeId: parseInt(storeId, 10),
      total: amount.toString(), // Use 'total' instead of 'totalAmount'
      status: 'pending', // Default status to 'pending'
      paymentMethod: 'card', // TODO: get from request
      subtotal: amount.toString() // TODO: calculate from items
    }).returning();
    // Log transaction creation
    logger.info('Transaction created', {
      transactionId: transaction.id, // Use transaction.id
      userId,
      storeId,
      amount,
      type
    });
    if (items && items.length > 0) {
      const transactionItems = items.map((item) => ({
        transactionId: transaction.id, // Use transaction.id
        productId: parseInt(item.id, 10), // Parse item.id to integer
        quantity: item.quantity,
        unitPrice: item.price.toString()
      }));
      await db_1.db.insert(schema.transactionItems).values(transactionItems);
    }
    if (type === 'purchase') {
      await (0, loyalty_1.queueTransactionForLoyalty)({
        transactionId: String(transaction.id), // Use transaction.id
        customerId: userId,
        storeId: storeId,
        amount: amount,
        transactionDate: transaction.createdAt.toISOString(),
        items
      });
      logger.info('Loyalty processing queued', {
        transactionId: transaction.id, // Use transaction.id
        customerId: userId
      });
    }
    res.status(201).json(transaction);
  }
  catch (error) {
    logger.error('Error creating transaction', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.session.userId,
      body: req.body
    });
    next(error);
  }
});
// Transaction update schema validation
const updateTransactionSchema = zod_1.z.object({
  status: zod_1.z.enum(['pending', 'completed', 'failed', 'canceled']).optional()
  // notes: z.string().optional() // Remove notes as it's not in the schema
});
/**
 * @swagger
 * /transactions/{id}:
 *   patch:
 *     summary: Update a transaction
 *     description: Update a transaction's status or notes
 *     tags: [Transactions]
 *     security:
 *       - cookieAuth: []
 *       - csrfToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Transaction ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, completed, failed, canceled]
 *                 description: Transaction status
 *               notes:
 *                 type: string
 *                 description: Additional notes
 *     responses:
 *       200:
 *         description: Transaction updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Transaction'
 *       404:
 *         description: Transaction not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch('/:id', (0, validation_1.validateBody)(updateTransactionSchema), async(req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    // Check if transaction exists
    const existingTransaction = await db_1.db.query.transactions.findFirst({
      where: (0, drizzle_orm_1.eq)(schema.transactions.id, parseInt(id, 10))
    });
    if (!existingTransaction) {
      return res.status(404).json({
        error: 'Transaction not found',
        code: 'TRANSACTION_NOT_FOUND'
      });
    }
    const [updatedTransaction] = await db_1.db.update(schema.transactions)
      .set({
        status: status ?? existingTransaction.status
        // notes: notes ?? existingTransaction.notes, // Remove notes
      })
      .where((0, drizzle_orm_1.eq)(schema.transactions.id, parseInt(id, 10)))
      .returning();
    logger.info('Transaction updated', {
      transactionId: id,
      status,
      userId: req.session.userId
    });
    res.json(updatedTransaction);
  }
  catch (error) {
    logger.error('Error updating transaction', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.session.userId,
      transactionId: req.params.id,
      body: req.body
    });
    next(error);
  }
});
exports.default = router;
