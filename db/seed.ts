import { db } from "./index.js";
import * as schema from "../shared/schema.js";
import { eq } from "drizzle-orm";
import * as bcrypt from "bcrypt";

async function seed() {
  try {
    console.log("🌱 Starting seed process...");

    // Check if any users exist already
    const existingUsers = await db.query.users.findMany({ limit: 1 });
    
    if (existingUsers.length > 0) {
      console.log("Database already has users, skipping seed.");
      return;
    }

    // Create categories
    console.log("Creating product categories...");
    const categories = [
      { name: "Produce", description: "Fresh fruits and vegetables" },
      { name: "Dairy", description: "Milk, cheese, and other dairy products" },
      { name: "Bakery", description: "Breads, pastries, and baked goods" },
      { name: "Meat & Seafood", description: "Fresh meat and seafood" },
      { name: "Beverages", description: "Soft drinks, juices, and other beverages" },
      { name: "Snacks", description: "Chips, cookies, and other snack foods" },
      { name: "Canned Goods", description: "Canned fruits, vegetables, and other preserved foods" },
      { name: "Frozen Foods", description: "Frozen meals, vegetables, and desserts" }
    ];

    const createdCategories = await Promise.all(
      categories.map(async (category) => {
        const [created] = await db.insert(schema.categories).values(category).returning();
        return created;
      })
    );
    
    // Create stores
    console.log("Creating stores...");
    const stores = [
      {
        name: "Downtown Store",
        address: "123 Main St",
        city: "Seattle",
        state: "WA",
        country: "USA",
        phone: "+15556789012",
        email: "downtown@chainsync.com",
        timezone: "America/Los_Angeles",
        status: "active"
      },
      {
        name: "Westside Mall",
        address: "456 West Ave",
        city: "Los Angeles",
        state: "CA",
        country: "USA",
        phone: "+15552345678",
        email: "westside@chainsync.com",
        timezone: "America/Los_Angeles",
        status: "active"
      },
      {
        name: "Northside Plaza",
        address: "789 North Blvd",
        city: "Chicago",
        state: "IL",
        country: "USA",
        phone: "+15553456789",
        email: "northside@chainsync.com",
        timezone: "America/Chicago",
        status: "active"
      },
      {
        name: "Eastend Market",
        address: "321 East St",
        city: "Boston",
        state: "MA",
        country: "USA",
        phone: "+15554567890",
        email: "eastend@chainsync.com",
        timezone: "America/New_York",
        status: "active"
      },
      {
        name: "Southside Center",
        address: "654 South Rd",
        city: "Miami",
        state: "FL",
        country: "USA",
        phone: "+15555678901",
        email: "southside@chainsync.com",
        timezone: "America/New_York",
        status: "active"
      },
      {
        name: "Harbor Point",
        address: "987 Harbor Dr",
        city: "Seattle",
        state: "WA",
        country: "USA",
        phone: "+15556789012",
        email: "harbor@chainsync.com",
        timezone: "America/Los_Angeles",
        status: "active"
      }
    ];

    const createdStores = await Promise.all(
      stores.map(async (store) => {
        const [created] = await db.insert(schema.stores).values(store).returning();
        return created;
      })
    );

    // Create users with hashed passwords
    console.log("Creating users...");
    const passwordHash = await bcrypt.hash("password123", 10);
    
    // Admin user (no store assigned)
    // Use type assertion to bypass TypeScript schema validation 
    const adminUser = {
      username: "admin",
      password: passwordHash,
      fullName: "Chain Admin",
      email: "admin@chainsync.com",
      role: "admin"
      // storeId is optional so we can omit it for admin
    };
    await db.insert(schema.users).values(adminUser as any);

    // Create store managers
    await Promise.all(
      createdStores.map(async (store: { id: number; }, index: number) => {
        // Use type assertion to bypass TypeScript schema validation
        const managerUser = {
          username: `manager${index + 1}`,
          password: passwordHash,
          fullName: `Manager ${index + 1}`,
          email: `manager${index + 1}@chainsync.com`,
          role: "manager",
          storeId: store.id
        };
        await db.insert(schema.users).values(managerUser as any);
      })
    );

    // Create cashiers (2 per store)
    for (const store of createdStores) {
      const storeIndex = createdStores.indexOf(store);
      
      // Create each cashier individually instead of as an array with type assertion
      const cashier1 = {
        username: `cashier${storeIndex * 2 + 1}`,
        password: passwordHash,
        fullName: `Cashier ${storeIndex * 2 + 1}`,
        email: `cashier${storeIndex * 2 + 1}@chainsync.com`,
        role: "cashier",
        storeId: store.id
      };
      await db.insert(schema.users).values(cashier1 as any);
      
      const cashier2 = {
        username: `cashier${storeIndex * 2 + 2}`,
        password: passwordHash,
        fullName: `Cashier ${storeIndex * 2 + 2}`,
        email: `cashier${storeIndex * 2 + 2}@chainsync.com`,
        role: "cashier",
        storeId: store.id
      };
      await db.insert(schema.users).values(cashier2 as any);
    }

    // Create products
    console.log("Creating products...");
    const products = [
      {
        name: "Organic Bananas",
        description: "Bunch of fresh organic bananas",
        sku: "SKU-5011001",
        barcode: "5011001",
        categoryId: createdCategories.find((c: { name: string; }) => c.name === "Produce")!.id,
        price: "1.99",
        cost: "0.89",
        isPerishable: true
      },
      {
        name: "Whole Milk 1gal",
        description: "1 gallon of whole milk",
        sku: "SKU-5011002",
        barcode: "5011002",
        categoryId: createdCategories.find((c: { name: string; }) => c.name === "Dairy")!.id,
        price: "3.49",
        cost: "2.10",
        isPerishable: true
      },
      {
        name: "Sourdough Bread",
        description: "Fresh baked sourdough bread",
        sku: "SKU-5011003",
        barcode: "5011003",
        categoryId: createdCategories.find((c: { name: string; }) => c.name === "Bakery")!.id,
        price: "4.99",
        cost: "2.50",
        isPerishable: true
      },
      {
        name: "Ground Beef 1lb",
        description: "1 pound of 80/20 ground beef",
        sku: "SKU-5011004",
        barcode: "5011004",
        categoryId: createdCategories.find((c: { name: string; }) => c.name === "Meat & Seafood")!.id,
        price: "5.99",
        cost: "3.75",
        isPerishable: true
      },
      {
        name: "Cola 2L",
        description: "2 liter bottle of cola",
        sku: "SKU-5011005",
        barcode: "5011005",
        categoryId: createdCategories.find((c: { name: string; }) => c.name === "Beverages")!.id,
        price: "2.49",
        cost: "1.20",
        isPerishable: false
      },
      {
        name: "Potato Chips",
        description: "8oz bag of potato chips",
        sku: "SKU-5011006",
        barcode: "5011006",
        categoryId: createdCategories.find((c: { name: string; }) => c.name === "Snacks")!.id,
        price: "3.99",
        cost: "1.75",
        isPerishable: false
      },
      {
        name: "Canned Soup",
        description: "10.5oz can of condensed soup",
        sku: "SKU-5011007",
        barcode: "5011007",
        categoryId: createdCategories.find((c: { name: string; }) => c.name === "Canned Goods")!.id,
        price: "1.79",
        cost: "0.95",
        isPerishable: false
      },
      {
        name: "Frozen Pizza",
        description: "12-inch frozen pepperoni pizza",
        sku: "SKU-5011008",
        barcode: "5011008",
        categoryId: createdCategories.find((c: { name: string; }) => c.name === "Frozen Foods")!.id,
        price: "6.99",
        cost: "3.50",
        isPerishable: false
      },
      {
        name: "Apple",
        description: "Fresh red apples",
        sku: "SKU-5011009",
        barcode: "5011009",
        categoryId: createdCategories.find((c: { name: string; }) => c.name === "Produce")!.id,
        price: "0.79",
        cost: "0.35",
        isPerishable: true
      },
      {
        name: "Yogurt",
        description: "6oz container of Greek yogurt",
        sku: "SKU-5011010",
        barcode: "5011010",
        categoryId: createdCategories.find((c: { name: string; }) => c.name === "Dairy")!.id,
        price: "1.29",
        cost: "0.70",
        isPerishable: true
      }
    ];

    const createdProducts = await Promise.all(
      products.map(async (product) => {
        const [created] = await db.insert(schema.products).values({ ...product, storeId: createdStores[0].id }).returning();
        return created;
      })
    );

    // Create inventory for each product in each store
    console.log("Creating inventory...");
    for (const store of createdStores) {
      for (const product of createdProducts) {
        // Random quantity between 20 and 100
        const quantity = Math.floor(Math.random() * 81) + 20;
        
        // Some stores will have low stock on certain items
        const adjustedQuantity = 
          store.name === "Westside Mall" && product.name === "Organic Bananas" ? 5 :
          store.name === "Downtown Store" && product.name === "Yogurt" ? 8 :
          store.name === "Northside Plaza" && product.name === "Canned Soup" ? 7 :
          store.name === "Eastend Market" && product.name === "Ground Beef 1lb" ? 4 :
          quantity;
        
        // Create inventory entry for each product in each store with type assertion
        const inventoryData = {
          storeId: store.id,
          productId: product.id,
          totalQuantity: adjustedQuantity,
          minimumLevel: product.isPerishable ? 15 : 10,
          lastStockUpdate: new Date()
        };
        
        // Use type assertion to bypass TypeScript schema validation
        const [inventoryItem] = await db.insert(schema.inventory).values(inventoryData as any).returning();
        
        // If product is perishable, create a batch entry
        if (product.isPerishable) {
          // Use type assertion to overcome TypeScript schema mismatch errors
          const batchData = {
            inventoryId: inventoryItem.id,
            batchNumber: `BATCH-${Math.floor(Math.random() * 1000)}`,
            quantity: adjustedQuantity,
            expiryDate: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date within 30 days
            manufacturingDate: new Date(Date.now() - Math.random() * 15 * 24 * 60 * 60 * 1000), // Random date within past 15 days
            receivedDate: new Date()
          };
          
          // Cast to any to bypass TypeScript checking since we know the schema is correct
          await db.insert(schema.inventoryBatches).values(batchData as any);
        }
      }
    }

    // Create sample transactions
    console.log("Creating sample transactions...");
    
    // Get all cashiers
    const cashiers = await db.query.users.findMany({
      where: eq(schema.users.role, "cashier")
    });

    // Group cashiers by store
    const cashiersByStore = cashiers.reduce((acc: Record<number, typeof cashiers>, cashier) => {
      if (!cashier.storeId) return acc;
      if (!acc[cashier.storeId]) acc[cashier.storeId] = [];
      acc[cashier.storeId].push(cashier);
      return acc;
    }, {} as Record<number, typeof cashiers>);

    // Create a few transactions for each store
    for (const store of createdStores) {
      const storeCashiers = cashiersByStore[store.id] || [];
      if (storeCashiers.length === 0) continue;

      // Generate 5 transactions for each store
      for (let i = 0; i < 5; i++) {
        const transactionId = `TRX-${28488 - (createdStores.indexOf(store) * 5 + i)}`;
        const cashier = storeCashiers[Math.floor(Math.random() * storeCashiers.length)];
        
        // Select 1-5 random products for this transaction
        const numProducts = Math.floor(Math.random() * 5) + 1;
        const selectedProducts = createdProducts
          .sort(() => Math.random() - 0.5)
          .slice(0, numProducts);
        
        let subtotal = 0;
        const transactionItems = [];
        
        for (const product of selectedProducts) {
          const quantity = Math.floor(Math.random() * 3) + 1;
          const unitPrice = parseFloat(product.price);
          const itemSubtotal = unitPrice * quantity;
          subtotal += itemSubtotal;
          
          transactionItems.push({
            productId: product.id,
            quantity,
            unitPrice: product.price,
            subtotal: itemSubtotal.toFixed(2)
          });
        }
        
        const tax = subtotal * 0.0825; // 8.25% tax
        const total = subtotal + tax;
        
        // Insert transaction with type assertion to bypass TypeScript schema validation
        const transactionData = {
          transactionId,
          storeId: store.id,
          cashierId: cashier.id,
          subtotal: subtotal.toFixed(2),
          tax: tax.toFixed(2),
          total: total.toFixed(2),
          paymentMethod: Math.random() > 0.3 ? "credit_card" : "cash",
          paymentStatus: "paid",
          isOfflineTransaction: Math.random() > 0.9, // 10% chance of being offline
          syncedAt: Math.random() > 0.9 ? null : new Date(),
          createdAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000) // Random time in the last 24 hours
        };
        const [transaction] = await db.insert(schema.transactions).values(transactionData as any).returning();
        
        // Insert transaction items
        await Promise.all(
          transactionItems.map(item => 
            db.insert(schema.transactionItems).values({
              ...item,
              transactionId: transaction.id
            })
          )
        );
        
        // Update inventory
        for (const item of transactionItems) {
          const inventory = await db.query.inventory.findFirst({
            where: (inventory, { and, eq }) =>
              and(eq(inventory.storeId, store.id), eq(inventory.productId, item.productId))
          });
          
          if (inventory) {
            await db
              .update(schema.inventory)
              .set({ 
                totalQuantity: Math.max(0, inventory.totalQuantity - item.quantity),
                lastStockUpdate: new Date()
              })
              .where(
                eq(schema.inventory.id, inventory.id)
              );
          }
        }
      }
    }

    console.log("✅ Seed completed successfully!");
  } catch (error) {
    console.error("❌ Seed failed:", error);
  }
}

seed();
