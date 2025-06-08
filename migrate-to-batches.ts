import { eq } from 'drizzle-orm';

import { db } from './db';
import * as schema from './shared/schema';

async function migrateToBatchInventory() {
  console.log('Starting migration to batch-level inventory tracking...');

  try {
    // 1. Get all current inventory items
    const currentInventory = await db.query.inventory.findMany();
    console.log(`Found ${currentInventory.length} inventory items to migrate`);

    // 2. For each inventory item, create a batch with its current quantity
    for (const item of currentInventory) {
      // Check if the item already has a quantity field (old schema)
      // @ts-ignore - handling migration from old schema
      const quantity = item.quantity || 0;
      // @ts-ignore - handling migration from old schema
      const expiryDate = item.expiryDate || null;
      // @ts-ignore - handling migration from old schema
      const batchNumber = item.batchNumber || `BATCH-INITIAL-${Date.now()}-${item.id}`;
      // @ts-ignore - handling migration from old schema
      const costPerUnit = item.costPerUnit || '0'; // Default to '0' if not present

      console.log(`Creating batch for product ${item.productId} in store ${item.storeId}`);

      try {
        // Create a batch with the current quantity and expiry date if it exists
        await db.insert(schema.inventoryBatches).values({
          inventoryId: item.id,
          batchNumber: batchNumber,
          quantity: quantity,
          costPerUnit: String(costPerUnit), // Ensure it's a string
          expiryDate: expiryDate,
          receivedDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Update the inventory record to use totalQuantity instead of quantity
        await db
          .update(schema.inventory)
          .set({
            totalQuantity: quantity,
            updatedAt: new Date(),
          })
          .where(eq(schema.inventory.id, item.id));

        console.log(`Successfully migrated inventory item ${item.id}`);
      } catch (error) {
        console.error(`Error migrating inventory item ${item.id}:`, error);
      }
    }

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Error during migration:', error);
  }
}

migrateToBatchInventory()
  .then(() => {
    console.log('Migration script execution completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
