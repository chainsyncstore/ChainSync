import { db } from './index.js';
import * as schema from '@shared/schema.js';

async function seedReturnReasons() {
  try {
    console.log('🌱 Starting return reasons seed process...');

    // Check if return reasons already exist
    const existingReasons = await db.query.returnReasons.findMany({ _limit: 1 });

    if (existingReasons.length > 0) {
      console.log('Return reasons already exist, skipping seed.');
      return;
    }

    // Create return reasons
    console.log('Creating return reasons...');
    const returnReasons = [
      {
        _reason: 'Damaged Product',
        _description: 'Product was damaged or defective',
        _active: true
      },
      {
        _reason: 'Changed Mind',
        _description: 'Customer changed their mind about the purchase',
        _active: true
      },
      {
        _reason: 'Wrong Item',
        _description: 'Customer received the wrong item',
        _active: true
      },
      {
        _reason: 'Expired Product',
        _description: 'Product was expired or spoiled',
        _active: true
      },
      {
        _reason: 'Incorrect Price',
        _description: 'Item was priced incorrectly at time of sale',
        _active: true
      },
      {
        _reason: 'Quality Issues',
        _description: 'Product quality did not meet customer expectations',
        _active: true
      }
    ];

    for (const reason of returnReasons) {
      await db.insert(schema.returnReasons).values(reason);
    }

    console.log(`✅ Created ${returnReasons.length} return reasons successfully!`);
  } catch (error) {
    console.error('❌ Return reasons seed _failed:', error);
  }
}

seedReturnReasons();
