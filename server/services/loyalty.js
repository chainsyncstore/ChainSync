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
exports.getLoyaltyProgram = getLoyaltyProgram;
exports.generateLoyaltyId = generateLoyaltyId;
exports.enrollCustomer = enrollCustomer;
exports.calculatePointsForTransaction = calculatePointsForTransaction;
exports.recordPointsEarned = recordPointsEarned;
exports.getAvailableRewards = getAvailableRewards;
exports.getLoyaltyAnalytics = getLoyaltyAnalytics;
const database_1 = require('../database');
const schema = __importStar(require('../../shared/schema'));
const drizzle_orm_1 = require('drizzle-orm');
const logger_1 = require('../services/logger');
let db;
(0, database_1.getDatabase)().then(database => {
  db = database;
});
async function getLoyaltyProgram(programId) {
  const program = await db.query.loyaltyPrograms.findFirst({
    where: (0, drizzle_orm_1.eq)(schema.loyaltyPrograms.id, programId)
  });
  return program;
}
/**
 * Check and update member tier based on points
 */
async function checkAndUpdateMemberTier(memberId, currentPoints) {
  const member = await db.query.loyaltyMembers.findFirst({
    where: (0, drizzle_orm_1.eq)(schema.loyaltyMembers.id, memberId)
  });
  if (!member) {
    return;
  }
  const program = await getLoyaltyProgram(member.id);
  if (!program || !program.description) {
    return;
  }
  const points = parseFloat(currentPoints);
  const tiers = JSON.parse(program.description);
  // Find highest tier member qualifies for
  const newTier = tiers
    .sort((a, b) => b.threshold - a.threshold)
    .find(tier => points >= tier.threshold);
  if (newTier && newTier.id !== member.id) {
    await db
      .update(schema.loyaltyMembers)
      .set({ id: newTier.id })
      .where((0, drizzle_orm_1.eq)(schema.loyaltyMembers.id, memberId));
  }
}
// Helper function to generate random strings
function generateRandomString(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}
/**
 * Generate a unique loyalty ID for a new member
 */
async function generateLoyaltyId() {
  // Generate a unique ID with format LOY-XXXXX where X is alphanumeric
  const prefix = 'LOY-';
  let loyaltyId = prefix + generateRandomString(5).toUpperCase();
  // Check if ID already exists
  let existingMember = await db.query.loyaltyMembers.findFirst({
    where: (0, drizzle_orm_1.eq)(schema.loyaltyMembers.loyaltyId, loyaltyId)
  });
    // Generate new IDs until we find a unique one
  while (existingMember) {
    loyaltyId = prefix + generateRandomString(5).toUpperCase();
    existingMember = await db.query.loyaltyMembers.findFirst({
      where: (0, drizzle_orm_1.eq)(schema.loyaltyMembers.loyaltyId, loyaltyId)
    });
  }
  return loyaltyId;
}
/**
 * Enroll a customer in the loyalty program
 */
async function enrollCustomer(customerId, storeId, userId) {
  // Check if already enrolled
  const existingMember = await db.query.loyaltyMembers.findFirst({
    where: (0, drizzle_orm_1.eq)(schema.loyaltyMembers.userId, customerId)
  });
  if (existingMember) {
    return existingMember;
  }
  // Get loyalty program for the store
  let program = await db.query.loyaltyPrograms.findFirst({
    where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.loyaltyPrograms.id, storeId))
  });
    // If no program exists for this store, create a default one
  if (!program) {
    const [newProgram] = await db.insert(schema.loyaltyPrograms)
      .values({
        name: 'ChainSync Rewards',
        description: 'Default loyalty program'
      })
      .returning();
    program = newProgram;
  }
  // Generate loyalty ID
  const loyaltyId = await generateLoyaltyId();
  // Create a new loyalty member
  const [member] = await db.insert(schema.loyaltyMembers)
    .values({
      userId: customerId,
      loyaltyId,
      currentPoints: '0',
      createdAt: new Date()
    })
    .returning();
    // Record loyalty transaction for enrollment
  await db.insert(schema.loyaltyTransactions)
    .values({
      memberId: member.id,
      source: 'enrollment',
      points: '0',
      transactionId: 0
    });
  return member;
}
/**
 * Calculate points to be earned from a transaction
 */
async function calculatePointsForTransaction(subtotal, storeId, items) {
  // Get loyalty program for the store
  const program = await db.query.loyaltyPrograms.findFirst({
    where: (0, drizzle_orm_1.eq)(schema.loyaltyPrograms.id, storeId)
  });
  if (!program) {
    return 0; // No active loyalty program
  }
  // Convert subtotal to number if it's a string
  const subtotalAmount = typeof subtotal === 'string' ? parseFloat(subtotal) : subtotal;
  // Base points from subtotal
  const pointsPerAmount = parseFloat(program.description || '0');
  let totalPoints = subtotalAmount * pointsPerAmount;
  // Additional points from product bonuses
  if (items && items.length > 0) {
    const productIds = items.map(item => item.productId);
    const products = await db.query.products.findMany({
      where: (0, drizzle_orm_1.sql) `${schema.products.id} IN (${productIds.join(', ')})`,
      columns: {
        id: true,
        price: true,
        description: true
      }
    });
    // Map products by ID for easy lookup
    const productsById = products.reduce((acc, product) => {
      acc[product.id] = product;
      return acc;
    }, {});
    // Add bonus points from products
    for (const item of items) {
      const product = productsById[item.productId];
      if (product && product.description) {
        // Bonus points are per product, so multiply by quantity
        const bonusPoints = parseFloat(product.description) * item.quantity;
        totalPoints += bonusPoints;
      }
    }
  }
  // Return rounded points (usually we'd round down for points)
  return Math.floor(totalPoints);
}
/**
 * Record points earned for a transaction
 */
async function recordPointsEarned(transactionId, memberId, points, userId) {
  try {
    if (points <= 0) {
      logger_1.logger.info('No points to accrue', { transactionId, memberId, points, userId, timestamp: new Date().toISOString() });
      return { success: false };
    }
    // Get the member to check their tier and customer
    const member = await db.query.loyaltyMembers.findFirst({
      where: (0, drizzle_orm_1.eq)(schema.loyaltyMembers.id, memberId)
    });
    if (!member) {
      logger_1.logger.error('Member not found', { memberId });
      return { success: false };
    }
    // Get member's tier if any
    const pointsToAdd = points;
    // Calculate updated points
    const updatedPoints = (parseFloat(member.currentPoints || '0') + pointsToAdd).toFixed(2);
    const result = await db.transaction(async(tx) => {
      // Add points to member
      await tx
        .update(schema.loyaltyMembers)
        .set({
          currentPoints: updatedPoints,
          updatedAt: new Date()
        })
        .where((0, drizzle_orm_1.eq)(schema.loyaltyMembers.id, memberId));
      // Record transaction
      const txn = await tx
        .insert(schema.loyaltyTransactions)
        .values({
          memberId,
          transactionId,
          source: 'purchase',
          points: pointsToAdd.toFixed(2)
        })
        .returning();
      return txn[0];
    });
    if (!result) {
      throw new Error('Failed to record loyalty transaction');
    }
    // Update member tier if needed
    await checkAndUpdateMemberTier(memberId, updatedPoints);
    logger_1.logger.info('Points accrued', { memberId, transactionId, points: pointsToAdd, userId, timestamp: new Date().toISOString() });
    return {
      success: true,
      transaction: result
    };
  }
  catch (error) {
    logger_1.logger.error('Error recording points earned', { error, transactionId, memberId, userId });
    return { success: false };
  }
}
/**
 * Get available rewards for a member
 */
async function getAvailableRewards(memberId) {
  return [];
}
/**
 * Get loyalty analytics for store dashboard
 */
async function getLoyaltyAnalytics(storeId) {
  // Get program for store
  const program = await getLoyaltyProgram(storeId);
  const members = await db.query.loyaltyMembers.findMany({
    columns: {
      id: true,
      currentPoints: true,
      userId: true
    }
  });
    // Filter members by store
  const storeMembers = members;
  // Calculate summary stats
  const activeMembers = storeMembers.reduce((acc, member) => {
    return acc + (member.isActive ? 1 : 0);
  }, 0);
  const totalPointsEarned = storeMembers.reduce((acc, member) => {
    return acc + parseFloat(member.totalPointsEarned || '0');
  }, 0).toFixed(2);
  const totalPointsRedeemed = storeMembers.reduce((acc, member) => {
    return acc + parseFloat(member.totalPointsRedeemed || '0');
  }, 0).toFixed(2);
  const averagePoints = (storeMembers.reduce((sum, member) => sum + parseFloat(member.currentPoints || '0'), 0) / (storeMembers.length || 1)).toFixed(2);
  const recentRedemptions = [];
  const rewards = [];
  // Get redemption counts for rewards
  const redemptionCounts = await Promise.all(rewards.map(async(reward) => {
    const redemptions = await db.query.loyaltyTransactions.findMany({
      where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.loyaltyTransactions.source, 'redeem'), (0, drizzle_orm_1.eq)(schema.loyaltyTransactions.id, reward.id))
    });
    return {
      name: reward.name,
      redemptions: redemptions.length
    };
  }));
    // Get top rewards by redemption count
  const topRewards = redemptionCounts
    .sort((a, b) => b.redemptions - a.redemptions)
    .slice(0, 5);
    // Calculate member tier distribution
  const membersByTier = storeMembers.reduce((acc, member) => {
    if (member.tierId) {
      acc[member.tierId] = (acc[member.tierId] || 0) + 1;
    }
    return acc;
  }, {});
    // Calculate points balance
  const pointsBalance = (parseFloat(totalPointsEarned) - parseFloat(totalPointsRedeemed)).toFixed(2);
  return {
    memberCount: storeMembers.length,
    activeMembers,
    totalPointsEarned,
    totalPointsRedeemed,
    pointsBalance: (parseFloat(totalPointsEarned) - parseFloat(totalPointsRedeemed)).toFixed(2),
    averagePoints,
    programDetails: program,
    topRewards,
    recentRedemptions: [],
    membersByTier
  };
}
