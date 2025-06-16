import { getDatabase } from "../database";
import * as schema from "../../shared/schema";
import { eq, and, gt, lt, desc, sql } from "drizzle-orm";
import { logger } from "../services/logger";
import { 
  prepareLoyaltyMemberData
  // prepareLoyaltyTierData, // Unused
  // formatLoyaltyMemberResult, // Unused
  // formatLoyaltyTierResult // Unused
} from "../../shared/schema-helpers";

/**
 * Get loyalty program by ID
 */
interface LoyaltyProgramWithTiers extends schema.LoyaltyProgram {
  tiers: string;
}

export async function getLoyaltyProgram(programId: number): Promise<LoyaltyProgramWithTiers | null> {
  const program = await db.query.loyaltyPrograms.findFirst({
    where: eq(schema.loyaltyPrograms.id, programId),
    columns: {
      id: true,
      name: true,
      storeId: true,
      pointsPerAmount: true,
      active: true,
      createdAt: true,
      updatedAt: true,
      tiers: true
    }
  }) as LoyaltyProgramWithTiers | null;

  return program;
}

/**
 * Check and update member tier based on points
 */
async function checkAndUpdateMemberTier(memberId: number, currentPoints: string): Promise<void> {
  const member = await db.query.loyaltyMembers.findFirst({
    where: eq(schema.loyaltyMembers.id, memberId),
    columns: {
      id: true,
      programId: true,
      tierId: true
    }
  });

  if (!member) {
    return;
  }

  const program = await getLoyaltyProgram(member.programId);
  if (!program || !program.tiers) {
    return;
  }

  const points = parseFloat(currentPoints);
  interface LoyaltyTier {
    id: number;
    threshold: number;
  }
  const tiers = JSON.parse(program.tiers) as LoyaltyTier[];
  
  // Find highest tier member qualifies for
  const newTier = tiers
    .sort((a, b) => b.threshold - a.threshold)
    .find(tier => points >= tier.threshold);

  if (newTier && newTier.id !== member.tierId) {
    await db
      .update(schema.loyaltyMembers)
      .set({ tierId: newTier.id })
      .where(eq(schema.loyaltyMembers.id, memberId));
  }
}

import { 
  // LoyaltyMember, // Unused
  LoyaltyTransaction
  // LoyaltyProgram, // Unused
  // LoyaltyTier // Unused
} from "../../shared/types";

const db = await getDatabase();



// Helper function to generate random strings
function generateRandomString(length: number): string {
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
  const prefix = "LOY-";
  let loyaltyId = prefix + generateRandomString(5).toUpperCase();
  
  // Check if ID already exists
  let existingMember = await db.query.loyaltyMembers.findFirst({
    where: eq(schema.loyaltyMembers.loyaltyId, loyaltyId)
  });
  
  // Generate new IDs until we find a unique one
  while (existingMember) {
    loyaltyId = prefix + generateRandomString(5).toUpperCase();
    existingMember = await db.query.loyaltyMembers.findFirst({
      where: eq(schema.loyaltyMembers.loyaltyId, loyaltyId)
    });
  }
  
  return loyaltyId;
}

/**
 * Enroll a customer in the loyalty program
 */
export async function enrollCustomer(customerId: number, storeId: number, userId: number): Promise<schema.LoyaltyMember> {
  // Check if already enrolled
  const existingMember = await db.query.loyaltyMembers.findFirst({
    where: eq(schema.loyaltyMembers.customerId, customerId),
    with: {
      customer: true
    }
  });
  
  if (existingMember) {
    if (!existingMember.isActive) {
      // Reactivate the account if it was inactive
      const [updatedMember] = await db.update(schema.loyaltyMembers)
        .set(prepareLoyaltyMemberData({
          status: "active",
          lastActivity: new Date(),
          updatedAt: new Date()
        }))
        .where(eq(schema.loyaltyMembers.id, existingMember.id))
        .returning();
      
      return updatedMember;
    }
    return existingMember;
  }
  
  // Get loyalty program for the store
  let program = await db.query.loyaltyPrograms.findFirst({
    where: and(
      eq(schema.loyaltyPrograms.storeId, storeId),
      eq(schema.loyaltyPrograms.active, true)
    )
  });
  
  // If no program exists for this store, create a default one
  if (!program) {
    const [newProgram] = await db.insert(schema.loyaltyPrograms)
      .values({
        storeId,
        name: "ChainSync Rewards",
        pointsPerAmount: "1.00",
        active: true,
        expiryMonths: 12
      } as any)
      .returning();
    
    program = newProgram;
  }
  
  // Generate loyalty ID
  const loyaltyId = await generateLoyaltyId();
  
  // Create a new loyalty member
  const [member] = await db.insert(schema.loyaltyMembers)
    .values({
      customerId,
      loyaltyId,
      currentPoints: "0",
      totalPointsEarned: "0",
      totalPointsRedeemed: "0",
      enrollmentDate: new Date(),
      lastActivity: new Date(),
      isActive: true,
      tierId: null,
      createdAt: new Date()
    })
    .returning();
  
  // Record loyalty transaction for enrollment
  await db.insert(schema.loyaltyTransactions)
    .values({
      memberId: member.id,
      type: "earn", // Could also be a special type like "enroll" if added
      points: "0",
      createdBy: userId
    });
  
  return member;
}

/**
 * Calculate points to be earned from a transaction
 */
export async function calculatePointsForTransaction(
  subtotal: string | number,
  storeId: number,
  items: Array<{ productId: number, quantity: number, unitPrice: number | string }>
): Promise<number> {
  // Get loyalty program for the store
  const program = await db.query.loyaltyPrograms.findFirst({
    where: and(
      eq(schema.loyaltyPrograms.storeId, storeId),
      eq(schema.loyaltyPrograms.active, true)
    )
  });
  
  if (!program) {
    return 0; // No active loyalty program
  }
  
  // Convert subtotal to number if it's a string
  const subtotalAmount = typeof subtotal === 'string' ? parseFloat(subtotal) : subtotal;
  
  // Base points from subtotal
  const pointsPerAmount = parseFloat(program.pointsPerAmount);
  let totalPoints = subtotalAmount * pointsPerAmount;
  
  // Additional points from product bonuses
  if (items && items.length > 0) {
    const productIds = items.map(item => item.productId);
    
    // Get products to check for bonus points
    interface Product {
      id: number;
      price: string;
      quantity: string;
      bonusPoints: string;
    }

    const products = await db.query.products.findMany({
      where: sql`${schema.products.id} IN (${productIds.join(', ')})`,
      columns: {
        id: true,
        price: true,
        quantity: true,
        bonusPoints: true
      }
    }) as Product[];

    // Map products by ID for easy lookup
    const productsById = products.reduce((acc: { [id: number]: Product }, product: Product) => {
      acc[product.id] = product;
      return acc;
    }, {});

    // Add bonus points from products
    for (const item of items) {
      const product = productsById[item.productId];
      if (product && product.bonusPoints) {
        // Bonus points are per product, so multiply by quantity
        const bonusPoints = parseFloat(product.bonusPoints) * item.quantity;
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
  transactionId: number,
  memberId: number,
  points: number,
  userId: number
): Promise<{ success: boolean; transaction?: LoyaltyTransaction }> {
  try {
    if (points <= 0) {
      logger.info("No points to accrue", { transactionId, memberId, points, userId, timestamp: new Date().toISOString() });
      return { success: false };
    }
    // Get the member to check their tier and customer
    const member = await db.query.loyaltyMembers.findFirst({
      where: eq(schema.loyaltyMembers.id, memberId),
      columns: {
        id: true,
        currentPoints: true,
        totalPointsEarned: true,
        tierId: true,
        customer: {
          id: true,
          isActive: true
        }
      }
    });

    if (!member) {
      logger.error('Member not found', { memberId });
      return { success: false };
    }

    // Loyalty enabled check
    if (!member.customer?.isActive) {
      logger.info('Loyalty accrual blocked: customer inactive', { customerId: member.customer.id, transactionId });
      return { success: false };
    }

    // Get member's tier if any
    let pointsToAdd = points;
    if (member.tierId) {
      const memberTier = await db.query.loyaltyTiers.findFirst({
        where: eq(schema.loyaltyTiers.id, member.tierId),
        columns: {
          id: true,
          pointMultiplier: true
        }
      });

      // Apply tier multiplier if applicable
      if (memberTier?.pointMultiplier) {
        pointsToAdd = points * parseFloat(memberTier.pointMultiplier);
      }
    }
    
    // Calculate updated points
    const updatedPoints = (parseFloat(member.currentPoints || '0') + pointsToAdd).toFixed(2);
    const result = await db.transaction(async (tx: typeof db) => {
      // Add points to member
      await tx
        .update(schema.loyaltyMembers)
        .set({ 
          currentPoints: updatedPoints,
          totalPointsEarned: (parseFloat(member.totalPointsEarned || '0') + pointsToAdd).toFixed(2),
          lastActivity: new Date(),
          updatedAt: new Date()
        })
        .where(eq(schema.loyaltyMembers.id, memberId));

      // Record transaction
      const txn = await tx
        .insert(schema.loyaltyTransactions)
        .values({
          memberId,
          transactionId,
          type: 'earn',
          points: pointsToAdd.toFixed(2),
          createdBy: userId
        })
        .returning();

      // Update transaction to record points earned
      await tx
        .update(schema.transactions)
        .set({
          pointsEarned: pointsToAdd.toFixed(2)
        })
        .where(eq(schema.transactions.id, transactionId));

      return txn[0] as schema.LoyaltyTransaction;
    });

    if (!result) {
      throw new Error('Failed to record loyalty transaction');
    }

    // Update member tier if needed
    await checkAndUpdateMemberTier(memberId, updatedPoints);

    logger.info('Points accrued', { memberId, transactionId, points: pointsToAdd, userId, timestamp: new Date().toISOString() });
    return { 
      success: true,
      transaction: result 
    };
  } catch (error) {
    logger.error('Error recording points earned', { error, transactionId, memberId, userId });
    return { success: false };
  }
}

/**
 * Get available rewards for a member
 */
export async function getAvailableRewards(memberId: number): Promise<schema.LoyaltyReward[]> {
  // Get member info
  interface LoyaltyMember {
    id: number;
    programId: number;
    currentPoints: string;
    customerId: number;
  }

  const member = await db.query.loyaltyMembers.findFirst({
    where: eq(schema.loyaltyMembers.id, memberId),
    columns: {
      id: true,
      programId: true,
      currentPoints: true,
      customerId: true
    }
  }) as LoyaltyMember | null;
  
  if (!member) {
    return [];
  }
  
  // Get customer and store info
  const customer = await db.query.customers.findFirst({
    where: eq(schema.customers.id, member.customerId)
  });
  
  if (!customer || !customer.storeId) {
    return [];
  }
  
  // Get all active rewards for the store's program that the member can afford
  const program = await db.query.loyaltyPrograms.findFirst({
    where: eq(schema.loyaltyPrograms.storeId, customer.storeId)
  });
  
  if (!program) {
    return [];
  }
  
  const currentDate = new Date();
  const memberPoints = parseFloat(member.currentPoints);
  
  // Get rewards that are active, not expired, and affordable
  const rewards = await db.query.loyaltyRewards.findMany({
    where: and(
      eq(schema.loyaltyRewards.programId, program.id),
      eq(schema.loyaltyRewards.active, true),
      lt(schema.loyaltyRewards.pointsCost, memberPoints.toString()),
      sql`(${schema.loyaltyRewards.startDate} IS NULL OR ${schema.loyaltyRewards.startDate} <= ${currentDate})`,
      sql`(${schema.loyaltyRewards.endDate} IS NULL OR ${schema.loyaltyRewards.endDate} >= ${currentDate})`
    ),
    with: {
      product: true
    }
  });
  
  return rewards;
}

/**
 * Get loyalty analytics for store dashboard
 */
export async function getLoyaltyAnalytics(storeId: number): Promise<{
  memberCount: number;
  activeMembers: number;
  totalPointsEarned: string;
  totalPointsRedeemed: string;
  pointsBalance: string;
  averagePoints: string;
  programDetails: schema.LoyaltyProgram | null;
  topRewards: Array<{ name: string; redemptions: number }>;
  recentRedemptions: schema.LoyaltyTransaction[];
  membersByTier: Record<number, number>;
}> {
  // Get program for store
  const program = await getLoyaltyProgram(storeId);
  
  // Get members for this store
  interface LoyaltyMemberStats {
    id: number;
    isActive: boolean;
    totalPointsEarned: string;
    totalPointsRedeemed: string;
    currentPoints: string;
    tierId?: number;
    customer: {
      id: number;
      storeId: number;
      isActive: boolean;
    };
  }

  const members = await db.query.loyaltyMembers.findMany({
    where: and(
      eq(schema.loyaltyMembers.isActive, true)
    ),
    columns: {
      id: true,
      isActive: true,
      totalPointsEarned: true,
      totalPointsRedeemed: true,
      currentPoints: true,
      tierId: true
    },
    with: {
      customer: {
        columns: {
          id: true,
          storeId: true,
          isActive: true
        }
      }
    }
  }) as LoyaltyMemberStats[];

  // Filter members by store
  const storeMembers = members.filter(member => member.customer.storeId === storeId);

  // Calculate summary stats
  const activeMembers = storeMembers.reduce((acc: number, member: LoyaltyMemberStats): number => {
    return acc + (member.isActive && member.customer.isActive ? 1 : 0);
  }, 0);
  
  const totalPointsEarned = storeMembers.reduce((acc: number, member: LoyaltyMemberStats): number => {
    return acc + parseFloat(member.totalPointsEarned || '0');
  }, 0).toFixed(2);
  
  const totalPointsRedeemed = storeMembers.reduce((acc: number, member: LoyaltyMemberStats): number => {
    return acc + parseFloat(member.totalPointsRedeemed || '0');
  }, 0).toFixed(2);
  
  const averagePoints = (storeMembers.reduce(
    (sum: number, member: LoyaltyMemberStats): number => sum + parseFloat(member.currentPoints || "0"),
    0
  ) / (storeMembers.length || 1)).toFixed(2);
  
  // Get recent rewards redeemed
  interface RecentRedemption extends schema.LoyaltyTransaction {
    reward?: {
      name: string;
    };
  }

  const recentRedemptions = await db.query.loyaltyTransactions.findMany({
    where: and(
      eq(schema.loyaltyTransactions.type, 'redeem'),
      eq(schema.loyaltyTransactions.memberId, sql`ANY(SELECT id FROM ${schema.loyaltyMembers} WHERE store_id = ${storeId})`)
    ),
    orderBy: [desc(schema.loyaltyTransactions.createdAt)],
    limit: 5,
    columns: {
      id: true,
      createdAt: true,
      memberId: true,
      transactionId: true,
      rewardId: true,
      type: true,
      points: true,
      note: true,
      createdBy: true
    },
    with: {
      reward: {
        columns: {
          name: true
        }
      }
    }
  }) as RecentRedemption[];

  interface RewardSummary {
    name: string;
    redemptions: number;
  }

  // Get rewards and their redemption counts
  const rewards = await db.query.loyaltyRewards.findMany({
    where: eq(schema.loyaltyPrograms.storeId, storeId),
    columns: {
      id: true,
      name: true
    }
  }) as { id: number; name: string }[];

  // Get redemption counts for rewards
  const redemptionCounts = await Promise.all(
    rewards.map(async (reward) => {
      const redemptions = await db.query.loyaltyTransactions.findMany({
        where: and(
          eq(schema.loyaltyTransactions.type, 'redeem'),
          eq(schema.loyaltyTransactions.rewardId, reward.id)
        )
      });
      return {
        name: reward.name,
        redemptions: redemptions.length
      } as RewardSummary;
    })
  );

  // Get top rewards by redemption count
  const topRewards = redemptionCounts
    .sort((a, b) => b.redemptions - a.redemptions)
    .slice(0, 5);

  // Calculate member tier distribution
  const membersByTier = storeMembers.reduce((acc: Record<number, number>, member: LoyaltyMemberStats) => {
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
    recentRedemptions: recentRedemptions.map((r: schema.LoyaltyTransaction) => ({
      id: r.id,
      createdAt: r.createdAt,
      memberId: r.memberId,
      transactionId: r.transactionId,
      rewardId: r.rewardId,
      type: r.type,
      points: r.points,
      note: r.note,
      createdBy: r.createdBy
    })),
    membersByTier
  };


}