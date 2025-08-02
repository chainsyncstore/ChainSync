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
const __importDefault = (this && this.__importDefault) || function(mod) {
  return (mod && mod.__esModule) ? mod : { 'default': mod };
};
Object.defineProperty(exports, '__esModule', { value: true });
exports.LoyaltyService = void 0;
/* server/services/loyalty/service.ts */
const enhanced_service_1 = require('../base/enhanced-service');
const types_1 = require('./types');
const database_1 = __importDefault(require('@server/database'));
const schema = __importStar(require('@shared/schema'));
const drizzle_orm_1 = require('drizzle-orm');
class LoyaltyService extends enhanced_service_1.EnhancedBaseService {
  /* ------------------------------------------------------------------ *
     *  Utilities                                                          *
     * ------------------------------------------------------------------ */
  random(n = 5) {
    return Math.random().toString(36).substring(2, 2 + n).toUpperCase();
  }
  /* ------------------------------------------------------------------ *
     *  Core Public API                                                    *
     * ------------------------------------------------------------------ */
  /** *********** Loyalty IDs *************/
  async generateLoyaltyId() {
    try {
      const prefix = 'LOY-';
      let id = prefix + this.random();
      // Ensure uniqueness
      while (await database_1.default.query.loyaltyMembers.findFirst({
        where: (0, drizzle_orm_1.eq)(schema.loyaltyMembers.loyaltyId, id)
      })) {
        id = prefix + this.random();
      }
      return id;
    }
    catch (e) {
      this.handleError(e, 'generateLoyaltyId');
    }
  }
  /** *********** Enrolment *************/
  async enrollCustomer(customerId, storeId, userId) {
    try {
      const program = await this.getLoyaltyProgram(storeId);
      if (!program)
        throw new types_1.LoyaltyProgramNotFoundError(storeId);
      // One member per customer per program
      const exists = await database_1.default.query.loyaltyMembers.findFirst({
        where: (0, drizzle_orm_1.eq)(schema.loyaltyMembers.customerId, customerId)
      });
      if (exists)
        throw new types_1.MemberAlreadyEnrolledError(customerId, program.id);
      const loyaltyId = await this.generateLoyaltyId();
      const [member] = await database_1.default
        .insert(schema.loyaltyMembers)
        .values({
          customerId,
          loyaltyId,
          currentPoints: '0',
          totalPointsEarned: '0',
          totalPointsRedeemed: '0',
          tierId: null
        })
        .returning();
      return member;
    }
    catch (e) {
      this.handleError(e, 'enrollCustomer');
    }
  }
  /** *********** Points Calculation *************/
  async calculatePointsForTransaction(subtotal, storeId) {
    try {
      const program = await this.getLoyaltyProgram(storeId);
      if (!program)
        throw new types_1.LoyaltyProgramNotFoundError(storeId);
      const amount = typeof subtotal === 'string' ? parseFloat(subtotal) : subtotal;
      // pointsPerAmount = “X points per 1 currency unit”
      const rate = 1; // Placeholder: Implement points calculation logic based on program rules
      return Math.floor(amount * rate);
    }
    catch (e) {
      this.handleError(e, 'calculatePointsForTransaction');
    }
  }
  /** *********** Add / Earn Points *************/
  async addPoints(memberId, points, source, transactionId, userId) {
    try {
      const member = await database_1.default.query.loyaltyMembers.findFirst({
        where: (0, drizzle_orm_1.eq)(schema.loyaltyMembers.id, memberId)
      });
      if (!member)
        throw new types_1.LoyaltyMemberNotFoundError(memberId);
      const [txRow] = await database_1.default
        .insert(schema.loyaltyTransactions)
        .values({
          memberId,
          transactionId,
          type: 'earn',
          points,
          createdBy: userId
        })
        .returning();
      // Update running totals
      await database_1.default
        .update(schema.loyaltyMembers)
        .set({
          currentPoints: (0, drizzle_orm_1.sql) `${schema.loyaltyMembers.currentPoints} + ${points}`,
          points: (0, drizzle_orm_1.sql) `${schema.loyaltyMembers.points} + ${points}`
        })
        .where((0, drizzle_orm_1.eq)(schema.loyaltyMembers.id, memberId));
      return { success: true, transaction: txRow };
    }
    catch (e) {
      this.handleError(e, 'addPoints');
    }
  }
  /** *********** Available Rewards *************/
  async getAvailableRewards(memberId) {
    try {
      const member = await database_1.default.query.loyaltyMembers.findFirst({
        where: (0, drizzle_orm_1.eq)(schema.loyaltyMembers.id, memberId)
      });
      if (!member)
        throw new types_1.LoyaltyMemberNotFoundError(memberId);
      return database_1.default
        .select()
        .from(schema.loyaltyRewards)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.lte)(schema.loyaltyRewards.pointsRequired, Number(member.currentPoints)), (0, drizzle_orm_1.eq)(schema.loyaltyRewards.active, true)))
        .orderBy((0, drizzle_orm_1.asc)(schema.loyaltyRewards.pointsRequired));
    }
    catch (e) {
      this.handleError(e, 'getAvailableRewards');
    }
  }
  /** *********** Redeem Reward *************/
  async applyReward(memberId, rewardId, currentTotal) {
    try {
      return await database_1.default.transaction(async(trx) => {
        const member = await trx.query.loyaltyMembers.findFirst({
          where: (0, drizzle_orm_1.eq)(schema.loyaltyMembers.id, memberId)
        });
        if (!member)
          throw new types_1.LoyaltyMemberNotFoundError(memberId);
        const reward = await trx.query.loyaltyRewards.findFirst({
          where: (0, drizzle_orm_1.eq)(schema.loyaltyRewards.id, rewardId)
        });
        if (!reward)
          throw new types_1.RewardNotFoundError(rewardId);
        const cost = Number(reward.pointsRequired);
        const balance = Number(member.currentPoints);
        if (balance < cost)
          throw new types_1.InsufficientPointsError(memberId, cost);
        // Record redemption
        await trx.insert(schema.loyaltyTransactions).values({
          memberId,
          createdBy: 0,
          rewardId,
          type: 'redeem',
          points: cost
        });
        // Deduct points
        await trx
          .update(schema.loyaltyMembers)
          .set({
            currentPoints: String(balance - cost)
          })
          .where((0, drizzle_orm_1.eq)(schema.loyaltyMembers.id, memberId));
        const newTotal = currentTotal; // Placeholder for discount logic
        return {
          success: true,
          newTotal,
          pointsRedeemed: String(cost),
          message: 'Reward applied'
        };
      });
    }
    catch (e) {
      this.handleError(e, 'applyReward');
    }
  }
  /** *********** Look-ups *************/
  async getLoyaltyMember(identifier) {
    return typeof identifier === 'string'
      ? database_1.default.query.loyaltyMembers.findFirst({
        where: (0, drizzle_orm_1.eq)(schema.loyaltyMembers.loyaltyId, identifier)
      })
      : database_1.default.query.loyaltyMembers.findFirst({ where: (0, drizzle_orm_1.eq)(schema.loyaltyMembers.id, identifier) });
  }
  async getLoyaltyMemberByCustomerId(customerId) {
    return database_1.default.query.loyaltyMembers.findFirst({ where: (0, drizzle_orm_1.eq)(schema.loyaltyMembers.customerId, customerId) });
  }
  async getLoyaltyProgram(storeId) {
    return database_1.default.query.loyaltyPrograms.findFirst({ where: (0, drizzle_orm_1.eq)(schema.loyaltyPrograms.storeId, storeId) });
  }
  /* ------------------------------------------------------------------ *
     *  Place-holders for remaining interface methods                      *
     *  (Implement as needed in Phase 2+)                                  *
     * ------------------------------------------------------------------ */
  async getMemberActivityHistory(memberId, limit = 20, offset = 0) {
    try {
      return database_1.default
        .select()
        .from(schema.loyaltyTransactions)
        .where((0, drizzle_orm_1.eq)(schema.loyaltyTransactions.memberId, memberId))
        .orderBy((0, drizzle_orm_1.desc)(schema.loyaltyTransactions.createdAt))
        .limit(limit)
        .offset(offset);
    }
    catch (e) {
      this.handleError(e, 'getMemberActivityHistory');
    }
  }
  async upsertLoyaltyProgram(storeId, programData) {
    try {
      const existing = await database_1.default.query.loyaltyPrograms.findFirst({
        where: (0, drizzle_orm_1.eq)(schema.loyaltyPrograms.storeId, storeId)
      });
      if (existing) {
        const [updated] = await database_1.default
          .update(schema.loyaltyPrograms)
          .set(programData)
          .where((0, drizzle_orm_1.eq)(schema.loyaltyPrograms.id, existing.id))
          .returning();
        return updated;
      }
      const [created] = await database_1.default
        .insert(schema.loyaltyPrograms)
        .values({ storeId, ...programData })
        .returning();
      return created;
    }
    catch (e) {
      this.handleError(e, 'upsertLoyaltyProgram');
    }
  }
  async createLoyaltyTier(tierData) {
    try {
      // ensure parent program exists
      const program = await database_1.default.query.loyaltyPrograms.findFirst({
        where: (0, drizzle_orm_1.eq)(schema.loyaltyPrograms.id, tierData.programId)
      });
      if (!program)
        throw new types_1.LoyaltyProgramNotFoundError(tierData.programId);
      const [tier] = await database_1.default.insert(schema.loyaltyTiers).values(tierData).returning();
      return tier;
    }
    catch (e) {
      this.handleError(e, 'createLoyaltyTier');
    }
  }
  async createLoyaltyReward(rewardData) {
    try {
      // verify program exists
      const program = await database_1.default.query.loyaltyPrograms.findFirst({
        where: (0, drizzle_orm_1.eq)(schema.loyaltyPrograms.id, rewardData.programId)
      });
      if (!program)
        throw new types_1.LoyaltyProgramNotFoundError(rewardData.programId);
      const [reward] = await database_1.default.insert(schema.loyaltyRewards).values(rewardData).returning();
      return reward;
    }
    catch (e) {
      this.handleError(e, 'createLoyaltyReward');
    }
  }
  async processExpiredPoints() {
    try {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - 12);
      // Sum points older than cutoff & still active
      const [{ expired = '0' }] = await database_1.default
        .select({ expired: (0, drizzle_orm_1.sql) `COALESCE(sum(${schema.loyaltyTransactions.pointsEarned}),0)` })
        .from(schema.loyaltyTransactions)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.loyaltyTransactions.transactionType, 'earn'), (0, drizzle_orm_1.lt)(schema.loyaltyTransactions.createdAt, cutoff)));
      const totalExpired = Number(expired);
      if (totalExpired === 0)
        return 0;
      // Mark those txns as expired and create balancing negative transactions
      await database_1.default.transaction(async(trx) => {
        // flag existing as expired type
        await trx
          .update(schema.loyaltyTransactions)
          .set({ transactionType: 'expire' })
          .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.loyaltyTransactions.transactionType, 'earn'), (0, drizzle_orm_1.lt)(schema.loyaltyTransactions.createdAt, cutoff)));
        // deduct from member balances
        await trx.execute((0, drizzle_orm_1.sql) `
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
    }
    catch (e) {
      this.handleError(e, 'processExpiredPoints');
    }
  }
  async checkAndUpdateMemberTier(memberId) {
    try {
      const member = await database_1.default.query.loyaltyMembers.findFirst({
        where: (0, drizzle_orm_1.eq)(schema.loyaltyMembers.id, memberId)
      });
      if (!member)
        throw new types_1.LoyaltyMemberNotFoundError(memberId);
      if (!member.tierId) {
        // pick lowest tier initially
        const next = await database_1.default.query.loyaltyTiers.findFirst({
          where: (0, drizzle_orm_1.eq)(schema.loyaltyTiers.active, true),
          orderBy: (0, drizzle_orm_1.asc)(schema.loyaltyTiers.requiredPoints)
        });
        if (next) {
          await database_1.default
            .update(schema.loyaltyMembers)
            .set({ tierId: next.id })
            .where((0, drizzle_orm_1.eq)(schema.loyaltyMembers.id, memberId));
          return true;
        }
        // no tiers defined
        return false;
      }
      // member already has a tier – check if they qualify for a higher one
      const points = Number(member.points);
      const best = await database_1.default.query.loyaltyTiers.findFirst({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.lte)(schema.loyaltyTiers.requiredPoints, points), (0, drizzle_orm_1.eq)(schema.loyaltyTiers.active, true)),
        orderBy: (0, drizzle_orm_1.desc)(schema.loyaltyTiers.requiredPoints)
      });
      if (best && best.id !== member.tierId) {
        await database_1.default
          .update(schema.loyaltyMembers)
          .set({ tierId: best.id })
          .where((0, drizzle_orm_1.eq)(schema.loyaltyMembers.id, memberId));
        return true;
      }
      return false;
    }
    catch (e) {
      this.handleError(e, 'checkAndUpdateMemberTier');
    }
  }
  async getLoyaltyAnalytics(storeId) {
    try {
      const [{ members = '0' }] = await database_1.default
        .select({ members: (0, drizzle_orm_1.sql) `count(*)` })
        .from(schema.loyaltyMembers);
      const [{ earned = '0', redeemed = '0' }] = await database_1.default
        .select({
          earned: (0, drizzle_orm_1.sql) `COALESCE(sum(points_earned) filter (where transaction_type='earn'),0)`,
          redeemed: (0, drizzle_orm_1.sql) `COALESCE(sum(points_redeemed) filter (where transaction_type='redeem'),0)`
        })
        .from(schema.loyaltyTransactions)
        .leftJoin(schema.loyaltyMembers, (0, drizzle_orm_1.eq)(schema.loyaltyMembers.id, schema.loyaltyTransactions.memberId));
      return {
        totalMembers: Number(members),
        totalPointsEarned: Number(earned),
        totalPointsRedeemed: Number(redeemed)
      };
    }
    catch (e) {
      this.handleError(e, 'getLoyaltyAnalytics');
    }
  }
}
exports.LoyaltyService = LoyaltyService;
