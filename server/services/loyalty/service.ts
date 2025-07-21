/* server/services/loyalty/service.ts */
import { EnhancedBaseService } from '../base/enhanced-service';
import { LoyaltyTier } from './types';
import {
  ILoyaltyService,
  LoyaltyProgramNotFoundError,
  LoyaltyMemberNotFoundError,
  MemberAlreadyEnrolledError,
  InsufficientPointsError,
  RewardNotFoundError,
  LoyaltyProgram,
  LoyaltyProgramInsert,
  LoyaltyMember,
  LoyaltyTierInsert,
  LoyaltyRewardInsert,
  LoyaltyReward,
  LoyaltyTransaction,
} from './types';
import db from '@server/database';
import * as schema from '@shared/schema';
import { eq, and, lte, lt, gt, desc, asc, sql } from 'drizzle-orm';

export class LoyaltyService extends EnhancedBaseService implements ILoyaltyService {
  /* ------------------------------------------------------------------ *
   *  Utilities                                                          *
   * ------------------------------------------------------------------ */
  private random(n = 5): string {
    return Math.random().toString(36).substring(2, 2 + n).toUpperCase();
  }

  /* ------------------------------------------------------------------ *
   *  Core Public API                                                    *
   * ------------------------------------------------------------------ */

  /************* Loyalty IDs *************/
  async generateLoyaltyId(): Promise<string> {
    try {
      const prefix = 'LOY-';
      let id = prefix + this.random();
      // Ensure uniqueness
      while (
        await db.query.loyaltyMembers.findFirst({
          where: eq(schema.loyaltyMembers.loyaltyId, id),
        })
      ) {
        id = prefix + this.random();
      }
      return id;
    } catch (e) {
      this.handleError(e, 'generateLoyaltyId');
    }
  }

  /************* Enrolment *************/
  async enrollCustomer(
    customerId: number,
    storeId: number,
    userId: number
  ): Promise<LoyaltyMember> {
    try {
      const program = await this.getLoyaltyProgram(storeId);
      if (!program) throw new LoyaltyProgramNotFoundError(storeId);

      // One member per customer per program
      const exists = await db.query.loyaltyMembers.findFirst({
        where: eq(schema.loyaltyMembers.customerId, customerId),
      });
      if (exists) throw new MemberAlreadyEnrolledError(customerId, program.id);

      const loyaltyId = await this.generateLoyaltyId();
      const [member] = await db
        .insert(schema.loyaltyMembers)
        .values({
          customerId,
          loyaltyId,
          currentPoints: '0',
          totalPointsEarned: '0',
          totalPointsRedeemed: '0',
          tierId: null,
        })
        .returning();
      return member;
    } catch (e) {
      this.handleError(e, 'enrollCustomer');
    }
  }

  /************* Points Calculation *************/
  async calculatePointsForTransaction(
    subtotal: string | number,
    storeId: number
  ): Promise<number> {
    try {
      const program = await this.getLoyaltyProgram(storeId);
      if (!program) throw new LoyaltyProgramNotFoundError(storeId);

      const amount = typeof subtotal === 'string' ? parseFloat(subtotal) : subtotal;
      // pointsPerAmount = “X points per 1 currency unit”
      const rate = Number(program.pointsPerAmount);
      return Math.floor(amount * rate);
    } catch (e) {
      this.handleError(e, 'calculatePointsForTransaction');
    }
  }

  /************* Add / Earn Points *************/
  async addPoints(
    memberId: number,
    points: number,
    source: string,
    transactionId: number | undefined,
    userId: number
  ): Promise<{ success: boolean; transaction?: LoyaltyTransaction }> {
    try {
      const member = await db.query.loyaltyMembers.findFirst({
        where: eq(schema.loyaltyMembers.id, memberId),
      });
      if (!member) throw new LoyaltyMemberNotFoundError(memberId);

      const [txRow] = await db
        .insert(schema.loyaltyTransactions)
        .values({
          memberId,
          transactionId,
          type: 'earn',
          points,
          createdBy: userId,
        })
        .returning();

      // Update running totals
      await db
        .update(schema.loyaltyMembers)
        .set({
          currentPoints: sql`${schema.loyaltyMembers.currentPoints} + ${points}`,
          totalPointsEarned: sql`${schema.loyaltyMembers.totalPointsEarned} + ${points}`,
        })
        .where(eq(schema.loyaltyMembers.id, memberId));

      return { success: true, transaction: txRow };
    } catch (e) {
      this.handleError(e, 'addPoints');
    }
  }

  /************* Available Rewards *************/
  async getAvailableRewards(memberId: number): Promise<LoyaltyReward[]> {
    try {
      const member = await db.query.loyaltyMembers.findFirst({
        where: eq(schema.loyaltyMembers.id, memberId),
      });
      if (!member) throw new LoyaltyMemberNotFoundError(memberId);

      return db
        .select()
        .from(schema.loyaltyRewards)
        .where(
          and(
            lte(schema.loyaltyRewards.pointsCost, member.currentPoints),
            eq(schema.loyaltyRewards.active, true)
          )
        )
        .orderBy(asc(schema.loyaltyRewards.pointsCost));
    } catch (e) {
      this.handleError(e, 'getAvailableRewards');
    }
  }

  /************* Redeem Reward *************/
  async applyReward(
    memberId: number,
    rewardId: number,
    currentTotal: number
  ): Promise<{
    success: boolean;
    newTotal?: number;
    pointsRedeemed?: string;
    message?: string;
  }> {
    try {
      return await db.transaction(async (trx: any) => {
        const member = await trx.query.loyaltyMembers.findFirst({
          where: eq(schema.loyaltyMembers.id, memberId),
        });
        if (!member) throw new LoyaltyMemberNotFoundError(memberId);

        const reward = await trx.query.loyaltyRewards.findFirst({
          where: eq(schema.loyaltyRewards.id, rewardId),
        });
        if (!reward) throw new RewardNotFoundError(rewardId);

        const cost = Number(reward.pointsCost);
        const balance = Number(member.currentPoints);
        if (balance < cost) throw new InsufficientPointsError(memberId, cost);

        // Record redemption
        await trx.insert(schema.loyaltyTransactions).values({
          memberId,
          createdBy: 0,
          rewardId,
          type: 'redeem',
          points: cost,
        });

        // Deduct points
        await trx
          .update(schema.loyaltyMembers)
          .set({
            currentPoints: String(balance - cost),
            totalPointsRedeemed: sql`${schema.loyaltyMembers.totalPointsRedeemed} + ${cost}`,
          })
          .where(eq(schema.loyaltyMembers.id, memberId));

        const newTotal = currentTotal - (reward.discountValue ? Number(reward.discountValue) : 0);

        return {
          success: true,
          newTotal,
          pointsRedeemed: reward.pointsCost,
          message: 'Reward applied',
        };
      });
    } catch (e) {
      this.handleError(e, 'applyReward');
    }
  }

  /************* Look-ups *************/
  async getLoyaltyMember(identifier: string | number): Promise<LoyaltyMember | null> {
    return typeof identifier === 'string'
      ? db.query.loyaltyMembers.findFirst({
          where: eq(schema.loyaltyMembers.loyaltyId, identifier),
        })
      : db.query.loyaltyMembers.findFirst({ where: eq(schema.loyaltyMembers.id, identifier) });
  }

  async getLoyaltyMemberByCustomerId(customerId: number): Promise<LoyaltyMember | null> {
    return db.query.loyaltyMembers.findFirst({ where: eq(schema.loyaltyMembers.customerId, customerId) });
  }

  async getLoyaltyProgram(storeId: number): Promise<LoyaltyProgram | null> {
    return db.query.loyaltyPrograms.findFirst({ where: eq(schema.loyaltyPrograms.storeId, storeId) });
  }

  /* ------------------------------------------------------------------ *
   *  Place-holders for remaining interface methods                      *
   *  (Implement as needed in Phase 2+)                                  *
   * ------------------------------------------------------------------ */

  async getMemberActivityHistory(
    memberId: number,
    limit: number = 20,
    offset: number = 0
  ): Promise<LoyaltyTransaction[]> {
    try {
      return db
        .select()
        .from(schema.loyaltyTransactions)
        .where(eq(schema.loyaltyTransactions.memberId, memberId))
        .orderBy(desc(schema.loyaltyTransactions.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (e) {
      this.handleError(e, 'getMemberActivityHistory');
    }
  }
  async upsertLoyaltyProgram(storeId: number, programData: Partial<LoyaltyProgramInsert>): Promise<LoyaltyProgram> {
    try {
      const existing = await db.query.loyaltyPrograms.findFirst({
        where: eq(schema.loyaltyPrograms.storeId, storeId),
      });
      if (existing) {
        const [updated] = await db
          .update(schema.loyaltyPrograms)
          .set(programData)
          .where(eq(schema.loyaltyPrograms.id, existing.id))
          .returning();
        return updated;
      }
      const [created] = await db
        .insert(schema.loyaltyPrograms)
        .values({ storeId, ...programData })
        .returning();
      return created;
    } catch (e) {
      this.handleError(e, 'upsertLoyaltyProgram');
    }
  }
  async createLoyaltyTier(tierData: LoyaltyTierInsert): Promise<LoyaltyTier> {
    try {
      // ensure parent program exists
      const program = await db.query.loyaltyPrograms.findFirst({
        where: eq(schema.loyaltyPrograms.id, tierData.programId),
      });
      if (!program) throw new LoyaltyProgramNotFoundError(tierData.programId);
      const [tier] = await db.insert(schema.loyaltyTiers).values(tierData).returning();
      return tier;
    } catch (e) {
      this.handleError(e, 'createLoyaltyTier');
    }
  }
  async createLoyaltyReward(rewardData: LoyaltyRewardInsert): Promise<LoyaltyReward> {
    try {
      // verify program exists
      const program = await db.query.loyaltyPrograms.findFirst({
        where: eq(schema.loyaltyPrograms.id, rewardData.programId),
      });
      if (!program) throw new LoyaltyProgramNotFoundError(rewardData.programId);
      const [reward] = await db.insert(schema.loyaltyRewards).values(rewardData).returning();
      return reward;
    } catch (e) {
      this.handleError(e, 'createLoyaltyReward');
    }
  }
  async processExpiredPoints(): Promise<number> {
    try {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - 12);

      // Sum points older than cutoff & still active
      const [{ expired = '0' }] = await db
        .select({ expired: sql<number>`COALESCE(sum(${schema.loyaltyTransactions.pointsEarned}),0)` })
        .from(schema.loyaltyTransactions)
        .where(
          and(
            eq(schema.loyaltyTransactions.transactionType, 'earn'),
            lt(schema.loyaltyTransactions.createdAt, cutoff)
          )
        );
      const totalExpired = Number(expired);
      if (totalExpired === 0) return 0;

      // Mark those txns as expired and create balancing negative transactions
      await db.transaction(async (trx: any) => {
        // flag existing as expired type
        await trx
          .update(schema.loyaltyTransactions)
          .set({ transactionType: 'expire' })
          .where(
            and(
              eq(schema.loyaltyTransactions.transactionType, 'earn'),
              lt(schema.loyaltyTransactions.createdAt, cutoff)
            )
          );

        // deduct from member balances
        await trx.execute(sql`
          UPDATE loyalty_members m
          SET current_points = current_points - exp.expired
          FROM (
            SELECT member_id, sum(points) AS expired
            FROM loyalty_transactions
            WHERE type = 'expire'
            GROUP BY member_id
          ) exp
          WHERE m.id = exp.member_id;
        `);
      });
      return totalExpired;
    } catch (e) {
      this.handleError(e, 'processExpiredPoints');
    }
  }
  async checkAndUpdateMemberTier(memberId: number): Promise<boolean> {
    try {
      const member = await db.query.loyaltyMembers.findFirst({
        where: eq(schema.loyaltyMembers.id, memberId),
      });
      if (!member) throw new LoyaltyMemberNotFoundError(memberId);
      if (!member.tierId) {
        // pick lowest tier initially
        const next = await db.query.loyaltyTiers.findFirst({
          where: eq(schema.loyaltyTiers.active, true),
          orderBy: asc(schema.loyaltyTiers.requiredPoints),
        });
        if (next) {
          await db
            .update(schema.loyaltyMembers)
            .set({ tierId: next.id })
            .where(eq(schema.loyaltyMembers.id, memberId));
          return true;
        }
        // no tiers defined
        return false;
      }
      // member already has a tier – check if they qualify for a higher one
      const points = String(member.totalPointsEarned);
      const best = await db.query.loyaltyTiers.findFirst({
        where: and(
          lte(schema.loyaltyTiers.requiredPoints, points),
          eq(schema.loyaltyTiers.active, true)
        ),
        orderBy: desc(schema.loyaltyTiers.requiredPoints),
      });
      if (best && best.id !== member.tierId) {
        await db
          .update(schema.loyaltyMembers)
          .set({ tierId: best.id })
          .where(eq(schema.loyaltyMembers.id, memberId));
        return true;
      }
      return false;
    } catch (e) {
      this.handleError(e, 'checkAndUpdateMemberTier');
    }
  }

  async getLoyaltyAnalytics(storeId: number): Promise<{ totalMembers: number; totalPointsEarned: number; totalPointsRedeemed: number }> {
    try {
      const [{ members = '0' }] = await db
        .select({ members: sql<number>`count(*)` })
        .from(schema.loyaltyMembers);

      const [{ earned = '0', redeemed = '0' }] = await db
        .select({
          earned: sql<number>`COALESCE(sum(points_earned) filter (where transaction_type='earn'),0)`,
          redeemed: sql<number>`COALESCE(sum(points_redeemed) filter (where transaction_type='redeem'),0)`,
        })
        .from(schema.loyaltyTransactions)
        .leftJoin(schema.loyaltyMembers, eq(schema.loyaltyMembers.id, schema.loyaltyTransactions.memberId));

      return {
        totalMembers: Number(members),
        totalPointsEarned: Number(earned),
        totalPointsRedeemed: Number(redeemed),
      };
    } catch (e) {
      this.handleError(e, 'getLoyaltyAnalytics');
    }
  }
}
