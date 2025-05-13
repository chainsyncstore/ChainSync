import { db } from "@db";
import * as schema from "@shared/schema";
import { eq, and, gt, lt, desc, sql, asc } from "drizzle-orm";
import { storage } from "../storage";
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
        .set({
          isActive: true,
          lastActivity: new Date(),
          updatedAt: new Date()
        })
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
        pointsPerAmount: "1.00", // 1 point per currency unit
        active: true,
        expiryMonths: 12, // Points expire after 12 months
      })
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
      isActive: true
    })
    .returning();
  
  // Record loyalty transaction for enrollment
  await db.insert(schema.loyaltyTransactions)
    .values({
      memberId: member.id,
      type: "earn", // Could also be a special type like "enroll" if added
      points: "0",
      note: "Enrollment in ChainSync Rewards program",
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
    const products = await db.query.products.findMany({
      where: sql`${schema.products.id} IN (${productIds.join(', ')})`,
    });
    
    // Map products by ID for easy lookup
    const productsById = products.reduce((acc, product) => {
      acc[product.id] = product;
      return acc;
    }, {} as Record<number, schema.Product>);
    
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
): Promise<{ success: boolean; transaction?: schema.LoyaltyTransaction }> {
  try {
    if (points <= 0) {
      return { success: false };
    }
    
    // Get the member to check their tier
    const member = await db.query.loyaltyMembers.findFirst({
      where: eq(schema.loyaltyMembers.id, memberId),
      with: {
        tier: true,
      }
    });
    
    if (!member) {
      return { success: false };
    }
    
    let pointsToAdd = points;
    
    // Apply tier multiplier if applicable
    if (member.tier && member.tier.pointMultiplier) {
      pointsToAdd = points * parseFloat(member.tier.pointMultiplier);
    }
    
    // Record loyalty transaction
    const [loyaltyTransaction] = await db.insert(schema.loyaltyTransactions)
      .values({
        memberId,
        transactionId,
        type: "earn",
        points: pointsToAdd.toString(),
        createdBy: userId
      })
      .returning();
    
    // Update member point balances
    const currentPoints = parseFloat(member.currentPoints) + pointsToAdd;
    const totalPointsEarned = parseFloat(member.totalPointsEarned) + pointsToAdd;
    
    await db.update(schema.loyaltyMembers)
      .set({
        currentPoints: currentPoints.toString(),
        totalPointsEarned: totalPointsEarned.toString(),
        lastActivity: new Date(),
        updatedAt: new Date()
      })
      .where(eq(schema.loyaltyMembers.id, memberId));
    
    // Update transaction to record points earned
    await db.update(schema.transactions)
      .set({
        pointsEarned: pointsToAdd.toString()
      })
      .where(eq(schema.transactions.id, transactionId));
    
    // Check if member should be upgraded to a new tier
    await checkAndUpdateMemberTier(memberId);
    
    return { 
      success: true,
      transaction: loyaltyTransaction 
    };
  } catch (error) {
    console.error("Error recording points earned:", error);
    return { success: false };
  }
}

/**
 * Get available rewards for a member
 */
export async function getAvailableRewards(memberId: number): Promise<schema.LoyaltyReward[]> {
  // Get member info including current points
  const member = await db.query.loyaltyMembers.findFirst({
    where: eq(schema.loyaltyMembers.id, memberId)
  });
  
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
 * Apply a reward to a transaction
 */
export async function applyReward(
  memberId: number,
  rewardId: number,
  transactionId: number,
  userId: number
): Promise<{ 
  success: boolean; 
  discountAmount?: string; 
  pointsRedeemed?: string;
  message?: string;
}> {
  try {
    // Get member info
    const member = await db.query.loyaltyMembers.findFirst({
      where: eq(schema.loyaltyMembers.id, memberId)
    });
    
    if (!member) {
      return { success: false, message: "Member not found" };
    }
    
    // Get reward info
    const reward = await db.query.loyaltyRewards.findFirst({
      where: eq(schema.loyaltyRewards.id, rewardId),
      with: {
        product: true
      }
    });
    
    if (!reward) {
      return { success: false, message: "Reward not found" };
    }
    
    // Check if member has enough points
    const memberPoints = parseFloat(member.currentPoints);
    const rewardCost = parseFloat(reward.pointsCost);
    
    if (memberPoints < rewardCost) {
      return { success: false, message: "Insufficient points" };
    }
    
    // Get transaction
    const transaction = await db.query.transactions.findFirst({
      where: eq(schema.transactions.id, transactionId)
    });
    
    if (!transaction) {
      return { success: false, message: "Transaction not found" };
    }
    
    // Calculate discount amount based on reward type
    let discountAmount = "0";
    
    if (reward.discountType === "fixed" && reward.discountValue) {
      // Fixed amount discount
      discountAmount = reward.discountValue;
    } else if (reward.discountType === "percentage" && reward.discountValue) {
      // Percentage discount
      const percentage = parseFloat(reward.discountValue) / 100;
      const calculatedDiscount = parseFloat(transaction.subtotal) * percentage;
      discountAmount = calculatedDiscount.toFixed(2);
    } else if (reward.discountType === "free_product" && reward.productId) {
      // Free product - would need to check if this product is in the cart
      // For simplicity, we're assuming the product value as discount
      if (reward.product) {
        discountAmount = reward.product.price;
      }
    }
    
    // Record point redemption
    const [loyaltyTransaction] = await db.insert(schema.loyaltyTransactions)
      .values({
        memberId,
        transactionId,
        type: "redeem",
        points: `-${rewardCost}`, // Negative points for redemption
        rewardId,
        note: `Redeemed ${reward.name}`,
        createdBy: userId
      })
      .returning();
    
    // Update member points
    const newPoints = memberPoints - rewardCost;
    const totalRedeemed = parseFloat(member.totalPointsRedeemed) + rewardCost;
    
    await db.update(schema.loyaltyMembers)
      .set({
        currentPoints: newPoints.toString(),
        totalPointsRedeemed: totalRedeemed.toString(),
        lastActivity: new Date(),
        updatedAt: new Date()
      })
      .where(eq(schema.loyaltyMembers.id, memberId));
    
    // Update transaction with discount and points
    await db.update(schema.transactions)
      .set({
        discountAmount,
        pointsRedeemed: rewardCost.toString(),
        rewardId: reward.id
      })
      .where(eq(schema.transactions.id, transactionId));
    
    return { 
      success: true, 
      discountAmount, 
      pointsRedeemed: rewardCost.toString() 
    };
  } catch (error) {
    console.error("Error applying reward:", error);
    return { success: false, message: "Error applying reward" };
  }
}

/**
 * Get loyalty member by ID or loyalty ID
 */
export async function getLoyaltyMember(identifier: string | number): Promise<schema.LoyaltyMember | null> {
  let member: schema.LoyaltyMember | null = null;
  
  if (typeof identifier === 'number') {
    // Lookup by member ID
    member = await db.query.loyaltyMembers.findFirst({
      where: eq(schema.loyaltyMembers.id, identifier),
      with: {
        customer: true,
        tier: true
      }
    });
  } else {
    // Lookup by loyalty ID
    member = await db.query.loyaltyMembers.findFirst({
      where: eq(schema.loyaltyMembers.loyaltyId, identifier),
      with: {
        customer: true,
        tier: true
      }
    });
  }
  
  return member;
}

/**
 * Get loyalty member by customer ID
 */
export async function getLoyaltyMemberByCustomerId(customerId: number): Promise<schema.LoyaltyMember | null> {
  return await db.query.loyaltyMembers.findFirst({
    where: eq(schema.loyaltyMembers.customerId, customerId),
    with: {
      customer: true,
      tier: true
    }
  });
}

/**
 * Get loyalty activity history for a member
 */
export async function getMemberActivityHistory(memberId: number, limit = 20, offset = 0): Promise<schema.LoyaltyTransaction[]> {
  return await db.query.loyaltyTransactions.findMany({
    where: eq(schema.loyaltyTransactions.memberId, memberId),
    orderBy: [desc(schema.loyaltyTransactions.createdAt)],
    limit,
    offset,
    with: {
      transaction: true,
      reward: true
    }
  });
}

/**
 * Get loyalty program for a store
 */
export async function getLoyaltyProgram(storeId: number): Promise<schema.LoyaltyProgram | null> {
  return await db.query.loyaltyPrograms.findFirst({
    where: and(
      eq(schema.loyaltyPrograms.storeId, storeId),
      eq(schema.loyaltyPrograms.active, true)
    ),
    with: {
      tiers: true,
      rewards: {
        where: eq(schema.loyaltyRewards.active, true)
      }
    }
  });
}

/**
 * Create or update a loyalty program for a store
 */
export async function upsertLoyaltyProgram(
  storeId: number,
  programData: Partial<schema.LoyaltyProgramInsert>
): Promise<schema.LoyaltyProgram> {
  // Check if program already exists
  const existingProgram = await db.query.loyaltyPrograms.findFirst({
    where: eq(schema.loyaltyPrograms.storeId, storeId)
  });
  
  if (existingProgram) {
    // Update existing program
    const [updatedProgram] = await db.update(schema.loyaltyPrograms)
      .set({
        ...programData,
        updatedAt: new Date()
      })
      .where(eq(schema.loyaltyPrograms.id, existingProgram.id))
      .returning();
    
    return updatedProgram;
  } else {
    // Create new program
    const [newProgram] = await db.insert(schema.loyaltyPrograms)
      .values({
        storeId,
        name: programData.name || "ChainSync Rewards",
        pointsPerAmount: programData.pointsPerAmount || "1.00",
        active: programData.active !== undefined ? programData.active : true,
        expiryMonths: programData.expiryMonths || 12
      })
      .returning();
    
    return newProgram;
  }
}

/**
 * Create a loyalty tier
 */
export async function createLoyaltyTier(tierData: schema.LoyaltyTierInsert): Promise<schema.LoyaltyTier> {
  const [tier] = await db.insert(schema.loyaltyTiers)
    .values(tierData)
    .returning();
  
  return tier;
}

/**
 * Create a loyalty reward
 */
export async function createLoyaltyReward(rewardData: schema.LoyaltyRewardInsert): Promise<schema.LoyaltyReward> {
  const [reward] = await db.insert(schema.loyaltyRewards)
    .values(rewardData)
    .returning();
  
  return reward;
}

/**
 * Process expired points for all members
 */
export async function processExpiredPoints(userId: number): Promise<number> {
  let expiredCount = 0;
  
  // Get all active loyalty programs
  const programs = await db.query.loyaltyPrograms.findMany({
    where: eq(schema.loyaltyPrograms.active, true)
  });
  
  for (const program of programs) {
    if (!program.expiryMonths) continue;
    
    // Calculate expiry date based on program settings
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() - program.expiryMonths);
    
    // Get members with no activity since expiry date
    const inactiveMembers = await db.query.loyaltyMembers.findMany({
      where: and(
        lt(schema.loyaltyMembers.lastActivity, expiryDate),
        gt(schema.loyaltyMembers.currentPoints, "0")
      )
    });
    
    for (const member of inactiveMembers) {
      // Record expired points
      await db.insert(schema.loyaltyTransactions)
        .values({
          memberId: member.id,
          type: "expire",
          points: `-${member.currentPoints}`,
          note: `Points expired due to ${program.expiryMonths} months of inactivity`,
          createdBy: userId
        });
      
      // Reset current points
      await db.update(schema.loyaltyMembers)
        .set({
          currentPoints: "0",
          updatedAt: new Date()
        })
        .where(eq(schema.loyaltyMembers.id, member.id));
      
      expiredCount++;
    }
  }
  
  return expiredCount;
}

/**
 * Check and update member tier based on total points earned
 */
export async function checkAndUpdateMemberTier(memberId: number): Promise<boolean> {
  const member = await db.query.loyaltyMembers.findFirst({
    where: eq(schema.loyaltyMembers.id, memberId),
    with: {
      customer: true
    }
  });
  
  if (!member || !member.customer.storeId) {
    return false;
  }
  
  // Get program for the member's store
  const program = await db.query.loyaltyPrograms.findFirst({
    where: eq(schema.loyaltyPrograms.storeId, member.customer.storeId)
  });
  
  if (!program) {
    return false;
  }
  
  // Get all tiers sorted by required points
  const tiers = await db.query.loyaltyTiers.findMany({
    where: and(
      eq(schema.loyaltyTiers.programId, program.id),
      eq(schema.loyaltyTiers.active, true)
    ),
    orderBy: [desc(schema.loyaltyTiers.requiredPoints)]
  });
  
  if (tiers.length === 0) {
    return false;
  }
  
  // Find the highest tier the member qualifies for
  const totalPointsEarned = parseFloat(member.totalPointsEarned);
  let newTierId: number | null = null;
  
  for (const tier of tiers) {
    if (totalPointsEarned >= parseFloat(tier.requiredPoints)) {
      newTierId = tier.id;
      break;
    }
  }
  
  // Update member tier if needed
  if (newTierId !== member.tierId) {
    await db.update(schema.loyaltyMembers)
      .set({
        tierId: newTierId,
        updatedAt: new Date()
      })
      .where(eq(schema.loyaltyMembers.id, member.id));
    
    return true;
  }
  
  return false;
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
  programDetails: schema.LoyaltyProgram | null;
  topRewards: Array<{ name: string; redemptions: number }>;
}> {
  // Get program for store
  const program = await getLoyaltyProgram(storeId);
  
  // Get members for this store
  const members = await db.query.customers.findMany({
    where: eq(schema.customers.storeId, storeId),
    with: {
      loyaltyMembers: true
    }
  });
  
  const loyaltyMembers = members
    .filter(c => c.loyaltyMembers && c.loyaltyMembers.length > 0)
    .flatMap(c => c.loyaltyMembers);
  
  // Calculate summary stats
  const activeMembers = loyaltyMembers.filter(m => m.isActive).length;
  
  const totalPointsEarned = loyaltyMembers.reduce(
    (sum, member) => sum + parseFloat(member.totalPointsEarned || "0"), 
    0
  ).toFixed(2);
  
  const totalPointsRedeemed = loyaltyMembers.reduce(
    (sum, member) => sum + parseFloat(member.totalPointsRedeemed || "0"), 
    0
  ).toFixed(2);
  
  const pointsBalance = loyaltyMembers.reduce(
    (sum, member) => sum + parseFloat(member.currentPoints || "0"), 
    0
  ).toFixed(2);
  
  // Get top redeemed rewards
  const rewards = await db.query.loyaltyRewards.findMany({
    where: program ? eq(schema.loyaltyRewards.programId, program.id) : undefined
  });
  
  // Count redemptions for each reward
  const rewardRedemptions: Record<number, number> = {};
  
  if (rewards.length > 0) {
    const rewardIds = rewards.map(r => r.id);
    
    // Get all redemption transactions for these rewards
    const redemptions = await db.query.loyaltyTransactions.findMany({
      where: and(
        eq(schema.loyaltyTransactions.type, "redeem"),
        sql`${schema.loyaltyTransactions.rewardId} IN (${rewardIds.join(', ')})`
      )
    });
    
    // Count redemptions by reward
    for (const redemption of redemptions) {
      if (redemption.rewardId) {
        rewardRedemptions[redemption.rewardId] = (rewardRedemptions[redemption.rewardId] || 0) + 1;
      }
    }
  }
  
  // Map reward redemptions to names
  const topRewards = rewards
    .map(reward => ({
      name: reward.name,
      redemptions: rewardRedemptions[reward.id] || 0
    }))
    .sort((a, b) => b.redemptions - a.redemptions)
    .slice(0, 5);
  
  return {
    memberCount: loyaltyMembers.length,
    activeMembers,
    totalPointsEarned,
    totalPointsRedeemed,
    pointsBalance,
    programDetails: program,
    topRewards
  };
}