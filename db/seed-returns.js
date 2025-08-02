'use strict';
const __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  let desc = Object.getOwnPropertyDescriptor(m, k);
  if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
    desc = { enumerable: true, get: function() { return m[k]; } };
  }
  Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  o[k2] = m[k];
}));
const __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
  Object.defineProperty(o, 'default', { enumerable: true, value: v });
}) : function(o, v) {
  o['default'] = v;
});
const __importStar = (this && this.__importStar) || (function() {
  let ownKeys = function(o) {
    ownKeys = Object.getOwnPropertyNames || function(o) {
      const ar = [];
      for (const k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
      return ar;
    };
    return ownKeys(o);
  };
  return function(mod) {
    if (mod && mod.__esModule) return mod;
    const result = {};
    if (mod != null) for (let k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== 'default') __createBinding(result, mod, k[i]);
    __setModuleDefault(result, mod);
    return result;
  };
})();
Object.defineProperty(exports, '__esModule', { value: true });
const index_js_1 = require('./index.js');
const schema = __importStar(require('@shared/schema.js'));
async function seedReturnReasons() {
  try {
    console.log('🌱 Starting return reasons seed process...');
    // Check if return reasons already exist
    const existingReasons = await index_js_1.db.query.returnReasons.findMany({ limit: 1 });
    if (existingReasons.length > 0) {
      console.log('Return reasons already exist, skipping seed.');
      return;
    }
    // Create return reasons
    console.log('Creating return reasons...');
    const returnReasons = [
      {
        reason: 'Damaged Product',
        description: 'Product was damaged or defective',
        active: true
      },
      {
        reason: 'Changed Mind',
        description: 'Customer changed their mind about the purchase',
        active: true
      },
      {
        reason: 'Wrong Item',
        description: 'Customer received the wrong item',
        active: true
      },
      {
        reason: 'Expired Product',
        description: 'Product was expired or spoiled',
        active: true
      },
      {
        reason: 'Incorrect Price',
        description: 'Item was priced incorrectly at time of sale',
        active: true
      },
      {
        reason: 'Quality Issues',
        description: 'Product quality did not meet customer expectations',
        active: true
      }
    ];
    for (const reason of returnReasons) {
      await index_js_1.db.insert(schema.returnReasons).values(reason);
    }
    console.log(`✅ Created ${returnReasons.length} return reasons successfully!`);
  }
  catch (error) {
    console.error('❌ Return reasons seed failed:', error);
  }
}
seedReturnReasons();
