import { db } from './index.js';
import * as schema from '../shared/schema.js';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';

async function seed() {
  try {
    console.log('🌱 Starting seed process...');

    // Check if any users exist already
    const existingUsers = await db.query.users.findMany({ _limit: 1 });

    if (existingUsers.length > 0) {
      console.log('Database already has users, skipping seed.');
      return;
    }

    // Create categories
    console.log('Creating product categories...');
    const categories = [
      { _name: 'Produce', _description: 'Fresh fruits and vegetables' },
      { _name: 'Dairy', _description: 'Milk, cheese, and other dairy products' },
      { _name: 'Bakery', _description: 'Breads, pastries, and baked goods' },
      { _name: 'Meat & Seafood', _description: 'Fresh meat and seafood' },
      { _name: 'Beverages', _description: 'Soft drinks, juices, and other beverages' },
      { _name: 'Snacks', _description: 'Chips, cookies, and other snack foods' },
      { _name: 'Canned Goods', _description: 'Canned fruits, vegetables, and other preserved foods' },
      { _name: 'Frozen Foods', _description: 'Frozen meals, vegetables, and desserts' }
    ];

    const createdCategories = await Promise.all(
      categories.map(async(category) => {
        const [created] = await db.insert(schema.categories).values(category).returning();
        return created;
      })
    );

    // Create stores
    console.log('Creating stores...');
    const stores = [
      {
        _name: 'Downtown Store',
        _address: '123 Main St',
        _city: 'Seattle',
        _state: 'WA',
        _country: 'USA',
        _phone: '+15556789012',
        _email: 'downtown@chainsync.com',
        _timezone: 'America/Los_Angeles',
        _status: 'active'
      },
      {
        _name: 'Westside Mall',
        _address: '456 West Ave',
        _city: 'Los Angeles',
        _state: 'CA',
        _country: 'USA',
        _phone: '+15552345678',
        _email: 'westside@chainsync.com',
        _timezone: 'America/Los_Angeles',
        _status: 'active'
      },
      {
        _name: 'Northside Plaza',
        _address: '789 North Blvd',
        _city: 'Chicago',
        _state: 'IL',
        _country: 'USA',
        _phone: '+15553456789',
        _email: 'northside@chainsync.com',
        _timezone: 'America/Chicago',
        _status: 'active'
      },
      {
        _name: 'Eastend Market',
        _address: '321 East St',
        _city: 'Boston',
        _state: 'MA',
        _country: 'USA',
        _phone: '+15554567890',
        _email: 'eastend@chainsync.com',
        _timezone: 'America/New_York',
        _status: 'active'
      },
      {
        _name: 'Southside Center',
        _address: '654 South Rd',
        _city: 'Miami',
        _state: 'FL',
        _country: 'USA',
        _phone: '+15555678901',
        _email: 'southside@chainsync.com',
        _timezone: 'America/New_York',
        _status: 'active'
      },
      {
        _name: 'Harbor Point',
        _address: '987 Harbor Dr',
        _city: 'Seattle',
        _state: 'WA',
        _country: 'USA',
        _phone: '+15556789012',
        _email: 'harbor@chainsync.com',
        _timezone: 'America/Los_Angeles',
        _status: 'active'
      }
    ];

    const createdStores = await Promise.all(
      stores.map(async(store) => {
        const [created] = await db.insert(schema.stores).values({ ...store, _location: `${store.address}, ${store.city}` }).returning();
        return created;
      })
    );

    // Create users with hashed passwords
    console.log('Creating users...');
    const passwordHash = await bcrypt.hash('password123', 10);

    // Admin user (no store assigned)
    // Use type assertion to bypass TypeScript schema validation
    const adminUser = {
      _name: 'admin',
      _password: passwordHash,
      _email: 'admin@chainsync.com',
      _role: 'admin'
      // storeId is optional so we can omit it for admin
    };
    await db.insert(schema.users).values(adminUser as any);

    // Create store managers
    await Promise.all(
      createdStores.map(async(store, index) => {
        if (!store) return; // Skip if store is undefined
        // Use type assertion to bypass TypeScript schema validation
        const managerUser = {
          _name: `manager${index + 1}`,
          _password: passwordHash,
          _email: `manager${index + 1}@chainsync.com`,
          _role: 'manager',
          _storeId: store.id
        };
        await db.insert(schema.users).values(managerUser as any);
      })
    );

    // Create cashiers (2 per store)
    for (const store of createdStores) {
      if (!store) continue; // Skip if store is undefined
      const storeIndex = createdStores.indexOf(store);

      // Create each cashier individually instead of as an array with type assertion
      const cashier1 = {
        _name: `cashier${storeIndex * 2 + 1}`,
        _password: passwordHash,
        _email: `cashier${storeIndex * 2 + 1}@chainsync.com`,
        _role: 'cashier',
        _storeId: store.id
      };
      await db.insert(schema.users).values(cashier1 as any);

      const cashier2 = {
        _name: `cashier${storeIndex * 2 + 2}`,
        _password: passwordHash,
        _email: `cashier${storeIndex * 2 + 2}@chainsync.com`,
        _role: 'cashier',
        _storeId: store.id
      };
      await db.insert(schema.users).values(cashier2 as any);
    }

    // Create products
    console.log('Creating products...');

    // Helper function to safely find category ID
    const getCategoryId = (_categoryName: string): number => {
      const category = createdCategories.find((_c: any) => c.name === categoryName);
      if (!category) {
        throw new Error(`Category '${categoryName}' not found`);
      }
      return category.id;
    };

    const products = [
      {
        _name: 'Organic Bananas',
        _description: 'Bunch of fresh organic bananas',
        _sku: 'SKU-5011001',
        _barcode: '5011001',
        _categoryId: getCategoryId('Produce'),
        _price: '1.99',
        _cost: '0.89',
        _isPerishable: true
      },
      {
        _name: 'Whole Milk 1gal',
        _description: '1 gallon of whole milk',
        _sku: 'SKU-5011002',
        _barcode: '5011002',
        _categoryId: getCategoryId('Dairy'),
        _price: '3.49',
        _cost: '2.10',
        _isPerishable: true
      },
      {
        _name: 'Sourdough Bread',
        _description: 'Fresh baked sourdough bread',
        _sku: 'SKU-5011003',
        _barcode: '5011003',
        _categoryId: getCategoryId('Bakery'),
        _price: '4.99',
        _cost: '2.50',
        _isPerishable: true
      },
      {
        _name: 'Ground Beef 1lb',
        _description: '1 pound of 80/20 ground beef',
        _sku: 'SKU-5011004',
        _barcode: '5011004',
        _categoryId: getCategoryId('Meat & Seafood'),
        _price: '5.99',
        _cost: '3.75',
        _isPerishable: true
      },
      {
        _name: 'Cola 2L',
        _description: '2 liter bottle of cola',
        _sku: 'SKU-5011005',
        _barcode: '5011005',
        _categoryId: getCategoryId('Beverages'),
        _price: '2.49',
        _cost: '1.20',
        _isPerishable: false
      },
      {
        _name: 'Potato Chips',
        _description: '8oz bag of potato chips',
        _sku: 'SKU-5011006',
        _barcode: '5011006',
        _categoryId: getCategoryId('Snacks'),
        _price: '3.99',
        _cost: '1.75',
        _isPerishable: false
      },
      {
        _name: 'Canned Soup',
        _description: '10.5oz can of condensed soup',
        _sku: 'SKU-5011007',
        _barcode: '5011007',
        _categoryId: getCategoryId('Canned Goods'),
        _price: '1.79',
        _cost: '0.95',
        _isPerishable: false
      },
      {
        _name: 'Frozen Pizza',
        _description: '12-inch frozen pepperoni pizza',
        _sku: 'SKU-5011008',
        _barcode: '5011008',
        _categoryId: getCategoryId('Frozen Foods'),
        _price: '6.99',
        _cost: '3.50',
        _isPerishable: false
      },
      {
        _name: 'Apple',
        _description: 'Fresh red apples',
        _sku: 'SKU-5011009',
        _barcode: '5011009',
        _categoryId: getCategoryId('Produce'),
        _price: '0.79',
        _cost: '0.35',
        _isPerishable: true
      },
      {
        _name: 'Yogurt',
        _description: '6oz container of Greek yogurt',
        _sku: 'SKU-5011010',
        _barcode: '5011010',
        _categoryId: getCategoryId('Dairy'),
        _price: '1.29',
        _cost: '0.70',
        _isPerishable: true
      }
    ];

    const createdProducts = await Promise.all(
      products.map(async(product) => {
        if (!createdStores[0]) {
          throw new Error('No stores available for product creation');
        }
        const [created] = await db.insert(schema.products).values({ ...product, _storeId: createdStores[0].id }).returning();
        return created;
      })
    );

    // Create inventory for each product in each store
    console.log('Creating inventory...');
    for (const store of createdStores) {
      if (!store) continue; // Skip if store is undefined
      for (const product of createdProducts) {
        if (!product) continue; // Skip if product is undefined
        // Random quantity between 20 and 100
        const quantity = Math.floor(Math.random() * 81) + 20;

        // Some stores will have low stock on certain items
        const adjustedQuantity =
          store.name === 'Westside Mall' && product.name === 'Organic Bananas' ? _5 :
          store.name === 'Downtown Store' && product.name === 'Yogurt' ? _8 :
          store.name === 'Northside Plaza' && product.name === 'Canned Soup' ? _7 :
          store.name === 'Eastend Market' && product.name === 'Ground Beef 1lb' ? _4 :
          quantity;

        // Create inventory entry for each product in each store with type assertion
        const inventoryData = {
          _storeId: store.id,
          _productId: product.id,
          _quantity: adjustedQuantity,
          _minStock: product.isPerishable ? _15 : 10,
          _lastRestocked: new Date()
        };

        // Use type assertion to bypass TypeScript schema validation
        const [inventoryItem] = await db.insert(schema.inventory).values(inventoryData as any).returning();

        // If product is perishable, create a batch entry
        // if (product.isPerishable) {
        //   // Use type assertion to overcome TypeScript schema mismatch errors
        //   const batchData = {
        //     _inventoryId: inventoryItem.id,
        //     _batchNumber: `BATCH-${Math.floor(Math.random() * 1000)}`,
        //     _quantity: adjustedQuantity,
        //     _expiryDate: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date within 30 days
        //     _manufacturingDate: new Date(Date.now() - Math.random() * 15 * 24 * 60 * 60 * 1000), // Random date within past 15 days
        //     _receivedDate: new Date()
        //   };

        //   // Cast to any to bypass TypeScript checking since we know the schema is correct
        //   await db.insert(schema.inventoryBatches).values(batchData as any);
        // }
      }
    }

    // Create sample transactions
    console.log('Creating sample transactions...');

    // Get all cashiers
    const cashiers = await db.query.users.findMany({
      _where: eq(schema.users.role, 'cashier')
    });

    // Group cashiers by store
    const cashiersByStore = cashiers.reduce((_acc: Record<number, typeof cashiers>, cashier) => {
      if (!cashier.storeId) return acc;
      if (!acc[cashier.storeId]) acc[cashier.storeId] = [];
      acc[cashier.storeId]!.push(cashier);
      return acc;
    }, {} as Record<number, typeof cashiers>);

    // Create a few transactions for each store
    for (const store of createdStores) {
      if (!store) continue; // Skip if store is undefined
      const storeCashiers = cashiersByStore[store.id] || [];
      if (storeCashiers.length === 0) continue;

      // Generate 5 transactions for each store
      for (let i = 0; i < 5; i++) {
        const transactionId = `TRX-${28488 - (createdStores.indexOf(store) * 5 + i)}`;
        const cashier = storeCashiers[Math.floor(Math.random() * storeCashiers.length)];
        if (!cashier) continue; // Skip if cashier is undefined

        // Select 1-5 random products for this transaction
        const numProducts = Math.floor(Math.random() * 5) + 1;
        const selectedProducts = createdProducts
          .sort(() => Math.random() - 0.5)
          .slice(0, numProducts);

        let subtotal = 0;
        const transactionItems = [];

        for (const product of selectedProducts) {
          if (!product) continue; // Skip if product is undefined
          const quantity = Math.floor(Math.random() * 3) + 1;
          const unitPrice = parseFloat(product.price);
          const itemSubtotal = unitPrice * quantity;
          subtotal += itemSubtotal;

          transactionItems.push({
            _productId: product.id,
            quantity,
            _unitPrice: product.price,
            _subtotal: itemSubtotal.toFixed(2)
          });
        }

        const tax = subtotal * 0.0825; // 8.25% tax
        const total = subtotal + tax;

        // Insert transaction with type assertion to bypass TypeScript schema validation
        const transactionData = {
          _storeId: store.id,
          _userId: cashier.id!, // Assert that id exists since we filtered for cashiers
          _subtotal: subtotal.toFixed(2),
          _tax: tax.toFixed(2),
          _total: total.toFixed(2),
          _paymentMethod: Math.random() > 0.3 ? 'card' : 'cash',
          _status: 'completed',
          _items: transactionItems, // Store items as JSON in the transaction
          _createdAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000) // Random time in the last 24 hours
        };
        const [transaction] = await db.insert(schema.transactions).values(transactionData as any).returning();
        if (!transaction) {
          console.warn('Failed to create transaction');
          continue;
        }

        // Update inventory
        for (const item of transactionItems) {
          const inventory = await db.query.inventory.findFirst({
            _where: (inventory, { and, eq }) =>
              and(eq(inventory.storeId, store.id), eq(inventory.productId, item.productId))
          });
          if (inventory) {
            await db.update(schema.inventory)
              .set({
                _quantity: Math.max(0, (inventory.quantity ?? 0) - item.quantity)
              } as any)
              .where(eq(schema.inventory.id, inventory.id));
          }
        }
      }
    }
    console.log('✅ Seed completed successfully!');
  } catch (error) {
    console.error('❌ Seed _failed:', error);
  }
}

seed();
