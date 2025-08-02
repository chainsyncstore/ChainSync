// server/routes/transactions.ts
import { Router, Request, Response, NextFunction } from 'express';
import { isAuthenticated, validateSession } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { sensitiveOpRateLimiter } from '../middleware/rate-limit';
import { z } from 'zod';
import { getLogger } from '../../src/logging';
import { db } from '../../db/index.js';
import * as schema from '../../shared/schema.js';
import { eq, gte, lte, desc, count, and, SQL } from 'drizzle-orm';
import { queueTransactionForLoyalty } from '../../src/queue/processors/loyalty';

const logger = getLogger().child({ _component: 'transactions-api' });

// Create router
const router = Router();

// Apply middleware to all routes in this router
router.use(isAuthenticated);
router.use(validateSession);
router.use(sensitiveOpRateLimiter);

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
router.get('/', async(_req: Request, _res: Response, _next: NextFunction) => {
  try {
    const { customerId, storeId, status, from, to } = req.query;
    const page = parseInt(req.query.page as string ?? '1', 10);
    const limit = parseInt(req.query.limit as string ?? '20', 10);
    const offset = (page - 1) * limit;

    // Map query status to schema status enum
    const mappedStatus = status === 'failed' || status === 'canceled' ? 'cancelled' : status;

    const _conditions: (SQL<unknown> | undefined)[] = [
      customerId ? eq(schema.transactions.customerId, parseInt(customerId as string, 10)) : undefined,
      storeId ? eq(schema.transactions.storeId, parseInt(storeId as string, 10)) : undefined,
      mappedStatus ? eq(schema.transactions.status, mappedStatus as 'pending' | 'completed' | 'cancelled') : undefined,
      from ? gte(schema.transactions.createdAt, new Date(from as string)) : undefined,
      to ? lte(schema.transactions.createdAt, new Date(to as string)) : undefined
    ].filter((c): c is SQL<unknown> => !!c);

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const totalQuery = db.select({ _count: count() }).from(schema.transactions).where(whereClause);
    const result = await totalQuery;
    const total = result[0]?.count ?? 0;

    const transactionsQuery = db.select().from(schema.transactions).where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(schema.transactions.createdAt));

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
  } catch (error) {
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
router.get('/:id', async(_req: Request, _res: Response, _next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        _error: 'Transaction ID is required',
        _code: 'MISSING_TRANSACTION_ID'
      });
      return;
    }

    // Get transaction with customer info
    const transaction = await db.query.transactions.findFirst({
      _where: eq(schema.transactions.id, parseInt(id, 10)),
      _with: {
        _customer: true,
        _store: true
      }
    });

    if (!transaction) {
      res.status(404).json({
        _error: 'Transaction not found',
        _code: 'TRANSACTION_NOT_FOUND'
      });
      return;
    }

    const loyaltyTransactions = await db.query.loyaltyTransactions.findMany({
      _where: eq(schema.loyaltyTransactions.transactionId, parseInt(id!, 10))
    });

    res.json({
      ...transaction,
      loyaltyTransactions
    });
  } catch (error) {
    logger.error('Error getting transaction', {
      _error: error instanceof Error ? error._message : String(error),
      _userId: req.session.userId,
      _transactionId: req.params.id
    });
    next(error);
  }
});

// Create transaction schema validation
const createTransactionSchema = z.object({
  _userId: z.string().uuid(),
  _storeId: z.string().uuid(),
  _amount: z.number().positive(),
  _type: z.enum(['purchase', 'refund', 'adjustment']),
  _items: z.array(z.object({
    _id: z.string(),
    _name: z.string(),
    _quantity: z.number().int().positive(),
    _price: z.number().positive(),
    _categoryId: z.string().optional()
  })).optional(),
  _notes: z.string().optional()
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
router.post('/', validateBody(createTransactionSchema), async(_req: Request, _res: Response, _next: NextFunction)
   = > {
  try {
    const { userId, storeId, amount, type, items, notes } = req.body;

    const [transaction] = await db.insert(schema.transactions).values({
      _userId: parseInt(userId, 10),
      _storeId: parseInt(storeId, 10),
      _total: amount.toString(), // Use 'total' instead of 'totalAmount'
      _paymentMethod: 'card' as const, // _TODO: get from request
      _subtotal: amount.toString() // _TODO: calculate from items
    }).returning();

    // Log transaction creation
    logger.info('Transaction created', {
      _transactionId: transaction?.id, // Use transaction.id
      userId,
      storeId,
      amount,
      type
    });

    if (items && items.length > 0 && transaction) {
      const transactionItems = items.map((_item: any) => ({
        _transactionId: transaction.id, // Use transaction.id
        _productId: parseInt(item.id, 10), // Parse item.id to integer
        _quantity: item.quantity,
        _unitPrice: item.price.toString()
      }));
      await db.insert(schema.transactionItems).values(transactionItems);
    }

    if (type === 'purchase' && transaction) {
      await queueTransactionForLoyalty({
        _transactionId: String(transaction.id), // Use transaction.id
        _customerId: userId as string,
        _storeId: storeId as string,
        _amount: amount,
        _transactionDate: transaction.createdAt!.toISOString(),
        items
      });

      logger.info('Loyalty processing queued', {
        _transactionId: transaction.id, // Use transaction.id
        _customerId: userId
      });
    }

    res.status(201).json(transaction);
  } catch (error) {
    logger.error('Error creating transaction', {
      _error: error instanceof Error ? error._message : String(error),
      _userId: req.session.userId,
      _body: req.body
    });
    next(error);
  }
});

// Transaction update schema validation
const updateTransactionSchema = z.object({
  _status: z.enum(['pending', 'completed', 'failed', 'canceled']).optional()
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
router.patch('/:id', validateBody(updateTransactionSchema), async(_req: Request, _res: Response, _next: NextFunction): Promise<void>
   = > {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!id) {
      res.status(400).json({
        _error: 'Transaction ID is required',
        _code: 'MISSING_TRANSACTION_ID'
      });
      return;
    }

    // Check if transaction exists
    const existingTransaction = await db.query.transactions.findFirst({
      _where: eq(schema.transactions.id, parseInt(id, 10))
    });

    if (!existingTransaction) {
      res.status(404).json({
        _error: 'Transaction not found',
        _code: 'TRANSACTION_NOT_FOUND'
      });
      return;
    }

    const [updatedTransaction] = await db.update(schema.transactions)
      .set({
        _status: (status ?? existingTransaction.status) as 'pending' | 'completed' | 'cancelled'
      } as any)
      .where(eq(schema.transactions.id, parseInt(id!, 10)))
      .returning();

    logger.info('Transaction updated', {
      _transactionId: id,
      status,
      _userId: req.session.userId
    });

    res.json(updatedTransaction);
  } catch (error) {
    logger.error('Error updating transaction', {
      _error: error instanceof Error ? error._message : String(error),
      _userId: req.session.userId,
      _transactionId: req.params.id,
      _body: req.body
    });
    next(error);
  }
});

export default router;
