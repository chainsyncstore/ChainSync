"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedLoyaltyService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const database_1 = __importDefault(require("../../database"));
const schema = __importStar(require("@shared/schema"));
const schema_validation_1 = require("@shared/schema-validation");
const enhanced_service_1 = require("../base/enhanced-service");
const types_1 = require("./types");
class EnhancedLoyaltyService extends enhanced_service_1.EnhancedBaseService {
    constructor() {
        super();
    }
    // Helper to get a store by ID
    async getStoreById(storeId) {
        return database_1.default.query.stores.findFirst({ where: (0, drizzle_orm_1.eq)(schema.stores.id, storeId) });
    }
    // Helper to get a user by ID
    async getUserById(userId) {
        return database_1.default.query.users.findFirst({ where: (0, drizzle_orm_1.eq)(schema.users.id, userId) });
    }
    async createProgram(params) {
        try {
            const store = await this.getStoreById(params.storeId);
            if (!store) {
                throw new types_1.LoyaltyProgramNotFoundError(0); // Placeholder, should be a StoreNotFoundError
            }
            const existing = await database_1.default.query.loyaltyPrograms.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.loyaltyPrograms.storeId, params.storeId), (0, drizzle_orm_1.eq)(schema.loyaltyPrograms.name, params.name)),
            });
            if (existing) {
                throw new types_1.ProgramAlreadyExistsError(params.name, params.storeId);
            }
            const validatedData = schema_validation_1.loyaltyValidation.programInsert.parse(params);
            const [newProgram] = await database_1.default
                .insert(schema.loyaltyPrograms)
                .values(validatedData)
                .returning();
            return this.ensureExists(newProgram, 'Loyalty Program');
        }
        catch (error) {
            if (error instanceof types_1.ProgramAlreadyExistsError)
                throw error;
            throw new types_1.DatabaseOperationError('create loyalty program', error);
        }
    }
    async updateProgram(programId, params) {
        try {
            const validatedData = schema_validation_1.loyaltyValidation.programUpdate.parse(params);
            const [updatedProgram] = await database_1.default
                .update(schema.loyaltyPrograms)
                .set(validatedData)
                .where((0, drizzle_orm_1.eq)(schema.loyaltyPrograms.id, programId))
                .returning();
            return this.ensureExists(updatedProgram, 'Loyalty Program');
        }
        catch (error) {
            throw new types_1.DatabaseOperationError('update loyalty program', error);
        }
    }
    async enrollCustomer(params) {
        try {
            const existingMember = await database_1.default.query.loyaltyMembers.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.loyaltyMembers.programId, params.programId), (0, drizzle_orm_1.eq)(schema.loyaltyMembers.customerId, params.customerId)),
            });
            if (existingMember) {
                throw new types_1.MemberAlreadyEnrolledError(params.customerId, params.programId);
            }
            const validatedData = schema_validation_1.loyaltyValidation.member.insert.parse({
                ...params,
                membershipId: this.generateMembershipId(params.customerId, params.programId),
            });
            const [newMember] = await database_1.default.insert(schema.loyaltyMembers).values(validatedData).returning();
            return this.ensureExists(newMember, 'Loyalty Member');
        }
        catch (error) {
            if (error instanceof types_1.MemberAlreadyEnrolledError)
                throw error;
            throw new types_1.DatabaseOperationError('enroll customer', error);
        }
    }
    async addPoints(params) {
        return database_1.default.transaction(async (tx) => {
            try {
                const member = await tx.query.loyaltyMembers.findFirst({
                    where: (0, drizzle_orm_1.eq)(schema.loyaltyMembers.id, params.memberId),
                    for: 'update',
                });
                if (!member) {
                    throw new types_1.LoyaltyMemberNotFoundError(params.memberId);
                }
                const newPoints = (member.points ?? 0) + params.points;
                await tx
                    .update(schema.loyaltyMembers)
                    .set({ points: newPoints, updatedAt: new Date() })
                    .where((0, drizzle_orm_1.eq)(schema.loyaltyMembers.id, params.memberId));
                const transactionData = {
                    memberId: params.memberId,
                    programId: member.programId,
                    pointsEarned: params.points,
                    pointsBalance: newPoints,
                    transactionType: 'earn',
                    source: params.source,
                    transactionId: params.transactionId,
                    description: `Earned ${params.points} points from ${params.source}`,
                };
                const validatedData = schema_validation_1.loyaltyValidation.transactionInsert.parse(transactionData);
                const [newTransaction] = await tx
                    .insert(schema.loyaltyTransactions)
                    .values(validatedData)
                    .returning();
                return this.ensureExists(newTransaction, 'Loyalty Transaction');
            }
            catch (error) {
                if (error instanceof types_1.LoyaltyMemberNotFoundError)
                    throw error;
                throw new types_1.DatabaseOperationError('add points', error);
            }
        });
    }
    async redeemPoints(params) {
        return database_1.default.transaction(async (tx) => {
            try {
                const member = await tx.query.loyaltyMembers.findFirst({
                    where: (0, drizzle_orm_1.eq)(schema.loyaltyMembers.id, params.memberId),
                    for: 'update',
                });
                if (!member) {
                    throw new types_1.LoyaltyMemberNotFoundError(params.memberId);
                }
                const reward = await tx.query.loyaltyRewards.findFirst({
                    where: (0, drizzle_orm_1.eq)(schema.loyaltyRewards.id, params.rewardId),
                });
                if (!reward || !reward.pointsRequired) {
                    throw new types_1.RewardNotFoundError(params.rewardId);
                }
                if ((member.points ?? 0) < reward.pointsRequired) {
                    throw new types_1.InsufficientPointsError(params.memberId, reward.pointsRequired);
                }
                const newPoints = (member.points ?? 0) - reward.pointsRequired;
                await tx
                    .update(schema.loyaltyMembers)
                    .set({ points: newPoints, updatedAt: new Date() })
                    .where((0, drizzle_orm_1.eq)(schema.loyaltyMembers.id, params.memberId));
                const transactionData = {
                    memberId: params.memberId,
                    programId: member.programId,
                    pointsRedeemed: reward.pointsRequired,
                    pointsBalance: newPoints,
                    transactionType: 'redeem',
                    source: 'reward_redemption',
                    description: `Redeemed reward: ${reward.name}`,
                };
                const validatedData = schema_validation_1.loyaltyValidation.transactionInsert.parse(transactionData);
                const [newTransaction] = await tx
                    .insert(schema.loyaltyTransactions)
                    .values(validatedData)
                    .returning();
                return this.ensureExists(newTransaction, 'Loyalty Transaction');
            }
            catch (error) {
                if (error instanceof types_1.LoyaltyMemberNotFoundError ||
                    error instanceof types_1.RewardNotFoundError ||
                    error instanceof types_1.InsufficientPointsError) {
                    throw error;
                }
                throw new types_1.DatabaseOperationError('redeem points', error);
            }
        });
    }
    async getLoyaltyProgramById(programId) {
        try {
            const query = database_1.default.query.loyaltyPrograms.findFirst({
                where: (0, drizzle_orm_1.eq)(schema.loyaltyPrograms.id, programId),
            });
            return await query;
        }
        catch (error) {
            return this.handleError(error, 'getting loyalty program by ID');
        }
    }
    async getLoyaltyProgramByStore(storeId) {
        try {
            const query = database_1.default.query.loyaltyPrograms.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.loyaltyPrograms.storeId, storeId), (0, drizzle_orm_1.eq)(schema.loyaltyPrograms.active, true)),
                orderBy: { createdAt: 'desc' },
            });
            return await query;
        }
        catch (error) {
            return this.handleError(error, 'getting loyalty program by store');
        }
    }
    async getLoyaltyMemberById(memberId) {
        try {
            const query = database_1.default.query.loyaltyMembers.findFirst({
                where: (0, drizzle_orm_1.eq)(schema.loyaltyMembers.id, memberId),
            });
            return await query;
        }
        catch (error) {
            return this.handleError(error, 'getting loyalty member by ID');
        }
    }
    async getLoyaltyMemberByUser(programId, userId) {
        try {
            const query = database_1.default.query.loyaltyMembers.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.loyaltyMembers.programId, programId), (0, drizzle_orm_1.eq)(schema.loyaltyMembers.customerId, userId)),
            });
            return await query;
        }
        catch (error) {
            return this.handleError(error, 'getting loyalty member by user');
        }
    }
    async getLoyaltyTransactionsByMember(memberId) {
        try {
            return await database_1.default.query.loyaltyTransactions.findMany({
                where: (0, drizzle_orm_1.eq)(schema.loyaltyTransactions.memberId, memberId),
                orderBy: { createdAt: 'desc' },
            });
        }
        catch (error) {
            return this.handleError(error, 'getting loyalty transactions by member');
        }
    }
    /**
     * Generate a unique membership ID
     *
     * @param userId User ID
     * @param programId Program ID
     * @returns Unique membership ID
     */
    generateMembershipId(userId, programId) {
        const prefix = 'LM';
        const timestamp = Date.now().toString().slice(-6);
        return `${prefix}${programId}${userId}${timestamp}`;
    }
}
exports.EnhancedLoyaltyService = EnhancedLoyaltyService;
