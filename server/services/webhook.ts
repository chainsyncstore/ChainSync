import * as crypto from 'crypto';
import { db } from '../../db/index.js';
import { transactions } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';

// Make sure these are available from the environment
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
// const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY; // Unused
const FLUTTERWAVE_WEBHOOK_HASH = process.env.FLUTTERWAVE_WEBHOOK_HASH;

export interface WebhookHandlerResult {
  success: boolean;
  message: string;
  orderId?: number;
  reference?: string;
  amount?: number;
}

/**
 * Handles Paystack webhook events
 * @param signature X-Paystack-Signature header value
 * @param payload Request body as string
 * @returns Result indicating success or failure
 */
export async function handlePaystackWebhook(
  signature: string,
  payload: string
): Promise<WebhookHandlerResult> {
  // Validate signature
  if (!PAYSTACK_SECRET_KEY) {
    console.error('Paystack secret key not found in environment');
    return { success: false, message: 'Payment processor not properly configured' };
  }

  const expectedSignature = crypto
    .createHmac('sha512', PAYSTACK_SECRET_KEY)
    .update(payload)
    .digest('hex');

  if (signature !== expectedSignature) {
    console.error('Invalid Paystack webhook signature');
    return { success: false, message: 'Invalid signature' };
  }

  // Parse the payload
  let event;
  try {
    event = JSON.parse(payload);
  } catch (error) {
    console.error('Failed to parse Paystack webhook payload', error);
    return { success: false, message: 'Invalid payload format' };
  }

  // We're only interested in charge.success events
  if (event.event !== 'charge.success') {
    return {
      success: true,
      message: `Ignored event type: ${event.event}`
    };
  }

  const { reference, amount } = event.data;

  if (!reference) {
    return {
      success: false,
      message: 'No reference provided in webhook payload'
    };
  }

  try {
    // Find the transaction/order with this reference
    const results = await db.select()
      .from(transactions)
      .where(eq(transactions.id, Number(reference)));

    const order = results[0];

    if (!order) {
      console.error(`No order found with reference: ${reference}`);
      return {
        success: false,
        message: 'Order not found',
        reference
      };
    }

    // If order is already paid, avoid duplicate processing
    if (order.status === 'completed') {
      return {
        success: true,
        message: 'Order already marked as paid',
        orderId: order.id,
        reference
      };
    }

    // Update the order status
    await db.update(transactions)
      .set({})
      .where(eq(transactions.id, order.id));

    console.log(`Order ${order.id} with reference ${reference} marked as paid`);

    return {
      success: true,
      message: 'Order payment confirmed',
      orderId: order.id,
      reference,
      amount: amount / 100 // Paystack amount is in kobo (smallest currency unit)
    };
  } catch (error) {
    console.error('Error processing Paystack webhook:', error);
    return {
      success: false,
      message: 'Error processing webhook'
    };
  }
}

/**
 * Handles Flutterwave webhook events
 * @param signature verif-hash header value
 * @param payload Request body as string
 * @returns Result indicating success or failure
 */
export async function handleFlutterwaveWebhook(
  signature: string,
  payload: string
): Promise<WebhookHandlerResult> {
  // Validate signature using verif-hash
  if (!FLUTTERWAVE_WEBHOOK_HASH) {
    console.error('Flutterwave webhook hash not found in environment');
    return { success: false, message: 'Payment processor not properly configured' };
  }

  if (signature !== FLUTTERWAVE_WEBHOOK_HASH) {
    console.error('Invalid Flutterwave webhook hash');
    return { success: false, message: 'Invalid signature' };
  }

  // Parse the payload
  let event;
  try {
    event = JSON.parse(payload);
  } catch (error) {
    console.error('Failed to parse Flutterwave webhook payload', error);
    return { success: false, message: 'Invalid payload format' };
  }

  // We're only interested in successful charge events
  if (event.event !== 'charge.completed' || event.data.status !== 'successful') {
    return {
      success: true,
      message: `Ignored event: ${event.event} with status: ${event.data?.status}`
    };
  }

  const { tx_ref, amount, currency } = event.data;
  const reference = tx_ref; // Flutterwave uses tx_ref as reference

  if (!reference) {
    return {
      success: false,
      message: 'No reference provided in webhook payload'
    };
  }

  try {
    // Find the transaction/order with this reference
    const results = await db.select()
      .from(transactions)
      .where(eq(transactions.id, Number(reference)));

    const order = results[0];

    if (!order) {
      console.error(`No order found with reference: ${reference}`);
      return {
        success: false,
        message: 'Order not found',
        reference
      };
    }

    // If order is already paid, avoid duplicate processing
    if (order.status === 'completed') {
      return {
        success: true,
        message: 'Order already marked as paid',
        orderId: order.id,
        reference
      };
    }

    // Update the order status
    await db.update(transactions)
      .set({})
      .where(eq(transactions.id, order.id));

    console.log(`Order ${order.id} with reference ${reference} marked as paid`);

    return {
      success: true,
      message: 'Order payment confirmed',
      orderId: order.id,
      reference,
      amount
    };
  } catch (error) {
    console.error('Error processing Flutterwave webhook:', error);
    return {
      success: false,
      message: 'Error processing webhook'
    };
  }
}
