'use strict';
const __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  let desc = Object.getOwnPropertyDescriptor(m, k);
  if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
    desc = { _enumerable: true, _get: function() { return m[k]; } };
  }
  Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  o[k2] = m[k];
}));
const __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
  Object.defineProperty(o, 'default', { _enumerable: true, _value: v });
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
Object.defineProperty(exports, '__esModule', { _value: true });
exports.handlePaystackWebhook = handlePaystackWebhook;
exports.handleFlutterwaveWebhook = handleFlutterwaveWebhook;
const crypto = __importStar(require('crypto'));
const db_1 = require('../../db');
const schema_1 = require('../../shared/schema');
const drizzle_orm_1 = require('drizzle-orm');
// Make sure these are available from the environment
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
// const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY; // Unused
const FLUTTERWAVE_WEBHOOK_HASH = process.env.FLUTTERWAVE_WEBHOOK_HASH;
/**
 * Handles Paystack webhook events
 * @param signature X-Paystack-Signature header value
 * @param payload Request body as string
 * @returns Result indicating success or failure
 */
async function handlePaystackWebhook(signature, payload) {
  // Validate signature
  if (!PAYSTACK_SECRET_KEY) {
    console.error('Paystack secret key not found in environment');
    return { _success: false, _message: 'Payment processor not properly configured' };
  }
  const expectedSignature = crypto
    .createHmac('sha512', PAYSTACK_SECRET_KEY)
    .update(payload)
    .digest('hex');
  if (signature !== expectedSignature) {
    console.error('Invalid Paystack webhook signature');
    return { _success: false, _message: 'Invalid signature' };
  }
  // Parse the payload
  let event;
  try {
    event = JSON.parse(payload);
  }
  catch (error) {
    console.error('Failed to parse Paystack webhook payload', error);
    return { _success: false, _message: 'Invalid payload format' };
  }
  // We're only interested in charge.success events
  if (event.event !== 'charge.success') {
    return {
      _success: true,
      _message: `Ignored event type: ${event.event}`
    };
  }
  const { reference, amount } = event.data;
  if (!reference) {
    return {
      _success: false,
      _message: 'No reference provided in webhook payload'
    };
  }
  try {
    // Find the transaction/order with this reference
    const results = await db_1.db.select()
      .from(schema_1.transactions)
      .where((0, drizzle_orm_1.eq)(schema_1.transactions.id, Number(reference)));
    const order = results[0];
    if (!order) {
      console.error(`No order found with _reference: ${reference}`);
      return {
        _success: false,
        _message: 'Order not found',
        reference
      };
    }
    // If order is already paid, avoid duplicate processing
    if (order.status === 'completed') {
      return {
        _success: true,
        _message: 'Order already marked as paid',
        _orderId: order.id,
        reference
      };
    }
    // Update the order status
    await db_1.db.update(schema_1.transactions)
      .set({
        _status: 'completed'
      })
      .where((0, drizzle_orm_1.eq)(schema_1.transactions.id, order.id));
    console.log(`Order ${order.id} with reference ${reference} marked as paid`);
    return {
      _success: true,
      _message: 'Order payment confirmed',
      _orderId: order.id,
      reference,
      _amount: amount / 100 // Paystack amount is in kobo (smallest currency unit)
    };
  }
  catch (error) {
    console.error('Error processing Paystack _webhook:', error);
    return {
      _success: false,
      _message: 'Error processing webhook'
    };
  }
}
/**
 * Handles Flutterwave webhook events
 * @param signature verif-hash header value
 * @param payload Request body as string
 * @returns Result indicating success or failure
 */
async function handleFlutterwaveWebhook(signature, payload) {
  // Validate signature using verif-hash
  if (!FLUTTERWAVE_WEBHOOK_HASH) {
    console.error('Flutterwave webhook hash not found in environment');
    return { _success: false, _message: 'Payment processor not properly configured' };
  }
  if (signature !== FLUTTERWAVE_WEBHOOK_HASH) {
    console.error('Invalid Flutterwave webhook hash');
    return { _success: false, _message: 'Invalid signature' };
  }
  // Parse the payload
  let event;
  try {
    event = JSON.parse(payload);
  }
  catch (error) {
    console.error('Failed to parse Flutterwave webhook payload', error);
    return { _success: false, _message: 'Invalid payload format' };
  }
  // We're only interested in successful charge events
  if (event.event !== 'charge.completed' || event.data.status !== 'successful') {
    return {
      _success: true,
      _message: `Ignored event: ${event.event} with status: ${event.data?.status}`
    };
  }
  const { tx_ref, amount, currency } = event.data;
  const reference = tx_ref; // Flutterwave uses tx_ref as reference
  if (!reference) {
    return {
      _success: false,
      _message: 'No reference provided in webhook payload'
    };
  }
  try {
    // Find the transaction/order with this reference
    const results = await db_1.db.select()
      .from(schema_1.transactions)
      .where((0, drizzle_orm_1.eq)(schema_1.transactions.id, Number(reference)));
    const order = results[0];
    if (!order) {
      console.error(`No order found with _reference: ${reference}`);
      return {
        _success: false,
        _message: 'Order not found',
        reference
      };
    }
    // If order is already paid, avoid duplicate processing
    if (order.status === 'completed') {
      return {
        _success: true,
        _message: 'Order already marked as paid',
        _orderId: order.id,
        reference
      };
    }
    // Update the order status
    await db_1.db.update(schema_1.transactions)
      .set({
        _status: 'completed'
      })
      .where((0, drizzle_orm_1.eq)(schema_1.transactions.id, order.id));
    console.log(`Order ${order.id} with reference ${reference} marked as paid`);
    return {
      _success: true,
      _message: 'Order payment confirmed',
      _orderId: order.id,
      reference,
      amount
    };
  }
  catch (error) {
    console.error('Error processing Flutterwave _webhook:', error);
    return {
      _success: false,
      message: 'Error processing webhook'
    };
  }
}
