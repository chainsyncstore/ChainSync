"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookServiceErrors = void 0;
exports.WebhookServiceErrors = {
    INVALID_SIGNATURE: new Error('Invalid webhook signature'),
    INVALID_PAYLOAD: new Error('Invalid webhook payload'),
    PROCESSING_FAILED: new Error('Failed to process webhook'),
    CONFIGURATION_ERROR: new Error('Payment processor not properly configured')
};
