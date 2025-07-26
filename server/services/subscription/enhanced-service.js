"use strict";
/**
 * Enhanced Subscription Service
 *
 * A refactored implementation that extends the common EnhancedBaseService
 * and satisfies the entire ISubscriptionService contract.
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
exports.EnhancedSubscriptionService = void 0;
const enhanced_service_1 = require("../base/enhanced-service");
const formatter_1 = require("./formatter");
const schema_validation_1 = require("@shared/schema-validation");
const schema_helpers_1 = require("@shared/schema-helpers");
const types_1 = require("./types");
const db_1 = require("@server/db");
const drizzle_orm_1 = require("drizzle-orm");
const schema = __importStar(require("@shared/schema"));
class EnhancedSubscriptionService extends enhanced_service_1.EnhancedBaseService {
    constructor() {
        super(...arguments);
        this.formatter = new formatter_1.SubscriptionFormatter();
    }
    /* -------------------------------------------------------------------------- */
    /*                               CRUD METHODS                                 */
    /* -------------------------------------------------------------------------- */
    async createSubscription(params) {
        try {
            const validated = schema_validation_1.subscriptionValidation.insert.parse(params);
            const data = (0, schema_helpers_1.prepareSubscriptionData)(validated);
            const [subscription] = await db_1.db
                .insert(schema.subscriptions)
                .values(data)
                .returning();
            return this.ensureExists(subscription, 'Subscription');
        }
        catch (err) {
            if (err instanceof schema_validation_1.SchemaValidationError) {
                console.error(`Validation error: ${err.message}`, err.toJSON());
            }
            throw this.handleError(err, 'creating subscription');
        }
    }
    async updateSubscription(subscriptionId, params) {
        try {
            const existing = await this.getSubscriptionById(subscriptionId);
            if (!existing)
                throw types_1.SubscriptionServiceErrors.SUBSCRIPTION_NOT_FOUND;
            if (params.status && params.status !== existing.status) {
                this.validateStatusTransition(existing.status, params.status);
            }
            const updateData = {
                ...params,
                metadata: params.metadata
                    ? JSON.stringify(params.metadata)
                    : existing.metadata,
                updatedAt: new Date(),
            };
            const validated = schema_validation_1.subscriptionValidation.update.parse(updateData);
            const prepared = (0, schema_helpers_1.prepareSubscriptionData)(validated);
            const [updated] = await db_1.db
                .update(schema.subscriptions)
                .set(prepared)
                .where((0, drizzle_orm_1.eq)(schema.subscriptions.id, subscriptionId))
                .returning();
            return this.ensureExists(updated, 'Subscription');
        }
        catch (err) {
            throw this.handleError(err, 'updating subscription');
        }
    }
    /* -------------------------------------------------------------------------- */
    /*                               READ METHODS                                 */
    /* -------------------------------------------------------------------------- */
    async getSubscriptionById(id) {
        try {
            const subscription = await db_1.db.query.subscriptions.findFirst({
                where: (0, drizzle_orm_1.eq)(schema.subscriptions.id, id),
            });
            return subscription ? this.formatter.formatResult(subscription) : null;
        }
        catch (err) {
            throw this.handleError(err, 'getting subscription by ID');
        }
    }
    async getSubscriptionByUser(userId) {
        try {
            const subscription = await db_1.db.query.subscriptions.findFirst({
                where: (0, drizzle_orm_1.eq)(schema.subscriptions.userId, userId),
                orderBy: (0, drizzle_orm_1.desc)(schema.subscriptions.createdAt),
            });
            return subscription ? this.formatter.formatResult(subscription) : null;
        }
        catch (err) {
            throw this.handleError(err, 'getting subscription by user');
        }
    }
    async getActiveSubscription(userId) {
        try {
            const subscription = await db_1.db.query.subscriptions.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.subscriptions.userId, userId), (0, drizzle_orm_1.eq)(schema.subscriptions.status, 'active')),
                orderBy: (0, drizzle_orm_1.desc)(schema.subscriptions.createdAt),
            });
            return subscription ? this.formatter.formatResult(subscription) : null;
        }
        catch (err) {
            throw this.handleError(err, 'getting active subscription');
        }
    }
    async searchSubscriptions(params) {
        try {
            const page = params.page ?? 1;
            const limit = params.limit ?? 20;
            const offset = (page - 1) * limit;
            const filters = [];
            if (params.userId)
                filters.push((0, drizzle_orm_1.eq)(schema.subscriptions.userId, params.userId));
            if (params.plan)
                filters.push((0, drizzle_orm_1.eq)(schema.subscriptions.planId, params.plan));
            if (params.status)
                filters.push((0, drizzle_orm_1.eq)(schema.subscriptions.status, params.status));
            if (params.startDate)
                filters.push((0, drizzle_orm_1.gte)(schema.subscriptions.currentPeriodStart, params.startDate));
            if (params.endDate)
                filters.push((0, drizzle_orm_1.lte)(schema.subscriptions.currentPeriodEnd, params.endDate));
            if (params.provider)
                filters.push((0, drizzle_orm_1.eq)(schema.subscriptions.paymentMethod, params.provider));
            const whereClause = filters.length ? (0, drizzle_orm_1.and)(...filters) : undefined;
            const countResult = await db_1.db
                .select({
                count: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
            })
                .from(schema.subscriptions)
                .where(whereClause);
            const records = await db_1.db.query.subscriptions.findMany({
                where: whereClause,
                limit,
                offset,
                orderBy: (0, drizzle_orm_1.desc)(schema.subscriptions.createdAt),
            });
            return {
                subscriptions: records.map((r) => this.formatter.formatResult(r)),
                total: countResult[0]?.count ?? 0,
                page,
                limit,
            };
        }
        catch (err) {
            throw this.handleError(err, 'searching subscriptions');
        }
    }
    /* -------------------------------------------------------------------------- */
    /*                         STATE-CHANGE OPERATIONS                            */
    /* -------------------------------------------------------------------------- */
    async cancelSubscription(subscriptionId, reason) {
        try {
            const sub = await this.getSubscriptionById(subscriptionId);
            if (!sub)
                throw types_1.SubscriptionServiceErrors.SUBSCRIPTION_NOT_FOUND;
            this.validateStatusTransition(sub.status, types_1.SubscriptionStatus.CANCELLED);
            const updated = await this.updateSubscription(subscriptionId, {
                status: types_1.SubscriptionStatus.CANCELLED,
            });
            // TODO: persist `reason` to an audit table if required.
            return updated;
        }
        catch (err) {
            throw this.handleError(err, 'cancelling subscription');
        }
    }
    async renewSubscription(id) {
        try {
            const sub = await this.getSubscriptionById(id);
            if (!sub)
                throw types_1.SubscriptionServiceErrors.SUBSCRIPTION_NOT_FOUND;
            const newEnd = new Date(sub.endDate);
            newEnd.setMonth(newEnd.getMonth() + 1);
            return await this.updateSubscription(id, {
                endDate: newEnd,
                status: types_1.SubscriptionStatus.ACTIVE,
            });
        }
        catch (err) {
            throw this.handleError(err, 'renewing subscription');
        }
    }
    /* -------------------------------------------------------------------------- */
    /*                            WEBHOOK / ACCESS                                */
    /* -------------------------------------------------------------------------- */
    async processWebhook(_) {
        // TODO – real provider-specific webhook handling
        return true;
    }
    async validateSubscriptionAccess(userId, requiredPlan) {
        const sub = await this.getActiveSubscription(userId);
        if (!sub)
            return false;
        if (!requiredPlan)
            return true;
        return sub.planId === requiredPlan;
    }
    /* -------------------------------------------------------------------------- */
    /*                                 METRICS                                    */
    /* -------------------------------------------------------------------------- */
    async getSubscriptionMetrics() {
        // These could be optimized into a single SQL query; kept simple for clarity.
        const [totals] = await db_1.db
            .select({
            total: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
        })
            .from(schema.subscriptions);
        const [active] = await db_1.db
            .select({
            total: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
        })
            .from(schema.subscriptions)
            .where((0, drizzle_orm_1.eq)(schema.subscriptions.status, 'active'));
        const plans = await db_1.db
            .select({
            plan: schema.subscriptions.planId,
            total: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
        })
            .from(schema.subscriptions)
            .groupBy(schema.subscriptions.planId);
        // Placeholder revenue & churn; implement as required.
        return {
            totalSubscriptions: totals?.total ?? 0,
            activeSubscriptions: active?.total ?? 0,
            revenueThisMonth: '0.00',
            revenueLastMonth: '0.00',
            subscriptionsByPlan: Object.fromEntries(plans.map((p) => [p.plan, p.total])),
            churnRate: '0.00%',
        };
    }
    /* -------------------------------------------------------------------------- */
    /*                            HELPER UTILITIES                                */
    /* -------------------------------------------------------------------------- */
    validateStatusTransition(current, next) {
        const allowed = {
            [types_1.SubscriptionStatus.ACTIVE]: [
                types_1.SubscriptionStatus.CANCELLED,
                types_1.SubscriptionStatus.EXPIRED,
                types_1.SubscriptionStatus.PAST_DUE,
            ],
            [types_1.SubscriptionStatus.PENDING]: [
                types_1.SubscriptionStatus.ACTIVE,
                types_1.SubscriptionStatus.CANCELLED,
                types_1.SubscriptionStatus.FAILED,
            ],
            [types_1.SubscriptionStatus.PAST_DUE]: [
                types_1.SubscriptionStatus.ACTIVE,
                types_1.SubscriptionStatus.CANCELLED,
                types_1.SubscriptionStatus.EXPIRED,
            ],
            [types_1.SubscriptionStatus.TRIAL]: [
                types_1.SubscriptionStatus.ACTIVE,
                types_1.SubscriptionStatus.CANCELLED,
                types_1.SubscriptionStatus.EXPIRED,
            ],
            [types_1.SubscriptionStatus.EXPIRED]: [types_1.SubscriptionStatus.ACTIVE],
            [types_1.SubscriptionStatus.CANCELLED]: [types_1.SubscriptionStatus.ACTIVE],
            [types_1.SubscriptionStatus.FAILED]: [types_1.SubscriptionStatus.ACTIVE],
            [types_1.SubscriptionStatus.INACTIVE]: [types_1.SubscriptionStatus.ACTIVE],
            [types_1.SubscriptionStatus.SUSPENDED]: [
                types_1.SubscriptionStatus.ACTIVE,
                types_1.SubscriptionStatus.CANCELLED,
            ],
        };
        if (current === next ||
            !allowed[current]?.includes(next)) {
            throw types_1.SubscriptionServiceErrors.INVALID_STATUS_TRANSITION;
        }
    }
}
exports.EnhancedSubscriptionService = EnhancedSubscriptionService;
