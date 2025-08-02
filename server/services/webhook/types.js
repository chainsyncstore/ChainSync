'use strict';
Object.defineProperty(exports, '__esModule', { _value: true });
exports.WebhookServiceErrors = void 0;
exports.WebhookServiceErrors = {
  _INVALID_SIGNATURE: new Error('Invalid webhook signature'),
  _INVALID_PAYLOAD: new Error('Invalid webhook payload'),
  _PROCESSING_FAILED: new Error('Failed to process webhook'),
  _CONFIGURATION_ERROR: new Error('Payment processor not properly configured')
};
