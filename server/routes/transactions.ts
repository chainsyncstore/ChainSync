// server/routes/transactions.ts
import { Router, Request, Response, NextFunction } from 'express';
import { isAuthenticated, validateSession } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { sensitiveOpRateLimiter } from '../middleware/rate-limit';
import { z } from 'zod';
import { getLogger } from '../../src/logging';
import { db } from '../../db';
import * as schema from '@shared/schema';
import { queueTransactionForLoyalty } from '../../src/queue/processors/loyalty';
import { cacheable } from '../../src/cache/redis';

// Get logger for transactions routes
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
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '20', 10);
    const offset = (page - 1) * limit;

    // Build query based on filters
    let query = db.select().from(schema.transactions);

    if (customerId) {
      query = query.where(eq(schema.transactions.customerId, customerId as string));
    }

    if (storeId) {
      query = query.where(eq(schema.transactions.storeId, storeId as string));
    }

    if (type) {
      query = query.where(eq(schema.transactions.type, type as string));
    }

    if (status) {
      query = query.where(eq(schema.transactions.status, status as string));
    }

    if (from) {
      query = query.where(gte(schema.transactions.createdAt, new Date(from as string)));
    }

    if (to) {
      query = query.where(lte(schema.transactions.createdAt, new Date(to as string)));
    }

    // Get total count for pagination
    const countQuery = db.select({ count: count() }).from(schema.transactions);
    const [{ count: total }] = await countQuery;

    // Get paginated results
    const transactions = await query
      .limit(limit)
      .offset(offset)
      .orderBy(desc(schema.transactions.createdAt));

    // Return transactions with pagination info
    res.json({
      transactions,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        page,
        limit
      }
    });
  } catch (error) {
    logger.error('Error getting transactions', error instanceof Error ? error : new Error(String(error)), {
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
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Get transaction with customer info
    const transaction = await db.query.transactions.findFirst({
      where: eq(schema.transactions.id, id),
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

    // Get loyalty updates related to this transaction
    const loyaltyUpdates = await db.select()
      .from(schema.loyaltyUpdates)
      .where(eq(schema.loyaltyUpdates.transactionId, id));

    // Return transaction with related data
    res.json({
      ...transaction,
      loyaltyUpdates
    });
  } catch (error) {
    logger.error('Error getting transaction', error instanceof Error ? error : new Error(String(error)), {
      userId: req.session.userId,
      transactionId: req.params.id
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
    categoryId: z.string().optional()
  })).optional(),
  notes: z.string().optional()
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

    // Create transaction
    const [transaction] = await db.insert(schema.transactions)
      .values({
        customerId,
        storeId,
        amount,
        type,
        status: 'completed',
        notes,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    // Log transaction creation
    logger.info('Transaction created', {
      transactionId: transaction.id,
      customerId,
      storeId,
      amount,
      type,
      userId: req.session.userId
    });

    // Store transaction items if provided
    if (items && items.length > 0) {
      await db.insert(schema.transactionItems)
        .values(items.map(item => ({
          transactionId: transaction.id,
          itemId: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          categoryId: item.categoryId,
          createdAt: new Date()
        })));
    }

    // Queue loyalty processing for purchases
    if (type === 'purchase') {
      await queueTransactionForLoyalty({
        transactionId: transaction.id,
        customerId,
        storeId,
        amount,
        transactionDate: transaction.createdAt.toISOString(),
        items
      });
      
      logger.info('Loyalty processing queued', {
        transactionId: transaction.id,
        customerId
      });
    }

    // Return created transaction
    res.status(201).json(transaction);
  } catch (error) {
    logger.error('Error creating transaction', error instanceof Error ? error : new Error(String(error)), {
      userId: req.session.userId,
      body: req.body
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
      where: eq(schema.transactions.id, id)
    });

    if (!existingTransaction) {
      return res.status(404).json({
        error: 'Transaction not found',
        code: 'TRANSACTION_NOT_FOUND'
      });
    }

    // Update transaction
    const [updatedTransaction] = await db.update(schema.transactions)
      .set({
        status: status ?? existingTransaction.status,
        notes: notes ?? existingTransaction.notes,
        updatedAt: new Date()
      })
      .where(eq(schema.transactions.id, id))
      .returning();

    // Log transaction update
    logger.info('Transaction updated', {
      transactionId: id,
      status,
      userId: req.session.userId
    });

    // Return updated transaction
    res.json(updatedTransaction);
  } catch (error) {
    logger.error('Error updating transaction', error instanceof Error ? error : new Error(String(error)), {
      userId: req.session.userId,
      transactionId: req.params.id,
      body: req.body
    });
    next(error);
  }
});

export default router;
