const { db } = require('./db');
const { inventory, inventoryBatches } = require('./shared/schema');
const { eq } = require('drizzle-orm');

async function migrateToBatchInventory() {
  console.log('Starting migration to batch-level inventory tracking...');

  try {
    // 1. Get all current inventory items
    const currentInventory = await db.query.inventory.findMany();
    console.log(`Found ${currentInventory.length} inventory items to migrate`);

    // 2. For each inventory item, create a batch with its current quantity
    for (const item of currentInventory) {
      const batchNumber = `BATCH-INITIAL-${Date.now()}-${item.id}`;

      console.log(`Creating batch for product ${item.productId} in store ${item.storeId}`);

      // Create a batch with the current quantity and expiry date if it exists
      await db.insert(inventoryBatches).values({
        _inventoryId: item.id,
        _batchNumber: batchNumber,
        _quantity: item.quantity || 0,
        _expiryDate: item.expiryDate,
        _receivedDate: new Date(),
        _createdAt: new Date(),
        _updatedAt: new Date()
      });

      // Update the inventory record to use totalQuantity instead of quantity
      await db.update(inventory)
        .set({
          _totalQuantity: item.quantity || 0,
          _updatedAt: new Date()
        })
        .where(eq(inventory.id, item.id));
    }

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Error during _migration:', error);
  }
}

migrateToBatchInventory()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Migration _failed:', err);
    process.exit(1);
  });
