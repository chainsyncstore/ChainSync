import { schema } from '@shared/schema';

import { db } from './index.js';

async function seedReturnReasons() {
  try {
    console.log('🌱 Starting return reasons seed process...');

    // Check if return reasons already exist
    const existingReasons = await db.query.returnReasons.findMany({ limit: 1 });

    if (existingReasons.length > 0) {
      console.log('Return reasons already exist, skipping seed.');
      return;
    }

    // Create return reasons
    console.log('Creating return reasons...');
    const returnReasons = [
      {
        name: 'Damaged Product',
        description: 'Product was damaged or defective',
        active: true,
      },
      {
        name: 'Changed Mind',
        description: 'Customer changed their mind about the purchase',
        active: true,
      },
      {
        name: 'Wrong Item',
        description: 'Customer received the wrong item',
        active: true,
      },
      {
        name: 'Expired Product',
        description: 'Product was expired or spoiled',
        active: true,
      },
      {
        name: 'Incorrect Price',
        description: 'Item was priced incorrectly at time of sale',
        active: true,
      },
      {
        name: 'Quality Issues',
        description: 'Product quality did not meet customer expectations',
        active: true,
      },
    ];

    for (const reason of returnReasons) {
      await db.insert(schema.returnReasons).values(reason);
    }

    console.log(`✅ Created ${returnReasons.length} return reasons successfully!`);
  } catch (error) {
    console.error('❌ Return reasons seed failed:', error);
  }
}

seedReturnReasons();
