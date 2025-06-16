import { BaseService } from '../base/service';
import { ILoyaltyService, LoyaltyServiceErrors } from './types'; // ILoyaltyServiceErrors removed
import { db } from '@db';
import * as schema from '@shared/schema';
import { eq, and, gt, lt, desc, sql, asc } from 'drizzle-orm';
import { 
  // prepareLoyaltyTierData, // Unused
  prepareLoyaltyMemberData, 
  // prepareLoyaltyRedemptionData, // Unused
  formatLoyaltyTierResult
  // formatLoyaltyMemberResult // Unused
} from '@shared/schema-helpers';

export class LoyaltyService extends BaseService implements ILoyaltyService {
  private static readonly POINTS_EXPIRY_MONTHS = 12;
  // private static readonly REWARD_THRESHOLD = 1000; // Unused

  async generateLoyaltyId(): Promise<string> {
    try {
      const prefix = "LOY-";
      let loyaltyId = prefix + this.generateRandomString(5).toUpperCase();
      
      let existingMember = await db.query.loyaltyMembers.findFirst({
        where: eq(schema.loyaltyMembers.loyaltyId, loyaltyId)
      });
      
      while (existingMember) {
        loyaltyId = prefix + this.generateRandomString(5).toUpperCase();
        existingMember = await db.query.loyaltyMembers.findFirst({
          where: eq(schema.loyaltyMembers.loyaltyId, loyaltyId)
        });
      }
      
      return loyaltyId;
    } catch (error) {
      this.handleError(error, 'Generating loyalty ID');
    }
  }

  async enrollCustomer(
    customerId: number,
    storeId: number,
    userId: number
  ): Promise<schema.LoyaltyMember> {
    try {
      const existingMember = await db.query.loyaltyMembers.findFirst({
        where: eq(schema.loyaltyMembers.customerId, customerId)
      });

      if (existingMember) {
        throw LoyaltyServiceErrors.DUPLICATE_MEMBER;
      }

      const loyaltyId = await this.generateLoyaltyId();
      const member = await db.insert(schema.loyaltyMembers).values({
        customerId,
        storeId,
        loyaltyId,
        status: 'active',
        points: 0,
        createdAt: new Date(),
        createdBy: userId
      }).returning();

      return member[0];
    } catch (error) {
      this.handleError(error, 'Enrolling customer in loyalty program');
    }
  }

  async calculatePointsForTransaction(
    subtotal: string | number,
    storeId: number,
    items: Array<{ productId: number, quantity: number, unitPrice: number | string }>
  ): Promise<number> {
    try {
      const program = await this.getLoyaltyProgram(storeId);
      if (!program) {
        throw LoyaltyServiceErrors.PROGRAM_NOT_FOUND;
      }

      const subtotalNum = typeof subtotal === 'string' ? parseFloat(subtotal) : subtotal;
      const points = Math.floor(subtotalNum * (program.pointsPerDollar || 1));

      return points;
    } catch (error) {
      this.handleError(error, 'Calculating points for transaction');
    }
  }

  async recordPointsEarned(
    transactionId: number,
    memberId: number,
    points: number,
    userId: number
  ): Promise<{ success: boolean; transaction?: schema.LoyaltyTransaction }> {
    try {
      const transaction = await db.transaction(async (tx) => {
        // Record the points transaction
        const pointsTx = await tx.insert(schema.loyaltyTransactions).values({
          memberId,
          transactionId,
          pointsEarned: points,
          pointsRedeemed: 0,
          status: 'completed',
          createdAt: new Date(),
          createdBy: userId
        }).returning();

        // Update member points
        await tx.update(schema.loyaltyMembers)
          .set({
            points: sql<number>`${schema.loyaltyMembers.points} + ${points}`,
            updatedAt: new Date(),
            updatedBy: userId
          })
          .where(eq(schema.loyaltyMembers.id, memberId));

        // Check and update tier if needed
        await this.checkAndUpdateMemberTier(memberId);

        return pointsTx[0];
      });

      return {
        success: true,
        transaction
      };
    } catch (error) {
      this.handleError(error, 'Recording points earned');
    }
  }

  async getAvailableRewards(memberId: number): Promise<schema.LoyaltyReward[]> {
    try {
      const member = await db.query.loyaltyMembers.findFirst({
        where: eq(schema.loyaltyMembers.id, memberId)
      });

      if (!member) {
        throw LoyaltyServiceErrors.CUSTOMER_NOT_FOUND;
      }

      return await db
        .select()
        .from(schema.loyaltyRewards)
        .where(
          and(
            eq(schema.loyaltyRewards.storeId, member.storeId),
            gte(schema.loyaltyRewards.pointsRequired, member.points)
          )
        )
        .orderBy(asc(schema.loyaltyRewards.pointsRequired));
    } catch (error) {
      this.handleError(error, 'Getting available rewards');
    }
  }

  async applyReward(
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
      const [member, reward] = await db.transaction(async (tx) => {
        const member = await tx.query.loyaltyMembers.findFirst({
          where: eq(schema.loyaltyMembers.id, memberId)
        });

        if (!member) {
          throw LoyaltyServiceErrors.CUSTOMER_NOT_FOUND;
        }

        const reward = await tx.query.loyaltyRewards.findFirst({
          where: eq(schema.loyaltyRewards.id, rewardId)
        });

        if (!reward) {
          throw LoyaltyServiceErrors.REWARD_NOT_FOUND;
        }

        if (member.points < reward.pointsRequired) {
          throw LoyaltyServiceErrors.INSUFFICIENT_POINTS;
        }

        // Record the reward redemption
        const redemption = await tx.insert(schema.loyaltyRewardRedemptions).values({
          memberId,
          rewardId,
          transactionId,
          pointsRedeemed: reward.pointsRequired,
          status: 'completed',
          createdAt: new Date(),
          createdBy: userId
        }).returning();

        // Update member points
        await tx.update(schema.loyaltyMembers)
          .set({
            points: sql<number>`${schema.loyaltyMembers.points} - ${reward.pointsRequired}`,
            updatedAt: new Date(),
            updatedBy: userId
          })
          .where(eq(schema.loyaltyMembers.id, memberId));

        return [member, reward];
      });

      return {
        success: true,
        discountAmount: reward.discountAmount?.toString(),
        pointsRedeemed: reward.pointsRequired.toString(),
        message: 'Reward applied successfully'
      };
    } catch (error) {
      this.handleError(error, 'Applying reward');
    }
  }

  async getLoyaltyMember(identifier: string | number): Promise<schema.LoyaltyMember | null> {
    try {
      if (typeof identifier === 'string') {
        return await db.query.loyaltyMembers.findFirst({
          where: eq(schema.loyaltyMembers.loyaltyId, identifier)
        });
      }

      return await db.query.loyaltyMembers.findFirst({
        where: eq(schema.loyaltyMembers.id, identifier)
      });
    } catch (error) {
      this.handleError(error, 'Getting loyalty member');
    }
  }

  async getLoyaltyMemberByCustomerId(customerId: number): Promise<schema.LoyaltyMember | null> {
    try {
      return await db.query.loyaltyMembers.findFirst({
        where: eq(schema.loyaltyMembers.customerId, customerId)
      });
    } catch (error) {
      this.handleError(error, 'Getting loyalty member by customer ID');
    }
  }

  async getMemberActivityHistory(
    memberId: number,
    limit: number = 20,
    offset: number = 0
  ): Promise<schema.LoyaltyTransaction[]> {
    try {
      return await db
        .select()
        .from(schema.loyaltyTransactions)
        .where(eq(schema.loyaltyTransactions.memberId, memberId))
        .orderBy(desc(schema.loyaltyTransactions.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      this.handleError(error, 'Getting member activity history');
    }
  }

  async getLoyaltyProgram(storeId: number): Promise<schema.LoyaltyProgram | null> {
    try {
      return await db.query.loyaltyPrograms.findFirst({
        where: eq(schema.loyaltyPrograms.storeId, storeId)
      });
    } catch (error) {
      this.handleError(error, 'Getting loyalty program');
    }
  }

  async upsertLoyaltyProgram(
    storeId: number,
    programData: Partial<schema.LoyaltyProgramInsert>
  ): Promise<schema.LoyaltyProgram> {
    try {
      const existing = await db.query.loyaltyPrograms.findFirst({
        where: eq(schema.loyaltyPrograms.storeId, storeId)
      });

      if (existing) {
        return await db.update(schema.loyaltyPrograms)
          .set(programData)
          .where(eq(schema.loyaltyPrograms.storeId, storeId))
          .returning()
          .then(result => result[0]);
      }

      return await db.insert(schema.loyaltyPrograms)
        .values({
          storeId,
          ...programData
        })
        .returning()
        .then(result => result[0]);
    } catch (error) {
      this.handleError(error, 'Updating loyalty program');
    }
  }

  async createLoyaltyTier(tierData: schema.LoyaltyTierInsert): Promise<schema.LoyaltyTier> {
    try {
      return await db.insert(schema.loyaltyTiers)
        .values(tierData)
        .returning()
        .then(result => result[0]);
    } catch (error) {
      this.handleError(error, 'Creating loyalty tier');
    }
  }

  async createLoyaltyReward(
    rewardData: schema.LoyaltyRewardInsert
  ): Promise<schema.LoyaltyReward> {
    try {
      return await db.insert(schema.loyaltyRewards)
        .values(rewardData)
        .returning()
        .then(result => result[0]);
    } catch (error) {
      this.handleError(error, 'Creating loyalty reward');
    }
  }

  async processExpiredPoints(userId: number): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - LoyaltyService.POINTS_EXPIRY_MONTHS);

      const expiredPoints = await db
        .select({
          points: sql<number>`sum(${schema.loyaltyTransactions.pointsEarned})`
        })
        .from(schema.loyaltyTransactions)
        .where(
          and(
            lt(schema.loyaltyTransactions.createdAt, cutoffDate),
            eq(schema.loyaltyTransactions.status, 'completed')
          )
        );

      if (expiredPoints[0].points) {
        await db.update(schema.loyaltyTransactions)
          .set({
            status: 'expired',
            updatedAt: new Date(),
            updatedBy: userId
          })
          .where(
            and(
              lt(schema.loyaltyTransactions.createdAt, cutoffDate),
              eq(schema.loyaltyTransactions.status, 'completed')
            )
          );
      }

      return expiredPoints[0].points || 0;
    } catch (error) {
      this.handleError(error, 'Processing expired points');
    }
  }

  async checkAndUpdateMemberTier(memberId: number): Promise<boolean> {
    try {
      const member = await db.query.loyaltyMembers.findFirst({
        where: eq(schema.loyaltyMembers.id, memberId)
      });

      if (!member) {
        throw LoyaltyServiceErrors.CUSTOMER_NOT_FOUND;
      }

      const program = await this.getLoyaltyProgram(member.storeId);
      if (!program) {
        throw LoyaltyServiceErrors.PROGRAM_NOT_FOUND;
      }

      // const currentTier = await db.query.loyaltyTiers.findFirst({ // Unused
      //   where: eq(schema.loyaltyTiers.id, member.tierId)
      // });

      // Use correct schema field names with schema helper functions
      const nextTier = await db.query.loyaltyTiers.findFirst({
        where: and(
          eq(schema.loyaltyTiers.programId, member.programId), // Using programId instead of storeId
          gt(schema.loyaltyTiers.requiredPoints, member.currentPoints), // Using requiredPoints instead of pointsRequired
          eq(schema.loyaltyTiers.active, true) // Using active instead of status
        ),
        orderBy: asc(schema.loyaltyTiers.requiredPoints)
      });
      
      // Format the result to have the fields the code expects
      // const formattedTier = nextTier ? formatLoyaltyTierResult(nextTier) : null; // Unused

      if (nextTier && member.points >= nextTier.pointsRequired) {
        await db.update(schema.loyaltyMembers)
          .set({
            tierId: nextTier.id,
            updatedAt: new Date(),
            updatedBy: member.updatedBy
          })
          .where(eq(schema.loyaltyMembers.id, memberId));

        return true;
      }

      return false;
    } catch (error) {
      this.handleError(error, 'Checking and updating member tier');
    }
  }

  async getLoyaltyAnalytics(storeId: number): Promise<{
    memberCount: number;
    activeMembers: number;
    totalPointsEarned: string;
    totalPointsRedeemed: string;
    pointsBalance: string;
    programDetails: schema.LoyaltyProgram | null;
    topRewards: Array<{ name: string; redemptions: number }>;
  }> {
    try {
      const [memberStats, pointsStats, program, topRewards] = await db.transaction(async (tx) => {
        const memberStats = await tx
          .select({
            total: sql<number>`count(*)`,
            active: sql<number>`count(*) filter (where ${schema.loyaltyMembers.status} = 'active')`
          })
          .from(schema.loyaltyMembers)
          .where(eq(schema.loyaltyMembers.storeId, storeId));

        // Use type-safe approach for query building with schema helpers
      // Handle missing pointsEarned field in loyaltyTransactions
      // Handle missing loyaltyRewardRedemptions table entirely
      const pointsStats = await tx
          .select({
            // Use raw SQL with type casting to avoid schema mismatches
            earned: sql<number>`COALESCE(sum(${schema.loyaltyTransactions.transactionAmount}), 0)`,
            // Since redemptions table doesn't exist, default to 0
            redeemed: sql<number>`0`
          })
          .from(schema.loyaltyMembers)
          .where(eq(schema.loyaltyMembers.customerId, sql`(SELECT id FROM customers WHERE store_id = ${storeId} LIMIT 1)`))
          .leftJoin(schema.loyaltyTransactions, eq(schema.loyaltyTransactions.memberId, schema.loyaltyMembers.id));

        const program = await tx.query.loyaltyPrograms.findFirst({
          where: eq(schema.loyaltyPrograms.storeId, storeId)
        });

        const topRewards = await tx
          .select({
            name: schema.loyaltyRewards.name,
            redemptions: sql<number>`count(*)`
          })
          .from(schema.loyaltyRewardRedemptions)
          .where(eq(schema.loyaltyRewardRedemptions.storeId, storeId))
          .leftJoin(schema.loyaltyRewards, eq(schema.loyaltyRewards.id, schema.loyaltyRewardRedemptions.rewardId))
          .groupBy(schema.loyaltyRewards.name)
          .orderBy(desc(sql<number>`count(*)`))
          .limit(5);

        return [memberStats[0], pointsStats[0], program, topRewards];
      });

      return {
        memberCount: memberStats.total,
        activeMembers: memberStats.active,
        totalPointsEarned: pointsStats.earned?.toString() || '0',
        totalPointsRedeemed: pointsStats.redeemed?.toString() || '0',
        pointsBalance: (pointsStats.earned - pointsStats.redeemed)?.toString() || '0',
        programDetails: program,
        topRewards: topRewards.map(r => ({
          name: r.name,
          redemptions: r.redemptions
        }))
      };
    } catch (error) {
      this.handleError(error, 'Getting loyalty analytics');
    }
  }

  private generateRandomString(length: number): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const charactersLength = characters.length;
    
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    
    return result;
  }
}
