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
exports.WebhookService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const index_js_1 = require("../../../db/index.js");
const schema = __importStar(require("../../../shared/schema.js"));
const service_js_1 = require("../base/service.js");
const schema_validation_js_1 = require("../../../shared/schema-validation.js");
const errors_js_1 = require("../../../shared/types/errors.js");
const crypto_1 = __importDefault(require("crypto"));
const axios_1 = __importDefault(require("axios"));
class WebhookService extends service_js_1.BaseService {
    async handlePaystackWebhook(signature, payload) {
        // For now, basic stub implementation
        return { success: true, message: 'Handled Paystack webhook' };
    }
    async handleFlutterwaveWebhook(signature, payload) {
        return { success: true, message: 'Handled Flutterwave webhook' };
    }
    async createWebhook(params) {
        try {
            const validatedData = schema_validation_js_1.webhookValidation.create(params);
            const existingWebhook = await index_js_1.db.query.webhooks.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.webhooks.url, validatedData.url), (0, drizzle_orm_1.eq)(schema.webhooks.storeId, validatedData.storeId), (0, drizzle_orm_1.eq)(schema.webhooks.isActive, true))
            });
            if (existingWebhook) {
                throw new errors_js_1.AppError('Webhook with this URL already exists for this store', errors_js_1.ErrorCode.DUPLICATE_ENTRY, errors_js_1.ErrorCategory.VALIDATION);
            }
            const secret = crypto_1.default.randomBytes(32).toString('hex');
            const [webhook] = await index_js_1.db
                .insert(schema.webhooks)
                .values({
                ...validatedData,
                secret,
                createdAt: new Date(),
                updatedAt: new Date()
            })
                .returning();
            return webhook;
        }
        catch (error) {
            if (error instanceof schema_validation_js_1.SchemaValidationError) {
                console.error(`Validation error: ${error.message}`, error.toJSON());
            }
            throw this.handleError(error, 'Creating webhook');
        }
    }
    async updateWebhook(id, params) {
        try {
            const validatedData = schema_validation_js_1.webhookValidation.update(params);
            const existingWebhook = await index_js_1.db.query.webhooks.findFirst({
                where: (0, drizzle_orm_1.eq)(schema.webhooks.id, id)
            });
            if (!existingWebhook) {
                throw new errors_js_1.AppError('Webhook not found', errors_js_1.ErrorCode.NOT_FOUND, errors_js_1.ErrorCategory.VALIDATION);
            }
            const [updatedWebhook] = await index_js_1.db
                .update(schema.webhooks)
                .set({
                ...validatedData,
                updatedAt: new Date()
            })
                .where((0, drizzle_orm_1.eq)(schema.webhooks.id, id))
                .returning();
            return updatedWebhook;
        }
        catch (error) {
            if (error instanceof schema_validation_js_1.SchemaValidationError) {
                console.error(`Validation error: ${error.message}`, error.toJSON());
            }
            throw this.handleError(error, 'Updating webhook');
        }
    }
    async deleteWebhook(id) {
        try {
            const existingWebhook = await index_js_1.db.query.webhooks.findFirst({
                where: (0, drizzle_orm_1.eq)(schema.webhooks.id, id)
            });
            if (!existingWebhook) {
                throw new errors_js_1.AppError('Webhook not found', errors_js_1.ErrorCode.NOT_FOUND, errors_js_1.ErrorCategory.VALIDATION);
            }
            await index_js_1.db
                .update(schema.webhooks)
                .set({
                isActive: false,
                updatedAt: new Date()
            })
                .where((0, drizzle_orm_1.eq)(schema.webhooks.id, id));
            return true;
        }
        catch (error) {
            throw this.handleError(error, 'Deleting webhook');
        }
    }
    async getWebhookById(id) {
        try {
            const webhook = await index_js_1.db.query.webhooks.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.webhooks.id, id), (0, drizzle_orm_1.eq)(schema.webhooks.isActive, true))
            });
            return webhook || null;
        }
        catch (error) {
            throw this.handleError(error, 'Getting webhook by ID');
        }
    }
    async getWebhooksByStore(storeId) {
        try {
            const webhooks = await index_js_1.db.query.webhooks.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.webhooks.storeId, storeId), (0, drizzle_orm_1.eq)(schema.webhooks.isActive, true)),
                orderBy: [(0, drizzle_orm_1.desc)(schema.webhooks.createdAt)]
            });
            return webhooks;
        }
        catch (error) {
            throw this.handleError(error, 'Getting webhooks by store');
        }
    }
    async triggerWebhook(eventType, data, storeId) {
        try {
            const webhooks = await index_js_1.db.query.webhooks.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.webhooks.storeId, storeId), (0, drizzle_orm_1.eq)(schema.webhooks.isActive, true), (0, drizzle_orm_1.sql) `${schema.webhooks.events} ? ${eventType}`)
            });
            const [event] = await index_js_1.db
                .insert(schema.webhookEvents)
                .values({
                webhookId: 0,
                event: eventType,
                payload: JSON.stringify(data),
                createdAt: new Date()
            })
                .returning();
            for (const webhook of webhooks) {
                await this.deliverWebhook(webhook, event, data);
            }
        }
        catch (error) {
            console.error('Error triggering webhook:', error);
        }
    }
    async deliverWebhook(webhook, event, data) {
        let attempt = 0;
        let lastError = null;
        while (attempt < WebhookService.MAX_RETRY_ATTEMPTS) {
            try {
                const [delivery] = await index_js_1.db
                    .insert(schema.webhookDeliveries)
                    .values({
                    webhookId: webhook.id,
                    eventId: event.id,
                    attempt: attempt + 1,
                    status: 'pending',
                    createdAt: new Date()
                })
                    .returning();
                const signature = this.generateSignature(JSON.stringify(data), webhook.secret);
                const response = await axios_1.default.post(webhook.url, data, {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Webhook-Signature': signature,
                        'X-Webhook-Event': event.event,
                        'User-Agent': 'ChainSync-Webhook/1.0'
                    },
                    timeout: 30000
                });
                await index_js_1.db
                    .update(schema.webhookDeliveries)
                    .set({
                    status: 'delivered',
                    response: JSON.stringify(response.data),
                    updatedAt: new Date()
                })
                    .where((0, drizzle_orm_1.eq)(schema.webhookDeliveries.id, delivery.id));
                return;
            }
            catch (error) {
                lastError = error;
                attempt++;
                const deliveryRecord = await index_js_1.db.query.webhookDeliveries.findFirst({
                    where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.webhookDeliveries.webhookId, webhook.id), (0, drizzle_orm_1.eq)(schema.webhookDeliveries.eventId, event.id), (0, drizzle_orm_1.eq)(schema.webhookDeliveries.attempt, attempt))
                });
                if (deliveryRecord) {
                    await index_js_1.db
                        .update(schema.webhookDeliveries)
                        .set({
                        status: attempt >= WebhookService.MAX_RETRY_ATTEMPTS ? 'failed' : 'retrying',
                        response: lastError?.message ?? null,
                    })
                        .where((0, drizzle_orm_1.eq)(schema.webhookDeliveries.id, deliveryRecord.id));
                }
                if (attempt < WebhookService.MAX_RETRY_ATTEMPTS) {
                    await new Promise(resolve => setTimeout(resolve, WebhookService.RETRY_DELAY_MS * attempt));
                }
            }
        }
        console.error(`Webhook delivery failed after ${WebhookService.MAX_RETRY_ATTEMPTS} attempts:`, lastError);
    }
    generateSignature(payload, secret) {
        return crypto_1.default
            .createHmac('sha256', secret)
            .update(payload)
            .digest('hex');
    }
    async getWebhookDeliveries(webhookId, limit = 50) {
        try {
            const deliveries = await index_js_1.db.query.webhookDeliveries.findMany({
                where: (0, drizzle_orm_1.eq)(schema.webhookDeliveries.webhookId, webhookId),
                orderBy: [(0, drizzle_orm_1.desc)(schema.webhookDeliveries.createdAt)],
                limit,
            });
            return deliveries;
        }
        catch (error) {
            throw this.handleError(error, 'Getting webhook deliveries');
        }
    }
    async retryWebhookDelivery(deliveryId) {
        try {
            const delivery = await index_js_1.db.query.webhookDeliveries.findFirst({
                where: (0, drizzle_orm_1.eq)(schema.webhookDeliveries.id, deliveryId),
            });
            if (!delivery) {
                throw new errors_js_1.AppError('Delivery not found', errors_js_1.ErrorCode.NOT_FOUND, errors_js_1.ErrorCategory.VALIDATION);
            }
            const webhook = await index_js_1.db.query.webhooks.findFirst({
                where: (0, drizzle_orm_1.eq)(schema.webhooks.id, delivery.webhookId)
            });
            const event = await index_js_1.db.query.webhookEvents.findFirst({
                where: (0, drizzle_orm_1.eq)(schema.webhookEvents.id, delivery.eventId)
            });
            if (!webhook || !event) {
                throw new errors_js_1.AppError('Related webhook or event not found', errors_js_1.ErrorCode.NOT_FOUND, errors_js_1.ErrorCategory.VALIDATION);
            }
            const eventData = event.payload ? JSON.parse(event.payload) : {};
            await this.deliverWebhook(webhook, event, eventData);
            return true;
        }
        catch (error) {
            throw this.handleError(error, 'Retrying webhook delivery');
        }
    }
}
exports.WebhookService = WebhookService;
WebhookService.MAX_RETRY_ATTEMPTS = 3;
WebhookService.RETRY_DELAY_MS = 1000;
