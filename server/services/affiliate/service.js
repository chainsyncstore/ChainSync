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
exports.AffiliateService = void 0;
const service_1 = require("../base/service");
const types_1 = require("./types"); // IAffiliateServiceErrors removed
const storage_1 = require("../../storage");
const schema = __importStar(require("@shared/schema"));
const drizzle_orm_1 = require("drizzle-orm");
const crypto_1 = require("crypto");
const db_1 = require("../../../db");
const flutterwave_node_v3_1 = __importDefault(require("flutterwave-node-v3"));
// Initialize Flutterwave client if credentials are available
let flwClient = null;
try {
    if (process.env.FLW_PUBLIC_KEY && process.env.FLW_SECRET_KEY) {
        flwClient = new flutterwave_node_v3_1.default(process.env.FLW_PUBLIC_KEY, process.env.FLW_SECRET_KEY);
    }
}
catch (error) {
    console.error('Failed to initialize Flutterwave client:', error);
}
class AffiliateService extends service_1.BaseService {
    async generateReferralCode(userId) {
        try {
            const user = await storage_1.storage.getUserById(userId);
            if (!user) {
                throw types_1.AffiliateServiceErrors.USER_NOT_FOUND;
            }
            const baseCode = user.name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 5).toUpperCase();
            const randomString = (0, crypto_1.randomBytes)(3).toString('hex').toUpperCase();
            const referralCode = `${baseCode}${randomString}`;
            return referralCode;
        }
        catch (error) {
            this.handleError(error, 'Generating referral code');
        }
    }
    async registerAffiliate(userId) {
        try {
            const user = await storage_1.storage.getUserById(userId);
            if (!user) {
                throw types_1.AffiliateServiceErrors.USER_NOT_FOUND;
            }
            const referralCode = await this.generateReferralCode(userId);
            const [affiliate] = await db_1.db
                .insert(schema.affiliates)
                .values({
                userId,
                code: referralCode,
            })
                .returning();
            return affiliate;
        }
        catch (error) {
            this.handleError(error, 'Registering affiliate');
        }
    }
    async getAffiliateByUserId(userId) {
        try {
            const affiliate = await db_1.db.query.affiliates.findFirst({
                where: (0, drizzle_orm_1.eq)(schema.affiliates.userId, userId)
            });
            return affiliate ?? null;
        }
        catch (error) {
            this.handleError(error, 'Getting affiliate by user ID');
        }
    }
    async getAffiliateByCode(code) {
        try {
            const affiliate = await db_1.db.query.affiliates.findFirst({
                where: (0, drizzle_orm_1.eq)(schema.affiliates.code, code)
            });
            return affiliate ?? null;
        }
        catch (error) {
            this.handleError(error, 'Getting affiliate by code');
        }
    }
    async trackReferral(referralCode, newUserId) {
        try {
            const affiliate = await this.getAffiliateByCode(referralCode);
            if (!affiliate) {
                throw types_1.AffiliateServiceErrors.INVALID_REFERRAL_CODE;
            }
            const existingReferral = await db_1.db.query.referrals.findFirst({
                where: (0, drizzle_orm_1.eq)(schema.referrals.affiliateId, affiliate.id)
            });
            if (existingReferral) {
                throw types_1.AffiliateServiceErrors.REFERRAL_ALREADY_EXISTS;
            }
            const referral = await db_1.db.insert(schema.referrals).values({
                affiliateId: affiliate.id,
                referredUserId: newUserId,
                status: 'active',
                createdAt: new Date()
            }).returning();
            return referral[0];
        }
        catch (error) {
            this.handleError(error, 'Tracking referral');
        }
    }
    async applyReferralDiscount(userId, referralCode, subscriptionAmount, currency) {
        try {
            const affiliate = await this.getAffiliateByCode(referralCode);
            if (!affiliate) {
                throw types_1.AffiliateServiceErrors.INVALID_REFERRAL_CODE;
            }
            const discountAmount = (subscriptionAmount * AffiliateService.REFERRAL_DISCOUNT_PERCENTAGE) / 100;
            const discountedAmount = subscriptionAmount - discountAmount;
            return {
                discountedAmount,
                discountAmount
            };
        }
        catch (error) {
            this.handleError(error, 'Applying referral discount');
        }
    }
    async processAffiliateCommission(userId, paymentAmount, currency) {
        try {
            const affiliate = await this.getAffiliateByUserId(userId);
            if (!affiliate) {
                throw types_1.AffiliateServiceErrors.USER_NOT_FOUND;
            }
            const commissionAmount = (paymentAmount * AffiliateService.REFERRAL_COMMISSION_PERCENTAGE) / 100;
            const [payment] = await db_1.db
                .insert(schema.referralPayments)
                .values({
                affiliateId: affiliate.id,
                amount: commissionAmount.toString(),
                currency,
                status: 'pending',
                paymentDate: new Date(),
            })
                .returning();
            // update pending earnings tally
            await db_1.db
                .update(schema.affiliates)
                .set({
                pendingEarnings: (0, drizzle_orm_1.sql) `${schema.affiliates.pendingEarnings} + ${commissionAmount}`,
                totalEarnings: (0, drizzle_orm_1.sql) `${schema.affiliates.totalEarnings} + ${commissionAmount}`,
            })
                .where((0, drizzle_orm_1.eq)(schema.affiliates.id, affiliate.id));
            return !!payment;
        }
        catch (error) {
            this.handleError(error, 'Processing affiliate commission');
        }
    }
    async processAffiliatePayout(affiliateId) {
        try {
            const whereClauses = [(0, drizzle_orm_1.eq)(schema.referralPayments.status, 'pending')];
            if (affiliateId) {
                whereClauses.push((0, drizzle_orm_1.eq)(schema.referralPayments.affiliateId, affiliateId));
            }
            const pendingPayments = await db_1.db
                .select()
                .from(schema.referralPayments)
                .where((0, drizzle_orm_1.and)(...whereClauses))
                .orderBy((0, drizzle_orm_1.desc)(schema.referralPayments.paymentDate));
            const processed = [];
            for (const paymentRow of pendingPayments) {
                if (!flwClient) {
                    throw types_1.AffiliateServiceErrors.PAYOUT_FAILED;
                }
                try {
                    const affiliate = await this.getAffiliateByUserId(paymentRow.affiliateId);
                    if (!affiliate || !affiliate.bankCode || !affiliate.accountNumber) {
                        console.error(`Affiliate or bank details not found for payment ${paymentRow.id}`);
                        continue;
                    }
                    // Simulate payout
                    const payment = await this.withRetry(() => flwClient.Transfer.initiate({
                        account_bank: affiliate.bankCode,
                        account_number: affiliate.accountNumber,
                        amount: Number(paymentRow.amount),
                        currency: paymentRow.currency ?? 'NGN',
                        narration: `Affiliate Payout for ${affiliate.code}`,
                        reference: `payout_${paymentRow.id}_${Date.now()}`
                    }), 'Processing payout');
                    if (payment.status === 'success') {
                        // mark as paid locally
                        await db_1.db.update(schema.referralPayments)
                            .set({ status: 'completed', paymentDate: new Date() })
                            .where((0, drizzle_orm_1.eq)(schema.referralPayments.id, paymentRow.id));
                        // reduce pending earnings
                        await db_1.db.update(schema.affiliates)
                            .set({ pendingEarnings: (0, drizzle_orm_1.sql) `${schema.affiliates.pendingEarnings} - ${paymentRow.amount}` })
                            .where((0, drizzle_orm_1.eq)(schema.affiliates.id, paymentRow.affiliateId));
                        processed.push({ ...paymentRow, status: 'completed', paymentDate: new Date() });
                    }
                }
                catch (error) {
                    // Log but continue processing other payouts
                    console.error(`Failed to process payout for commission ${paymentRow.id}:`, error);
                }
            }
            return processed;
        }
        catch (error) {
            this.handleError(error, 'Processing affiliate payouts');
        }
    }
    async getAffiliateDashboardStats(userId) {
        try {
            const affiliate = await this.getAffiliateByUserId(userId);
            if (!affiliate) {
                throw types_1.AffiliateServiceErrors.USER_NOT_FOUND;
            }
            const referralRows = await db_1.db
                .select({ status: schema.referrals.status })
                .from(schema.referrals)
                .where((0, drizzle_orm_1.eq)(schema.referrals.affiliateId, affiliate.id));
            const referrals = {
                total: referralRows.length,
                active: referralRows.filter(r => r.status === 'active').length,
                pending: referralRows.filter(r => r.status === 'pending').length,
            };
            const earningsRows = await db_1.db
                .select({
                total: (0, drizzle_orm_1.sql) `coalesce(sum(${schema.referralPayments.amount}),0)`.as('total'),
                pending: (0, drizzle_orm_1.sql) `coalesce(sum(${schema.referralPayments.amount}) filter (where ${schema.referralPayments.status} = 'pending'),0)`.as('pending'),
            })
                .from(schema.referralPayments)
                .where((0, drizzle_orm_1.eq)(schema.referralPayments.affiliateId, affiliate.id));
            const earnings = {
                total: earningsRows[0]?.total?.toString() ?? '0',
                pending: earningsRows[0]?.pending?.toString() ?? '0',
            };
            const lastPaymentRows = await db_1.db
                .select({
                amount: schema.referralPayments.amount,
                date: schema.referralPayments.paymentDate,
            })
                .from(schema.referralPayments)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.referralPayments.affiliateId, affiliate.id), (0, drizzle_orm_1.eq)(schema.referralPayments.status, 'completed')))
                .orderBy((0, drizzle_orm_1.desc)(schema.referralPayments.paymentDate))
                .limit(1);
            const lastPayment = lastPaymentRows[0]
                ? { amount: lastPaymentRows[0].amount.toString(), date: lastPaymentRows[0].date }
                : undefined;
            return {
                affiliate,
                referrals,
                earnings: { ...earnings, lastPayment },
                clicks: 0,
                conversions: referrals.total,
            };
        }
        catch (error) {
            this.handleError(error, 'Getting affiliate dashboard stats');
        }
    }
    async getAffiliateReferrals(userId) {
        try {
            const affiliate = await this.getAffiliateByUserId(userId);
            if (!affiliate)
                throw types_1.AffiliateServiceErrors.USER_NOT_FOUND;
            return await db_1.db
                .select()
                .from(schema.referrals)
                .where((0, drizzle_orm_1.eq)(schema.referrals.affiliateId, affiliate.id))
                .orderBy((0, drizzle_orm_1.desc)(schema.referrals.createdAt));
        }
        catch (error) {
            this.handleError(error, 'Getting affiliate referrals');
        }
    }
    async getAffiliatePayments(userId) {
        try {
            const affiliate = await this.getAffiliateByUserId(userId);
            if (!affiliate)
                throw types_1.AffiliateServiceErrors.USER_NOT_FOUND;
            return await db_1.db
                .select()
                .from(schema.referralPayments)
                .where((0, drizzle_orm_1.eq)(schema.referralPayments.affiliateId, affiliate.id))
                .orderBy((0, drizzle_orm_1.desc)(schema.referralPayments.paymentDate));
        }
        catch (error) {
            this.handleError(error, 'Getting affiliate payments');
        }
    }
    async trackAffiliateClick(referralCode, source) {
        try {
            const affiliate = await this.getAffiliateByCode(referralCode);
            if (!affiliate) {
                throw types_1.AffiliateServiceErrors.INVALID_REFERRAL_CODE;
            }
            // This would require additional tracking table
            return true;
        }
        catch (error) {
            this.handleError(error, 'Tracking affiliate click');
        }
    }
    async updateAffiliateBankDetails(userId, bankDetails) {
        try {
            const affiliate = await this.getAffiliateByUserId(userId);
            if (!affiliate) {
                throw types_1.AffiliateServiceErrors.USER_NOT_FOUND;
            }
            const updated = await db_1.db
                .update(schema.affiliates)
                .set({
                ...bankDetails,
                paymentMethod: bankDetails.paymentMethod,
            })
                .where((0, drizzle_orm_1.eq)(schema.affiliates.userId, userId))
                .returning();
            return updated[0];
        }
        catch (error) {
            this.handleError(error, 'Updating affiliate bank details');
        }
    }
}
exports.AffiliateService = AffiliateService;
AffiliateService.REFERRAL_COMMISSION_PERCENTAGE = 10;
AffiliateService.REFERRAL_DISCOUNT_PERCENTAGE = 10;
AffiliateService.REFERRAL_PERIOD_MONTHS = 12;
