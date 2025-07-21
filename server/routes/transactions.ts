// server/routes/transactions.ts
import { Router, Request, Response, NextFunction } from 'express';
import { isAuthenticated, validateSession } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { sensitiveOpRateLimiter } from '../middleware/rate-limit';
import { z } from 'zod';
import { getLogger } from '../../src/logging';
import { db } from '../../db';
import * as schema from '@shared/schema';
import { eq, gte, lte, desc, count, and, SQL } from 'drizzle-orm';
import { queueTransactionForLoyalty } from '../../src/queue/processors/loyalty';

const logger = getLogger().child({ component: 'transactions-api' });

// Create router
const router = Router();

// Apply middleware to all routes in this router
router.use(isAuthenticated);
router.use(validateSession);
router.use(sensitiveOpRateLimiter);

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
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerId, storeId, type, status, from, to } = req.query;
    const page = parseInt(req.query.page as string ?? '1', 10);
    const limit = parseInt(req.query.limit as string ?? '20', 10);
    const offset = (page - 1) * limit;

    const conditions: (SQL<unknown> | undefined)[] = [
      customerId ? eq(schema.transactions.customerId, parseInt(customerId as string, 10)) : undefined,
      storeId ? eq(schema.transactions.storeId, parseInt(storeId as string, 10)) : undefined,
      type ? eq(schema.transactions.status, type as string) : undefined,
      status ? eq(schema.transactions.status, status as string) : undefined,
      from ? gte(schema.transactions.createdAt, new Date(from as string)) : undefined,
      to ? lte(schema.transactions.createdAt, new Date(to as string)) : undefined,
    ].filter((c): c is SQL<unknown> => !!c);

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const totalQuery = db.select({ count: count() }).from(schema.transactions).where(whereClause);
    const [{ count: total }] = await totalQuery;

    const transactionsQuery = db.select().from(schema.transactions).where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(schema.transactions.createdAt));

    const transactions = await transactionsQuery;

    res.json({
      transactions,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        page,
        limit,
      },
    });
  } catch (error) {
    logger.error('Error getting transactions', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.session.userId,
      query: req.query,
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
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Get transaction with customer info
    const transaction = await db.query.transactions.findFirst({
      where: eq(schema.transactions.transactionId, parseInt(id, 10)),
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

    const loyaltyTransactions = await db.query.loyaltyTransactions.findMany({
      where: eq(schema.loyaltyTransactions.transactionId, parseInt(id, 10)),
    });

    res.json({
      ...transaction,
      loyaltyTransactions,
    });
  } catch (error) {
    logger.error('Error getting transaction', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.session.userId,
      transactionId: req.params.id,
    });
    next(error);
  }
});

// Create transaction schema validation
const createTransactionSchema = z.object({
  customerId: z.string().uuid(),
  storeId: z.string().uuid(),
  amount: z.number().positive(),
  type: z.enum(['purchase', 'refund', 'adjustment']),
  items: z.array(z.object({
    id: z.string(),
    name: z.string(),
    quantity: z.number().int().positive(),
    price: z.number().positive(),
    categoryId: z.string().optional(),
  })).optional(),
  notes: z.string().optional(),
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
router.post('/', validateBody(createTransactionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerId, storeId, amount, type, items, notes } = req.body;

    const [transaction] = await db.insert(schema.transactions).values({
      customerId: parseInt(customerId, 10),
      storeId: parseInt(storeId, 10),
      totalAmount: amount.toString(),
      status: type,
      notes,
    }).returning();

    // Log transaction creation
    logger.info('Transaction created', {
      transactionId: transaction.transactionId,
      customerId,
      storeId,
      amount,
      type,
      userId: req.session.userId
    });

    if (items && items.length > 0) {
      const transactionItems = items.map((item: any) => ({
        transactionId: transaction.transactionId,
        productId: parseInt(item.id, 10),
        quantity: item.quantity,
        unitPrice: item.price.toString(),
      }));
      await db.insert(schema.transactionItems).values(transactionItems);
    }

    if (type === 'purchase') {
      await queueTransactionForLoyalty({
        transactionId: transaction.transactionId,
        customerId: parseInt(customerId, 10),
        storeId: parseInt(storeId, 10),
        amount: amount,
        transactionDate: transaction.createdAt!.toISOString(),
        items,
      });
      
      logger.info('Loyalty processing queued', {
        transactionId: transaction.transactionId,
        customerId,
      });
    }

    res.status(201).json(transaction);
  } catch (error) {
    logger.error('Error creating transaction', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.session.userId,
      body: req.body,
    });
    next(error);
  }
});

// Transaction update schema validation
const updateTransactionSchema = z.object({
  status: z.enum(['pending', 'completed', 'failed', 'canceled']).optional(),
  notes: z.string().optional()
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
router.patch('/:id', validateBody(updateTransactionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    // Check if transaction exists
    const existingTransaction = await db.query.transactions.findFirst({
      where: eq(schema.transactions.transactionId, parseInt(id, 10))
    });

    if (!existingTransaction) {
      return res.status(404).json({
        error: 'Transaction not found',
        code: 'TRANSACTION_NOT_FOUND'
      });
    }

    const [updatedTransaction] = await db.update(schema.transactions)
      .set({
        status: status ?? existingTransaction.status,
        notes: notes ?? existingTransaction.notes,
      })
      .where(eq(schema.transactions.transactionId, parseInt(id, 10)))
      .returning();

    logger.info('Transaction updated', {
      transactionId: id,
      status,
      userId: req.session.userId,
    });

    res.json(updatedTransaction);
  } catch (error) {
    logger.error('Error updating transaction', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.session.userId,
      transactionId: req.params.id,
      body: req.body,
    });
    next(error);
  }
});

export default router;
