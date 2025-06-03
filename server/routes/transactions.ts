// server/routes/transactions.ts
import { Router, Request, Response, NextFunction } from 'express';
import { isAuthenticated, validateSession } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { sensitiveOpRateLimiter } from '../middleware/rate-limiter';
import { z } from 'zod';
import { getLogger, getRequestLogger } from '../../src/logging';
import { db } from '../../db';
import * as schema from '@shared/schema';
import { queueTransactionForLoyalty } from '../../src/queue/processors/loyalty';
import { cacheable } from '../../src/cache/redis';
import { UserPayload } from '../types/user';
import { eq, gte, lte, count, desc, sql, and as drizzleAnd, or as drizzleOr } from 'drizzle-orm';

const logger = getLogger().child({ component: 'transactions-api' });
const router = Router();

// Apply middleware to all routes in this router
router.use(isAuthenticated as any);
router.use(validateSession as any);
router.use(sensitiveOpRateLimiter as any);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  const reqLogger = getRequestLogger(req) || logger;
  try {
    const { customerId, storeId, type, status, from, to } = req.query;
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '20', 10);
    const offset = (page - 1) * limit;

    const conditions = [];
    if (customerId) conditions.push(eq(schema.transactions.customerId, parseInt(customerId as string)));
    if (storeId) conditions.push(eq(schema.transactions.storeId, parseInt(storeId as string)));
    if (type) conditions.push(eq((schema.transactions as any).type, type as string));
    if (status) conditions.push(eq(schema.transactions.status, status as string));
    if (from) conditions.push(gte(schema.transactions.createdAt, new Date(from as string)));
    if (to) conditions.push(lte(schema.transactions.createdAt, new Date(to as string)));

    const whereCondition = conditions.length > 0 ? drizzleAnd(...conditions) : undefined;

    const totalResult = await db.select({ count: count() })
      .from(schema.transactions)
      .where(whereCondition);
    const total = totalResult[0]?.count || 0;

    const transactions = await db.select()
      .from(schema.transactions)
      .where(whereCondition)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(schema.transactions.createdAt));

    res.json({
      transactions,
      pagination: { total, pages: Math.ceil(total / limit), page, limit }
    });
  } catch (error: unknown) {
    reqLogger.error('Error getting transactions', error instanceof Error ? error : new Error(String(error)), {
      userId: (req.user as UserPayload)?.id,
      query: req.query
    });
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const reqLogger = getRequestLogger(req) || logger;
  try {
    const { id } = req.params;
    const transactionIdNum = parseInt(id);
    if (isNaN(transactionIdNum)) {
      return res.status(400).json({ error: 'Invalid transaction ID format' });
    }

    const transaction = await db.query.transactions.findFirst({
      where: eq(schema.transactions.transactionId, transactionIdNum),
      with: { customer: true, store: true }
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found', code: 'TRANSACTION_NOT_FOUND' });
    }

    const loyaltyUpdates = await db.select()
      .from((schema as any).loyaltyUpdates) // Assuming loyaltyUpdates schema exists
      .where(eq(((schema as any).loyaltyUpdates as any).transactionId, transactionIdNum));

    res.json({ ...transaction, loyaltyUpdates });
  } catch (error: unknown) {
    reqLogger.error('Error getting transaction', error instanceof Error ? error : new Error(String(error)), {
      userId: (req.user as UserPayload)?.id,
      transactionId: req.params.id
    });
    next(error);
  }
});

// Zod schema for validating req.body when creating a transaction
const createTransactionBodySchema = z.object({
  customerId: z.string().uuid().optional().transform(val => val ? parseInt(val, 10) : undefined),
  storeId: z.string().uuid().transform(val => parseInt(val, 10)),
  amount: z.number().positive(), // This is totalAmountFromRequest
  type: z.enum(['purchase', 'refund', 'adjustment']),
  items: z.array(z.object({
    id: z.string().transform(val => parseInt(val, 10)), // This is productId
    name: z.string(), // Not directly used for DB insert but good for validation
    quantity: z.number().int().positive(),
    price: z.number().positive(), // This is unitPrice
    inventoryBatchId: z.number().int().positive().optional(),
  })).min(1, "At least one item is required for a transaction").optional(),
  notes: z.string().max(1000).optional(),
  paymentMethod: z.enum(["cash", "card", "bank_transfer", "mobile_money"]).default("cash"),
  paymentStatus: z.enum(["pending", "paid", "partially_paid", "overpaid", "failed"]).default("pending"),
  referenceNumber: z.string().min(1).max(50).optional(),
});


router.post('/', validateBody(createTransactionBodySchema), async (req: Request, res: Response, next: NextFunction) => {
  const reqLogger = getRequestLogger(req) || logger;
  try {
    const { 
      customerId, 
      storeId, 
      amount: totalAmountFromRequest, // Renamed from 'amount' to avoid confusion
      type, 
      items, 
      notes,
      paymentMethod,
      paymentStatus,
      referenceNumber 
    } = req.body as z.infer<typeof createTransactionBodySchema>; // Use validated and transformed body

    const user = req.user as UserPayload;
    const userIdFromSession = user?.id ? parseInt(user.id) : undefined;

    const transactionDbData = {
      customerId, // Already parsed by Zod transform if present
      storeId,    // Already parsed by Zod transform
      totalAmount: Number(totalAmountFromRequest),
      total: Number(totalAmountFromRequest), 
      type,
      status: 'completed',
      notes,
      userId: userIdFromSession,
      cashierId: userIdFromSession,
      paymentMethod,
      paymentStatus,
      referenceNumber: referenceNumber || `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const validatedDbData = schema.transactionInsertSchema.parse(transactionDbData);

    const [transaction] = await db.insert(schema.transactions)
      .values(validatedDbData)
      .returning();

    reqLogger.info('Transaction created', {
      transactionId: transaction.transactionId,
      customerId,
      storeId,
      totalAmount: totalAmountFromRequest,
      type,
      userId: user?.id
    });

    if (items && Array.isArray(items) && items.length > 0) {
      const transactionItemsToInsert = items.map((item: any) => { // item is from createTransactionBodySchema.items
        const itemData = {
          transactionId: transaction.transactionId,
          productId: item.id, // item.id is already parsed productId by Zod
          quantity: item.quantity,
          unitPrice: item.price, // item.price is unitPrice
          inventoryBatchId: item.inventoryBatchId, // Optional, will be undefined if not provided
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        // Ensure inventoryBatchId is either a number or null/undefined for the schema
        if (itemData.inventoryBatchId === undefined) {
          delete (itemData as any).inventoryBatchId; // Remove if not present, Drizzle handles optional
        }
        return schema.transactionItemInsertSchema.parse(itemData);
      });
      if (transactionItemsToInsert.length > 0) {
        await db.insert(schema.transactionItems).values(transactionItemsToInsert);
      }
    }

    if (type === 'purchase') {
      await queueTransactionForLoyalty({
        transactionId: transaction.transactionId,
        customerId: customerId ? String(customerId) : undefined,
        storeId: String(storeId),
        amount: Number(totalAmountFromRequest),
        transactionDate: transaction.createdAt.toISOString(),
        items: items || [] // Pass original items structure if needed by queue
      });
      reqLogger.info('Loyalty processing queued', { transactionId: transaction.transactionId, customerId });
    }

    res.status(201).json(transaction);
  } catch (error: unknown) {
    reqLogger.error('Error creating transaction', error instanceof Error ? error : new Error(String(error)), {
      userId: (req.user as UserPayload)?.id,
      body: req.body
    });
    next(error);
  }
});

const updateTransactionBodySchema = z.object({
  status: z.enum(['pending', 'completed', 'failed', 'canceled']).optional(),
  notes: z.string().max(1000).optional()
});

router.patch('/:id', validateBody(updateTransactionBodySchema), async (req: Request, res: Response, next: NextFunction) => {
  const reqLogger = getRequestLogger(req) || logger;
  try {
    const { id } = req.params;
    const transactionIdNum = parseInt(id);
    if (isNaN(transactionIdNum)) {
      return res.status(400).json({ error: 'Invalid transaction ID format' });
    }
    const { status, notes } = req.body as z.infer<typeof updateTransactionBodySchema>;

    const existingTransaction = await db.query.transactions.findFirst({
      where: eq(schema.transactions.transactionId, transactionIdNum)
    });

    if (!existingTransaction) {
      return res.status(404).json({ error: 'Transaction not found', code: 'TRANSACTION_NOT_FOUND' });
    }

    const [updatedTransaction] = await db.update(schema.transactions)
      .set({
        status: status ?? existingTransaction.status,
        notes: notes ?? existingTransaction.notes,
        updatedAt: new Date()
      })
      .where(eq(schema.transactions.transactionId, transactionIdNum))
      .returning();

    reqLogger.info('Transaction updated', {
      transactionId: id,
      status,
      userId: (req.user as UserPayload)?.id
    });

    res.json(updatedTransaction);
  } catch (error: unknown) {
    reqLogger.error('Error updating transaction', error instanceof Error ? error : new Error(String(error)), {
      userId: (req.user as UserPayload)?.id,
      transactionId: req.params.id,
      body: req.body
    });
    next(error);
  }
});

export default router;
