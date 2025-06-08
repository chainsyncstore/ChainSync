import * as bcrypt from 'bcrypt';
import { eq, and } from 'drizzle-orm';

import { db } from './index.js';
import * as schema from '../shared/schema.js';

function getFirst<T>(result: any): T | undefined {
  if (Array.isArray(result)) return result[0];
  if (result && typeof result[0] !== 'undefined') return result[0];
  if (result && result.rows && Array.isArray(result.rows)) return result.rows[0];
  return undefined;
}

async function seed() {
  try {
    console.log('🌱 Starting seed process...');

    // Check if any schema.users exist already
    const existingUsers = await db.select().from(schema.users).limit(1);

    if (existingUsers.length > 0) {
      console.log('Database already has schema.users, skipping seed.');
      return;
    }

    // Create schema.categories
    console.log('Creating product schema.categories...');
    const categorySeed: (typeof schema.categories.$inferInsert)[] = [
      { name: 'Produce', description: 'Fresh fruits and vegetables' },
      { name: 'Dairy', description: 'Milk, cheese, and other dairy schema.products' },
      { name: 'Bakery', description: 'Breads, pastries, and baked goods' },
      { name: 'Meat & Seafood', description: 'Fresh meat and seafood' },
      { name: 'Beverages', description: 'Soft drinks, juices, and other beverages' },
      { name: 'Snacks', description: 'Chips, cookies, and other snack foods' },
      { name: 'Canned Goods', description: 'Canned fruits, vegetables, and other preserved foods' },
      { name: 'Frozen Foods', description: 'Frozen meals, vegetables, and desserts' },
    ];

    const createdCategories = await Promise.all(
      categorySeed.map(async (category: typeof schema.categories.$inferInsert) => {
        const existing = await db
          .select()
          .from(schema.categories)
          .where(eq(schema.categories.name, category.name));
        const found = getFirst<typeof schema.categories.$inferSelect>(existing);
        if (found) {
          return found;
        } else {
          const inserted = await db.insert(schema.categories).values(category).returning();
          return getFirst<typeof schema.categories.$inferSelect>(inserted);
        }
      })
    );

    // Create schema.stores
    console.log('Creating schema.stores...');
    const storeSeed: (typeof schema.stores.$inferInsert)[] = [
      {
        name: 'Downtown Store',
        address: '123 Main St',
        city: 'Seattle',
        state: 'WA',
        country: 'USA',
        phone: '+15556789012',
        email: 'downtown@chainsync.com',
        timezone: 'America/Los_Angeles',
        status: 'active',
      },
      {
        name: 'Westside Mall',
        address: '456 West Ave',
        city: 'Los Angeles',
        state: 'CA',
        country: 'USA',
        phone: '+15552345678',
        email: 'westside@chainsync.com',
        timezone: 'America/Los_Angeles',
        status: 'active',
      },
      {
        name: 'Northside Plaza',
        address: '789 North Blvd',
        city: 'Chicago',
        state: 'IL',
        country: 'USA',
        phone: '+15553456789',
        email: 'northside@chainsync.com',
        timezone: 'America/Chicago',
        status: 'active',
      },
      {
        name: 'Eastend Market',
        address: '321 East St',
        city: 'Boston',
        state: 'MA',
        country: 'USA',
        phone: '+15554567890',
        email: 'eastend@chainsync.com',
        timezone: 'America/New_York',
        status: 'active',
      },
      {
        name: 'Southside Center',
        address: '654 South Rd',
        city: 'Miami',
        state: 'FL',
        country: 'USA',
        phone: '+15555678901',
        email: 'southside@chainsync.com',
        timezone: 'America/New_York',
        status: 'active',
      },
      {
        name: 'Harbor Point',
        address: '987 Harbor Dr',
        city: 'Seattle',
        state: 'WA',
        country: 'USA',
        phone: '+15556789012',
        email: 'harbor@chainsync.com',
        timezone: 'America/Los_Angeles',
        status: 'active',
      },
    ];

    const createdStores = await Promise.all(
      storeSeed.map(async (store: typeof schema.stores.$inferInsert) => {
        const existing = await db
          .select()
          .from(schema.stores)
          .where(eq(schema.stores.name, store.name));
        const found = getFirst<typeof schema.stores.$inferSelect>(existing);
        if (found) {
          return found;
        } else {
          const inserted = await db.insert(schema.stores).values(store).returning();
          return getFirst<typeof schema.stores.$inferSelect>(inserted);
        }
      })
    );

    // Create schema.users with hashed passwords
    console.log('Creating schema.users...');
    const passwordHash = await bcrypt.hash('password123', 10);

    // Admin user (no store assigned)
    // Use type assertion to bypass TypeScript schema validation
    const adminUser = {
      username: 'admin',
      password: passwordHash,
      fullName: 'Chain Admin',
      email: 'admin@chainsync.com',
      role: 'admin',
      // storeId is optional so we can omit it for admin
    };
    await db.insert(schema.users).values(adminUser as any);

    // Create store managers
    await Promise.all(
      (createdStores.filter(Boolean) as (typeof schema.stores.$inferSelect)[]).map(
        async (store, index) => {
          // Use type assertion to bypass TypeScript schema validation
          const managerUser: typeof schema.users.$inferInsert = {
            username: `manager${index + 1}`,
            password: passwordHash,
            fullName: `Manager ${index + 1}`,
            email: `manager${index + 1}@chainsync.com`,
            role: 'manager',
            storeId: store.id,
          };
          await db.insert(schema.users).values(managerUser);
        }
      )
    );

    // Create cashiers (2 per store)
    for (const store of createdStores as (typeof schema.stores.$inferSelect)[]) {
      const storeIndex = createdStores.indexOf(store);

      // Create each cashier individually instead of as an array with type assertion
      const cashier1: typeof schema.users.$inferInsert = {
        username: `cashier${storeIndex * 2 + 1}`,
        password: passwordHash,
        fullName: `Cashier ${storeIndex * 2 + 1}`,
        email: `cashier${storeIndex * 2 + 1}@chainsync.com`,
        role: 'cashier',
        storeId: store.id,
      };
      await db.insert(schema.users).values(cashier1);

      const cashier2: typeof schema.users.$inferInsert = {
        username: `cashier${storeIndex * 2 + 2}`,
        password: passwordHash,
        fullName: `Cashier ${storeIndex * 2 + 2}`,
        email: `cashier${storeIndex * 2 + 2}@chainsync.com`,
        role: 'cashier',
        storeId: store.id,
      };
      await db.insert(schema.users).values(cashier2);
    }

    // Create schema.products
    console.log('Creating schema.products...');
    const productSeed: (typeof schema.products.$inferInsert)[] = [
      {
        name: 'Organic Bananas',
        description: 'Bunch of fresh organic bananas',
        sku: 'SKU-5011001',
        barcode: '5011001',
        categoryId: createdCategories.find(
          (c: typeof schema.categories.$inferSelect) => c.name === 'Produce'
        )!.id,
        price: '1.99',
        cost: '0.89',
        isPerishable: true,
      },
      {
        name: 'Whole Milk 1gal',
        description: '1 gallon of whole milk',
        sku: 'SKU-5011002',
        barcode: '5011002',
        categoryId: createdCategories.find(
          (c: typeof schema.categories.$inferSelect) => c.name === 'Dairy'
        )!.id,
        price: '3.49',
        cost: '2.10',
        isPerishable: true,
      },
      {
        name: 'Sourdough Bread',
        description: 'Fresh baked sourdough bread',
        sku: 'SKU-5011003',
        barcode: '5011003',
        categoryId: createdCategories.find(
          (c: typeof schema.categories.$inferSelect) => c.name === 'Bakery'
        )!.id,
        price: '4.99',
        cost: '2.50',
        isPerishable: true,
      },
      {
        name: 'Ground Beef 1lb',
        description: '1 pound of 80/20 ground beef',
        sku: 'SKU-5011004',
        barcode: '5011004',
        categoryId: createdCategories.find(
          (c: typeof schema.categories.$inferSelect) => c.name === 'Meat & Seafood'
        )!.id,
        price: '5.99',
        cost: '3.75',
        isPerishable: true,
      },
      {
        name: 'Cola 2L',
        description: '2 liter bottle of cola',
        sku: 'SKU-5011005',
        barcode: '5011005',
        categoryId: createdCategories.find(
          (c: typeof schema.categories.$inferSelect) => c.name === 'Beverages'
        )!.id,
        price: '2.49',
        cost: '1.20',
        isPerishable: false,
      },
      {
        name: 'Potato Chips',
        description: '8oz bag of potato chips',
        sku: 'SKU-5011006',
        barcode: '5011006',
        categoryId: createdCategories.find(
          (c: typeof schema.categories.$inferSelect) => c.name === 'Snacks'
        )!.id,
        price: '3.99',
        cost: '1.75',
        isPerishable: false,
      },
      {
        name: 'Canned Soup',
        description: '10.5oz can of condensed soup',
        sku: 'SKU-5011007',
        barcode: '5011007',
        categoryId: createdCategories.find(
          (c: typeof schema.categories.$inferSelect) => c.name === 'Canned Goods'
        )!.id,
        price: '1.79',
        cost: '0.95',
        isPerishable: false,
      },
      {
        name: 'Frozen Pizza',
        description: '12-inch frozen pepperoni pizza',
        sku: 'SKU-5011008',
        barcode: '5011008',
        categoryId: createdCategories.find(
          (c: typeof schema.categories.$inferSelect) => c.name === 'Frozen Foods'
        )!.id,
        price: '6.99',
        cost: '3.50',
        isPerishable: false,
      },
      {
        name: 'Apple',
        description: 'Fresh red apples',
        sku: 'SKU-5011009',
        barcode: '5011009',
        categoryId: createdCategories.find(
          (c: typeof schema.categories.$inferSelect) => c.name === 'Produce'
        )!.id,
        price: '0.79',
        cost: '0.35',
        isPerishable: true,
      },
      {
        name: 'Yogurt',
        description: '6oz container of Greek yogurt',
        sku: 'SKU-5011010',
        barcode: '5011010',
        categoryId: createdCategories.find(
          (c: typeof schema.categories.$inferSelect) => c.name === 'Dairy'
        )!.id,
        price: '1.29',
        cost: '0.70',
        isPerishable: true,
      },
    ];

    const createdProducts = await Promise.all(
      productSeed.map(async (product: typeof schema.products.$inferInsert) => {
        const existing = await db
          .select()
          .from(schema.products)
          .where(eq(schema.products.name, product.name));
        const found = getFirst<typeof schema.products.$inferSelect>(existing);
        if (found) {
          return found;
        } else {
          const inserted = await db.insert(schema.products).values(product).returning();
          return getFirst<typeof schema.products.$inferSelect>(inserted);
        }
      })
    );

    // Create schema.inventory for each product in each store
    console.log('Creating schema.inventory...');
    for (const store of createdStores as (typeof schema.stores.$inferSelect)[]) {
      for (const product of createdProducts.filter(
        Boolean
      ) as (typeof schema.products.$inferSelect)[]) {
        if (!product) continue;
        // Random quantity between 20 and 100
        const quantity = Math.floor(Math.random() * 81) + 20;

        // Some schema.stores will have low stock on certain items
        const adjustedQuantity =
          store.name === 'Westside Mall' && product.name === 'Organic Bananas'
            ? 5
            : store.name === 'Downtown Store' && product.name === 'Yogurt'
              ? 8
              : store.name === 'Northside Plaza' && product.name === 'Canned Soup'
                ? 7
                : store.name === 'Eastend Market' && product.name === 'Ground Beef 1lb'
                  ? 4
                  : quantity;

        // Create schema.inventory entry for each product in each store with type assertion
        const inventoryData = {
          storeId: store.id,
          productId: product.id,
          totalQuantity: adjustedQuantity,
        };

        // Cast to any to bypass TypeScript checking since we know the schema is correct
        await db.insert(schema.inventory).values(inventoryData);

        // Create schema.inventoryBatches for each product in each store
        for (let i = 0; i < Math.floor(adjustedQuantity / 10); i++) {
          const batchData = {
            inventoryId: inventoryData.storeId,
            batchNumber: `BATCH-${Math.floor(Math.random() * 1000)}`,
            quantity: 10,
            costPerUnit: typeof product?.cost === 'string' ? product.cost : '0.00',
            expiryDate: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date within 30 days
            manufacturingDate: new Date(Date.now() - Math.random() * 15 * 24 * 60 * 60 * 1000), // Random date within past 15 days
            receivedDate: new Date(),
          };

          // Cast to any to bypass TypeScript checking since we know the schema is correct
          await db.insert(schema.inventoryBatches).values(batchData);
        }
      }
    }

    // Create sample schema.transactions
    console.log('Creating sample schema.transactions...');

    // Get all cashiers
    const cashiers = await db.select().from(schema.users).where(eq(schema.users.role, 'cashier'));

    // Group cashiers by store
    const cashiersByStore: Record<number, (typeof schema.users.$inferSelect)[]> = cashiers.reduce(
      (
        acc: Record<number, (typeof schema.users.$inferSelect)[]>,
        cashier: typeof schema.users.$inferSelect
      ) => {
        if (!cashier.storeId) return acc;
        if (!acc[cashier.storeId]) acc[cashier.storeId] = [];
        acc[cashier.storeId].push(cashier);
        return acc;
      },
      {}
    );

    // Create a few schema.transactions for each store
    for (const store of createdStores as (typeof schema.stores.$inferSelect)[]) {
      const storeCashiers = cashiersByStore[store.id] || [];
      if (storeCashiers.length === 0) continue;

      // Generate 5 schema.transactions for each store
      for (let i = 0; i < 5; i++) {
        const transactionId = `TRX-${28488 - (createdStores.indexOf(store) * 5 + i)}`;
        const cashier = storeCashiers[Math.floor(Math.random() * storeCashiers.length)];

        // Select 1-5 random schema.products for this transaction
        const numProducts = Math.floor(Math.random() * 5) + 1;
        const selectedProducts = createdProducts
          .sort(() => Math.random() - 0.5)
          .slice(0, numProducts);

        let subtotal = 0;
        const transactionItems: Array<typeof schema.transactionItems.$inferInsert> = [];

        for (const product of selectedProducts as (typeof schema.products.$inferSelect)[]) {
          const quantity = Math.floor(Math.random() * 3) + 1;
          const unitPrice = parseFloat(product.price);
          const itemSubtotal = unitPrice * quantity;
          subtotal += itemSubtotal;

          transactionItems.push({
            productId: product.id,
            quantity,
            unitPrice: product.price,
          });
        }

        const tax = subtotal * 0.0825; // 8.25% tax
        const total = subtotal + tax;

        // Insert transaction with type assertion to bypass TypeScript schema validation
        const transactionData = {
          storeId: store.id,
          userId: cashier.id,
          total: total.toFixed(2), // Added total field
          totalAmount: total.toFixed(2),
          paymentStatus: 'paid',
          paymentMethod: Math.random() > 0.3 ? 'credit_card' : 'cash',
          status: 'completed',
          referenceNumber: `REF-${transactionId}`,
          createdAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
          syncedAt: Math.random() > 0.9 ? null : new Date(),
        };

        const [transaction] = await db
          .insert(schema.transactions)
          .values(transactionData)
          .returning();

        // Insert transaction items
        await Promise.all(
          transactionItems.map(item =>
            db.insert(schema.transactionItems).values({
              ...item,
              transactionId: transaction.id,
            })
          )
        );

        // Update schema.inventory for each item
        for (const item of transactionItems) {
          if (!store) continue;
          if (!item.productId) continue;
          const inv = await db
            .select()
            .from(schema.inventory)
            .where(
              and(
                eq(schema.inventory.storeId, store.id),
                eq(schema.inventory.productId, item.productId)
              )
            )
            .limit(1);
          if (inv && inv.length > 0) {
            await db
              .update(schema.inventory)
              .set({
                totalQuantity: Math.max(0, inv[0].totalQuantity - item.quantity),
              })
              .where(eq(schema.inventory.id, inv[0].id));
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Seed failed:', error);
  }
}

seed();
