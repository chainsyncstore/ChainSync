import { Router } from 'express';
import { storage } from './storage';
import { insertUserSchema, insertStoreSchema, insertProductSchema, insertInventorySchema, insertTransactionSchema } from '@shared/schema';
import { z } from 'zod';

const router = Router();

// Health check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// User routes
router.get('/api/users', async (_req, res) => {
  try {
    const users = await storage.getAllUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.get('/api/users/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const user = await storage.getUserById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

router.post('/api/users', async (req, res) => {
  try {
    const userData = insertUserSchema.parse(req.body);
    const user = await storage.createUser(userData);
    res.status(201).json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid user data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Store routes
router.get('/api/stores', async (_req, res) => {
  try {
    const stores = await storage.getAllStores();
    res.json(stores);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stores' });
  }
});

router.post('/api/stores', async (req, res) => {
  try {
    const storeData = insertStoreSchema.parse(req.body);
    const store = await storage.createStore(storeData);
    res.status(201).json(store);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid store data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create store' });
  }
});

// Product routes
router.get('/api/products', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;
    const search = req.query.search as string;

    if (search) {
      const products = await storage.searchProducts(search);
      res.json(products);
    } else {
      const products = await storage.getAllProducts(limit, offset);
      res.json(products);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

router.get('/api/products/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const product = await storage.getProductById(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

router.post('/api/products', async (req, res) => {
  try {
    const productData = insertProductSchema.parse(req.body);
    const product = await storage.createProduct(productData);
    res.status(201).json(product);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid product data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Inventory routes
router.get('/api/inventory', async (req, res) => {
  try {
    const storeId = req.query.storeId ? parseInt(req.query.storeId as string) : undefined;
    const lowStock = req.query.lowStock === 'true';

    if (lowStock) {
      const items = await storage.getLowStockItems(storeId);
      res.json(items);
    } else if (storeId) {
      const items = await storage.getInventoryByStore(storeId);
      res.json(items);
    } else {
      res.status(400).json({ error: 'storeId parameter is required' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

router.post('/api/inventory', async (req, res) => {
  try {
    const inventoryData = insertInventorySchema.parse(req.body);
    const inventory = await storage.createInventoryItem(inventoryData);
    res.status(201).json(inventory);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid inventory data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create inventory item' });
  }
});

// Transaction routes
router.get('/api/transactions', async (req, res) => {
  try {
    const storeId = req.query.storeId ? parseInt(req.query.storeId as string) : undefined;
    const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

    if (storeId) {
      const transactions = await storage.getTransactionsByStore(storeId, limit);
      res.json(transactions);
    } else if (userId) {
      const transactions = await storage.getTransactionsByUser(userId, limit);
      res.json(transactions);
    } else {
      res.status(400).json({ error: 'storeId or userId parameter is required' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

router.post('/api/transactions', async (req, res) => {
  try {
    const transactionData = insertTransactionSchema.parse(req.body);
    const transaction = await storage.createTransaction(transactionData);
    res.status(201).json(transaction);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid transaction data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

// Sales analytics
router.get('/api/analytics/sales', async (req, res) => {
  try {
    const storeId = req.query.storeId ? parseInt(req.query.storeId as string) : undefined;
    const from = req.query.from ? new Date(req.query.from as string) : undefined;
    const to = req.query.to ? new Date(req.query.to as string) : undefined;

    const totalSales = await storage.getTotalSales(storeId, from, to);
    res.json({ totalSales });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sales analytics' });
  }
});

export { router };