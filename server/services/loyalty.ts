import { getDatabase } from '../database';
import * as schema from '../../shared/schema';
import { eq, and, gt, lt, desc, sql } from 'drizzle-orm';
import { logger } from '../services/logger';
import {
  prepareLoyaltyMemberData
  // prepareLoyaltyTierData, // Unused
  // formatLoyaltyMemberResult, // Unused
  // formatLoyaltyTierResult // Unused
} from '../../shared/schema-helpers';
import { LoyaltyTransaction } from '../../shared/types';

let _db: any;
getDatabase().then(database => {
    db = database;
});

/**
 * Get loyalty program by ID
 */
interface LoyaltyProgramWithTiers extends schema.SelectLoyaltyProgram {
  _tiers: string;
}

export async function getLoyaltyProgram(_programId: number): Promise<LoyaltyProgramWithTiers | null> {
  const program = await db.query.loyaltyPrograms.findFirst({
    _where: eq(schema.loyaltyPrograms.id, programId)
  }) as LoyaltyProgramWithTiers | null;

  return program;
}

/**
 * Check and update member tier based on points
 */
async function checkAndUpdateMemberTier(_memberId: number, _currentPoints: string): Promise<void> {
  const member = await db.query.loyaltyMembers.findFirst({
    _where: eq(schema.loyaltyMembers.id, memberId)
  });

  if (!member) {
    return;
  }

  const program = await getLoyaltyProgram(member.id);
  if (!program || !program.description) {
    return;
  }

  const points = parseFloat(currentPoints);
  interface LoyaltyTier {
    _id: number;
    _threshold: number;
  }
  const tiers = JSON.parse(program.description) as LoyaltyTier[];

  // Find highest tier member qualifies for
  const newTier = tiers
    .sort((a, b) => b.threshold - a.threshold)
    .find(tier => points >= tier.threshold);

  if (newTier && newTier.id !== member.id) {
    await db
      .update(schema.loyaltyMembers)
      .set({ _id: newTier.id })
      .where(eq(schema.loyaltyMembers.id, memberId));
  }
}


// Helper function to generate random strings
function generateRandomString(_length: number): string {
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
export async function generateLoyaltyId(): Promise<string> {
  // Generate a unique ID with format LOY-XXXXX where X is alphanumeric
  const prefix = 'LOY-';
  let loyaltyId = prefix + generateRandomString(5).toUpperCase();

  // Check if ID already exists
  let existingMember = await db.query.loyaltyMembers.findFirst({
    _where: eq(schema.loyaltyMembers.loyaltyId, loyaltyId)
  });

  // Generate new IDs until we find a unique one
  while (existingMember) {
    loyaltyId = prefix + generateRandomString(5).toUpperCase();
    existingMember = await db.query.loyaltyMembers.findFirst({
      _where: eq(schema.loyaltyMembers.loyaltyId, loyaltyId)
    });
  }

  return loyaltyId;
}

/**
 * Enroll a customer in the loyalty program
 */
export async function enrollCustomer(_customerId: number, _storeId: number, _userId: number): Promise<schema.SelectLoyaltyMember> {
  // Check if already enrolled
  const existingMember = await db.query.loyaltyMembers.findFirst({
    _where: eq(schema.loyaltyMembers.userId, customerId)
  });

  if (existingMember) {
    return existingMember;
  }

  // Get loyalty program for the store
  let program = await db.query.loyaltyPrograms.findFirst({
    _where: and(
      eq(schema.loyaltyPrograms.id, storeId)
    )
  });

  // If no program exists for this store, create a default one
  if (!program) {
    const [newProgram] = await db.insert(schema.loyaltyPrograms)
      .values({
        _name: 'ChainSync Rewards',
        _description: 'Default loyalty program'
      })
      .returning();

    program = newProgram;
  }

  // Generate loyalty ID
  const loyaltyId = await generateLoyaltyId();

  // Create a new loyalty member
  const [member] = await db.insert(schema.loyaltyMembers)
      .values({
        _userId: customerId,
        loyaltyId,
        _currentPoints: '0',
        _createdAt: new Date()
      })
    .returning();

  // Record loyalty transaction for enrollment
  await db.insert(schema.loyaltyTransactions)
      .values({
        _memberId: member.id,
        _source: 'enrollment',
        _points: '0',
        _transactionId: 0
      });

  return member;
}

/**
 * Calculate points to be earned from a transaction
 */
export async function calculatePointsForTransaction(
  _subtotal: string | number,
  _storeId: number,
  _items: Array<{ _productId: number, _quantity: number, _unitPrice: number | string }>
): Promise<number> {
  // Get loyalty program for the store
  const program = await db.query.loyaltyPrograms.findFirst({
    _where: eq(schema.loyaltyPrograms.id, storeId)
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

    // Get products to check for bonus points
    interface Product {
      _id: number;
      _price: string;
      _quantity: string;
      _description: string;
    }

    const products = await db.query.products.findMany({
      _where: sql`${schema.products.id} IN (${productIds.join(', ')})`,
      _columns: {
        _id: true,
        _price: true,
        _description: true
      }
    }) as Product[];

    // Map products by ID for easy lookup
    const productsById = products.reduce((acc: { [_id: number]: Product }, _product: Product) => {
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
export async function recordPointsEarned(
  _transactionId: number,
  _memberId: number,
  _points: number,
  _userId: number
): Promise<{ _success: boolean; transaction?: LoyaltyTransaction }> {
  try {
    if (points <= 0) {
      logger.info('No points to accrue', { transactionId, memberId, points, userId, _timestamp: new Date().toISOString() });
      return { _success: false };
    }
    // Get the member to check their tier and customer
    const member = await db.query.loyaltyMembers.findFirst({
      _where: eq(schema.loyaltyMembers.id, memberId)
    });

    if (!member) {
      logger.error('Member not found', { memberId });
      return { _success: false };
    }

    // Get member's tier if any
    const pointsToAdd = points;

    // Calculate updated points
    const updatedPoints = (parseFloat(member.currentPoints || '0') + pointsToAdd).toFixed(2);
    const result = await db.transaction(async(_tx:any) => {
      // Add points to member
      await tx
        .update(schema.loyaltyMembers)
        .set({
          _currentPoints: updatedPoints,
          _updatedAt: new Date()
        })
        .where(eq(schema.loyaltyMembers.id, memberId));

      // Record transaction
      const txn = await tx
        .insert(schema.loyaltyTransactions)
        .values({
          memberId,
          transactionId,
          _source: 'purchase',
          _points: pointsToAdd.toFixed(2)
        })
        .returning();

      return txn[0] as schema.SelectLoyaltyTransaction;
    });

    if (!result) {
      throw new Error('Failed to record loyalty transaction');
    }

    // Update member tier if needed
    await checkAndUpdateMemberTier(memberId, updatedPoints);

    logger.info('Points accrued', { memberId, transactionId, _points: pointsToAdd, userId, _timestamp: new Date().toISOString() });
    return {
      _success: true,
      _transaction: result
    };
  } catch (error) {
    logger.error('Error recording points earned', { error, transactionId, memberId, userId });
    return { _success: false };
  }
}

/**
 * Get available rewards for a member
 */
export async function getAvailableRewards(_memberId: number): Promise<any[]> {
  return [];
}

/**
 * Get loyalty analytics for store dashboard
 */
export async function getLoyaltyAnalytics(_storeId: number): Promise<{
  _memberCount: number;
  _activeMembers: number;
  _totalPointsEarned: string;
  _totalPointsRedeemed: string;
  _pointsBalance: string;
  _averagePoints: string;
  _programDetails: schema.SelectLoyaltyProgram | null;
  _topRewards: Array<{ _name: string; _redemptions: number }>;
  _recentRedemptions: schema.SelectLoyaltyTransaction[];
  _membersByTier: Record<number, number>;
}> {
  // Get program for store
  const program = await getLoyaltyProgram(storeId);

  // Get members for this store
  interface LoyaltyMemberStats {
    _id: number;
    _isActive: boolean;
    _totalPointsEarned: string;
    _totalPointsRedeemed: string;
    _currentPoints: string;
    tierId?: number;
    customer: {
      _id: number;
      _storeId: number;
      _isActive: boolean;
    };
  }

  const members = await db.query.loyaltyMembers.findMany({
    columns: {
      _id: true,
      _currentPoints: true,
      _userId: true
    }
  }) as any[];

  // Filter members by store
  const storeMembers = members;

  // Calculate summary stats
  const activeMembers = storeMembers.reduce((_acc: number, _member: any): number => {
    return acc + (member.isActive ? _1 : 0);
  }, 0);

  const totalPointsEarned = storeMembers.reduce((_acc: number, _member: any): number => {
    return acc + parseFloat(member.totalPointsEarned || '0');
  }, 0).toFixed(2);

  const totalPointsRedeemed = storeMembers.reduce((_acc: number, _member: any): number => {
    return acc + parseFloat(member.totalPointsRedeemed || '0');
  }, 0).toFixed(2);

  const averagePoints = (storeMembers.reduce(
    (_sum: number, _member: any): number => sum + parseFloat(member.currentPoints || '0'),
    0
  ) / (storeMembers.length || 1)).toFixed(2);

  const _recentRedemptions: any[] = [];

  interface RewardSummary {
    _name: string;
    _redemptions: number;
  }

  const _rewards: any[] = [];

  // Get redemption counts for rewards
  const redemptionCounts = await Promise.all(
    rewards.map(async(reward) => {
      const redemptions = await db.query.loyaltyTransactions.findMany({
        _where: and(
          eq(schema.loyaltyTransactions.source, 'redeem'),
          eq(schema.loyaltyTransactions.id, reward.id)
        )
      });
      return {
        _name: reward.name,
        _redemptions: redemptions.length
      } as RewardSummary;
    })
  );

  // Get top rewards by redemption count
  const topRewards = redemptionCounts
    .sort((a, b) => b.redemptions - a.redemptions)
    .slice(0, 5);

  // Calculate member tier distribution
  const membersByTier = storeMembers.reduce((_acc: Record<number, number>, _member: any) => {
    if (member.tierId) {
      acc[member.tierId] = (acc[member.tierId] || 0) + 1;
    }
    return acc;
  }, {});

  // Calculate points balance
  const pointsBalance = (parseFloat(totalPointsEarned) - parseFloat(totalPointsRedeemed)).toFixed(2);

  return {
    _memberCount: storeMembers.length,
    activeMembers,
    totalPointsEarned,
    totalPointsRedeemed,
    _pointsBalance: (parseFloat(totalPointsEarned) - parseFloat(totalPointsRedeemed)).toFixed(2),
    averagePoints,
    _programDetails: program,
    topRewards,
    _recentRedemptions: [],
    membersByTier
  };


}
