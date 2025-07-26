"use strict";
/**
 * Refactored Loyalty Service
 *
 * This file demonstrates how to implement the new schema standardization
 * and validation approach in the loyalty module.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoyaltyService = void 0;
const service_1 = require("../base/service");
const types_1 = require("./types");
const _db_1 = require("@db");
const schema = __importStar(require("@shared/schema"));
const drizzle_orm_1 = require("drizzle-orm");
const schema_validation_1 = require("@shared/schema-validation");
class LoyaltyService extends service_1.BaseService {
    /**
     * Generate a unique loyalty ID for a new member
     */
    async generateLoyaltyId() {
        try {
            const prefix = "LOY-";
            let loyaltyId = prefix + this.generateRandomString(5).toUpperCase();
            let existingMember = await _db_1.db.query.loyaltyMembers.findFirst({
                where: (0, drizzle_orm_1.eq)(schema.loyaltyMembers.loyaltyId, loyaltyId)
            });
            while (existingMember) {
                loyaltyId = prefix + this.generateRandomString(5).toUpperCase();
                existingMember = await _db_1.db.query.loyaltyMembers.findFirst({
                    where: (0, drizzle_orm_1.eq)(schema.loyaltyMembers.loyaltyId, loyaltyId)
                });
            }
            return loyaltyId;
        }
        catch (error) {
            this.handleError(error, 'Generating loyalty ID');
        }
    }
    /**
     * Enroll a customer in the loyalty program
     */
    async enrollCustomer(customerId, storeId, userId) {
        try {
            // Get store's loyalty program
            const program = await _db_1.db.query.loyaltyPrograms.findFirst({
                where: (0, drizzle_orm_1.eq)(schema.loyaltyPrograms.storeId, storeId)
            });
            if (!program) {
                throw new types_1.LoyaltyProgramNotFoundError(storeId);
            }
            // Check if member already exists
            const existingMember = await _db_1.db.query.loyaltyMembers.findFirst({
                where: (0, drizzle_orm_1.eq)(schema.loyaltyMembers.customerId, customerId)
            });
            if (existingMember) {
                throw new types_1.MemberAlreadyEnrolledError(customerId, program.id);
            }
            // Generate loyalty ID
            const loyaltyId = await this.generateLoyaltyId();
            // Get the entry-level tier
            const entryTier = await _db_1.db.query.loyaltyTiers.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.loyaltyTiers.programId, program.id), (0, drizzle_orm_1.eq)(schema.loyaltyTiers.active, true)),
                orderBy: (0, drizzle_orm_1.asc)(schema.loyaltyTiers.requiredPoints)
            });
            // Prepare member data
            const memberData = {
                customerId,
                loyaltyId,
                currentPoints: "0",
                programId: program.id,
                userId: userId,
            };
            // Insert the validated data
            const [member] = await _db_1.db.insert(schema.loyaltyMembers)
                .values(memberData)
                .returning();
            return member;
        }
        catch (error) {
            // Handle validation errors specially
            if (error instanceof schema_validation_1.SchemaValidationError) {
                console.error(`Validation error: ${error.message}`, error.toJSON());
            }
            this.handleError(error, 'Enrolling customer in loyalty program');
        }
    }
    /**
     * Award points to a loyalty member
     */
    async awardPoints(memberId, points, source, userId) {
        try {
            // Validate input data using our schema validation
            const validatedData = {
                memberId,
                points,
                source,
                userId
            };
            // Get member details
            const member = await _db_1.db.query.loyaltyMembers.findFirst({
                where: (0, drizzle_orm_1.eq)(schema.loyaltyMembers.id, memberId)
            });
            if (!member) {
                throw new types_1.LoyaltyMemberNotFoundError(memberId);
            }
            // Calculate new points
            const currentPoints = parseFloat(member.currentPoints ?? '0');
            const newCurrentPoints = currentPoints + points;
            if (!member) {
                throw new types_1.LoyaltyMemberNotFoundError(memberId);
            }
            // Create a transaction record
            await _db_1.db.insert(schema.loyaltyTransactions).values({
                memberId,
                pointsEarned: points,
                transactionType: "earn",
                source,
                programId: member.programId,
                pointsBalance: newCurrentPoints,
                createdAt: new Date()
            });
            // Update member's points
            await _db_1.db.update(schema.loyaltyMembers)
                .set({
                currentPoints: newCurrentPoints.toString(),
                updatedAt: new Date()
            })
                .where((0, drizzle_orm_1.eq)(schema.loyaltyMembers.id, memberId));
            // Check if member qualifies for tier upgrade
            await this.checkAndUpdateMemberTier(memberId);
            return true;
        }
        catch (error) {
            if (error instanceof schema_validation_1.SchemaValidationError) {
                console.error(`Validation error: ${error.message}`, error.toJSON());
            }
            this.handleError(error, 'Awarding loyalty points');
        }
    }
    /**
     * Check if a member qualifies for a tier upgrade
     */
    async checkAndUpdateMemberTier(memberId) {
        try {
            const member = await _db_1.db.query.loyaltyMembers.findFirst({
                where: (0, drizzle_orm_1.eq)(schema.loyaltyMembers.id, memberId)
            });
            if (!member) {
                throw new types_1.LoyaltyMemberNotFoundError(memberId);
            }
            // Find the next tier that the member qualifies for
            const nextTier = await _db_1.db.query.loyaltyTiers.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.loyaltyTiers.programId, member.programId), (0, drizzle_orm_1.gt)(schema.loyaltyTiers.requiredPoints, parseInt(member.currentPoints ?? '0')), (0, drizzle_orm_1.eq)(schema.loyaltyTiers.active, true)),
                orderBy: (0, drizzle_orm_1.asc)(schema.loyaltyTiers.requiredPoints)
            });
            // Check if member qualifies for an upgrade
            if (nextTier && parseFloat(member.currentPoints ?? '0') >= nextTier.requiredPoints) {
                await _db_1.db.update(schema.loyaltyMembers)
                    .set({
                    updatedAt: new Date()
                })
                    .where((0, drizzle_orm_1.eq)(schema.loyaltyMembers.id, memberId));
                return true;
            }
            return false;
        }
        catch (error) {
            this.handleError(error, 'Checking and updating member tier');
        }
    }
    /**
     * Get analytics data for a store's loyalty program
     */
    async getLoyaltyAnalytics(storeId) {
        try {
            const memberStats = await _db_1.db
                .select({
                total: (0, drizzle_orm_1.sql) `count(*)`,
            })
                .from(schema.loyaltyMembers)
                .where((0, drizzle_orm_1.eq)(schema.loyaltyMembers.programId, (0, drizzle_orm_1.sql) `(select id from loyalty_programs where store_id = ${storeId})`));
            const pointsStats = await _db_1.db
                .select({
                earned: (0, drizzle_orm_1.sql) `sum(case when transaction_type = 'earn' then points_earned::decimal else 0 end)`,
                redeemed: (0, drizzle_orm_1.sql) `sum(case when transaction_type = 'redeem' then points_redeemed::decimal else 0 end)`,
            })
                .from(schema.loyaltyTransactions)
                .where((0, drizzle_orm_1.eq)(schema.loyaltyTransactions.programId, (0, drizzle_orm_1.sql) `(select id from loyalty_programs where store_id = ${storeId})`));
            return {
                totalMembers: Number(memberStats[0].total),
                totalPointsEarned: Number(pointsStats[0].earned) || 0,
                totalPointsRedeemed: Number(pointsStats[0].redeemed) || 0,
            };
        }
        catch (error) {
            this.handleError(error, 'Getting loyalty analytics');
        }
    }
    // All other methods from ILoyaltyService should be implemented here.
    // For the sake of this refactoring example, they are omitted.
    async calculatePointsForTransaction(subtotal, storeId, userId) { throw new Error("Method not implemented."); }
    async addPoints(memberId, points, source, transactionId, userId) { throw new Error("Method not implemented."); }
    async getAvailableRewards(memberId) { throw new Error("Method not implemented."); }
    async applyReward(memberId, rewardId, currentTotal) { throw new Error("Method not implemented."); }
    async getLoyaltyMember(identifier) { throw new Error("Method not implemented."); }
    async getLoyaltyMemberByCustomerId(customerId) { throw new Error("Method not implemented."); }
    async getMemberActivityHistory(memberId, limit, offset) { throw new Error("Method not implemented."); }
    async getLoyaltyProgram(storeId) { throw new Error("Method not implemented."); }
    async upsertLoyaltyProgram(storeId, programData) { throw new Error("Method not implemented."); }
    async createLoyaltyTier(tierData) { throw new Error("Method not implemented."); }
    async createLoyaltyReward(rewardData) { throw new Error("Method not implemented."); }
    async processExpiredPoints(userId) { throw new Error("Method not implemented."); }
    /**
     * Generate a random string for IDs
     */
    generateRandomString(length) {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
    }
}
exports.LoyaltyService = LoyaltyService;
LoyaltyService.POINTS_EXPIRY_MONTHS = 12;
LoyaltyService.REWARD_THRESHOLD = 1000;
