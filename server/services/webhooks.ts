import crypto from 'crypto';

import * as schema from '@shared/schema';
import { NewSubscription } from '@shared/schema'; // Import NewSubscription
import { prepareSubscriptionData } from '@shared/schema-helpers';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod'; // Import Zod

import { db } from '../db';
import { applyReferralDiscount, processAffiliateCommission } from './affiliate';
import { AffiliateService } from './affiliate/service';
import { PaymentService } from './payment/payment-service';

// Zod Schemas for Paystack Payloads
const PaystackCustomerMetadataSchema = z.object({
  user_id: z.preprocess(
    val => (val ? parseInt(String(val), 10) : undefined),
    z.number().optional()
  ), // Ensure user_id is number
  referral_code: z.string().optional(),
});

const PaystackCustomerSchema = z.object({
  customer_code: z.string(),
  email: z.string().email().optional(), // email might not always be present initially
  metadata: PaystackCustomerMetadataSchema.optional(), // metadata might not always be present
});

const PaystackPlanSchema = z.object({
  name: z.string(),
  interval: z.string(), // e.g., 'monthly', 'annually'
  plan_code: z.string().optional(), // plan_code might be present in charge.success
});

const PaystackSubscriptionCreateDataSchema = z.object({
  customer: PaystackCustomerSchema,
  plan: PaystackPlanSchema,
  amount: z.number(), // Amount in kobo
  currency: z.string(),
  reference: z.string(),
  subscription_code: z.string(),
  domain: z.string(), // e.g. 'test' or 'live'
  status: z.string(), // e.g. 'active'
  // Add other relevant fields if needed
});

const PaystackChargeSuccessDataSchema = z.object({
  reference: z.string(),
  status: z.string(), // Should be 'success'
  amount: z.preprocess(
    val => (typeof val === 'string' ? parseInt(String(val), 10) : val),
    z.number()
  ), // Amount in kobo
  paid_at: z.string().datetime(),
  currency: z.string(),
  customer: PaystackCustomerSchema,
  plan: z.union([PaystackPlanSchema, z.object({}), z.string()]).optional(), // Plan can be an object, empty object, or string (plan_code)
  subscription: z.object({ subscription_code: z.string() }).optional(),
  metadata: z.any().optional(), // Allow any metadata for flexibility
  // Add other relevant fields if needed
});

const PaystackSubscriptionDisableDataSchema = z.object({
  subscription_code: z.string(),
  customer: PaystackCustomerSchema,
  plan: PaystackPlanSchema,
  status: z.string(), // e.g., 'cancelled', 'disabled', 'expired'
  // Add other relevant fields if needed
});

// Zod Schemas for Flutterwave Payloads
const FlutterwaveCustomerMetadataSchema = z.object({
  user_id: z.string().optional(),
  referral_code: z.string().optional(),
});

const FlutterwaveCustomerSchema = z.object({
  id: z.preprocess(val => (val ? parseInt(String(val), 10) : undefined), z.number().optional()), // Ensure id is number
  email: z.string().email(),
  name: z.string().optional(),
  phone_number: z.string().optional(),
  meta: FlutterwaveCustomerMetadataSchema.optional(),
  // Add other relevant fields if needed
});

const FlutterwavePlanSchema = z.object({
  id: z.number().optional(),
  name: z.string(),
  // Add other relevant fields if needed
});

const FlutterwaveSubscriptionCreateDataSchema = z.object({
  id: z.preprocess(val => (typeof val === 'string' ? parseInt(val, 10) : val), z.number()), // Subscription ID from Flutterwave
  customer: FlutterwaveCustomerSchema,
  plan: FlutterwavePlanSchema,
  amount: z.preprocess(val => (typeof val === 'string' ? parseFloat(val) : val), z.number()),
  currency: z.string(),
  status: z.string(), // e.g., 'active'
  created_at: z.string().datetime(),
  plan_interval: z.string().optional(),
  // Add other relevant fields if needed
});

const FlutterwaveChargeCompletedDataSchema = z.object({
  id: z.preprocess(val => (typeof val === 'string' ? parseInt(val, 10) : val), z.number()), // Transaction ID
  tx_ref: z.string(),
  flw_ref: z.string(),
  status: z.string(), // Should be 'successful'
  amount: z.preprocess(val => (typeof val === 'string' ? parseFloat(val) : val), z.number()),
  currency: z.string(),
  charged_amount: z.preprocess(
    val => (typeof val === 'string' ? parseFloat(val) : val),
    z.number()
  ),
  customer: FlutterwaveCustomerSchema,
  payment_type: z.string(),
  created_at: z.string().datetime(),
  meta: z.record(z.unknown()).optional(),
  // Add other relevant fields if needed
});

const FlutterwaveSubscriptionCancelledDataSchema = z.object({
  id: z.number(), // Subscription ID
  status: z.string(), // e.g., 'cancelled'
  customer: FlutterwaveCustomerSchema,
  plan: FlutterwavePlanSchema,
  // Add other relevant fields if needed
});

/**
 * Verify Paystack webhook signature
 */
function verifyPaystackSignature(signature: string, payload: string): boolean {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      console.warn('PAYSTACK_SECRET_KEY not set, webhook verification disabled');
      return true;
    }

    const hash = crypto.createHmac('sha512', secret).update(payload).digest('hex');
    return hash === signature;
  } catch (error: unknown) {
    console.error('Error verifying Paystack signature:', error);
    return false;
  }
}

/**
 * Verify Flutterwave webhook signature
 */
function verifyFlutterwaveSignature(signature: string, payload: string): boolean {
  try {
    const secret = process.env.FLW_SECRET_HASH;
    if (!secret) {
      console.warn('FLW_SECRET_HASH not set, webhook verification disabled');
      return true;
    }

    const hash = crypto.createHmac('sha512', secret).update(payload).digest('hex');
    return hash === signature;
  } catch (error: unknown) {
    console.error('Error verifying Flutterwave signature:', error);
    return false;
  }
}

/**
 * Handle Paystack webhook events
 */
export async function handlePaystackWebhook(
  signature: string,
  rawPayload: string
): Promise<boolean> {
  try {
    // Verify the webhook signature
    if (!verifyPaystackSignature(signature, rawPayload)) {
      console.error('Invalid Paystack webhook signature');
      return false;
    }

    const payload = JSON.parse(rawPayload);
    const event = payload.event;

    // Handle different Paystack events
    switch (event) {
      case 'subscription.create':
        // New subscription created
        return await handlePaystackSubscriptionCreate(payload.data);

      case 'charge.success':
        // Successful payment
        return await handlePaystackChargeSuccess(payload.data);

      case 'subscription.disable':
        // Subscription cancelled or expired
        return await handlePaystackSubscriptionDisable(payload.data);

      default:
        console.log(`Unhandled Paystack event: ${event}`);
        return true;
    }
  } catch (error: unknown) {
    console.error('Error handling Paystack webhook:', error);
    return false;
  }
}

/**
 * Handle Flutterwave webhook events
 */
export async function handleFlutterwaveWebhook(
  signature: string,
  rawPayload: string
): Promise<boolean> {
  try {
    // Verify the webhook signature
    if (!verifyFlutterwaveSignature(signature, rawPayload)) {
      console.error('Invalid Flutterwave webhook signature');
      return false;
    }

    const payload = JSON.parse(rawPayload);
    const event = payload.event;

    // Handle different Flutterwave events
    switch (event) {
      case 'subscription.create':
        // New subscription created
        return await handleFlutterwaveSubscriptionCreate(payload.data);

      case 'charge.completed':
        // Successful payment
        return await handleFlutterwaveChargeCompleted(payload.data);

      case 'subscription.cancelled':
        // Subscription cancelled
        return await handleFlutterwaveSubscriptionCancelled(payload.data);

      default:
        console.log(`Unhandled Flutterwave event: ${event}`);
        return true;
    }
  } catch (error: unknown) {
    console.error('Error handling Flutterwave webhook:', error);
    return false;
  }
}

/**
 * Handle Paystack subscription create event
 */
async function handlePaystackSubscriptionCreate(rawData: unknown): Promise<boolean> {
  try {
    const validationResult = PaystackSubscriptionCreateDataSchema.safeParse(rawData);
    if (!validationResult.success) {
      console.error(
        'Invalid Paystack subscription.create payload:',
        validationResult.error.flatten().fieldErrors
      );
      return false;
    }
    const data = validationResult.data;

    const userId = data.customer.metadata?.user_id;
    if (typeof userId !== 'number') {
      // Check if userId is a number after Zod parsing
      console.error(
        "User ID is missing or not a number in Paystack subscription.create payload's customer metadata"
      );
      return false;
    }
    const numericUserId = userId; // Assign to new const for type narrowing

    const plan = data.plan.name.toLowerCase();
    const referralCode = data.customer.metadata?.referral_code;
    const amountInNaira = data.amount / 100; // Amount from Zod is in kobo, convert to Naira
    const currency = data.currency;

    let discountAmount = 0;
    let discountedAmount = amountInNaira;

    if (referralCode) {
      const discountResult = await applyReferralDiscount(
        userId,
        referralCode,
        amountInNaira,
        currency
      ); // userId is number
      discountAmount = discountResult.discountAmount;
      discountedAmount = discountResult.discountedAmount;
    }

    const startDate = new Date();
    const endDate = new Date();
    if (data.plan.interval === 'annually') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }
    // Removed redeclared currency and discountedAmount variables
    // Removed redundant userId === null check as userId is validated earlier

    const subscriptionData: NewSubscription = {
      userId: numericUserId, // userId is confirmed to be a number by earlier checks
      plan: plan,
      status: 'active',
      amount: discountedAmount.toString(), // Use the calculated discountedAmount
      currency: currency, // Use the original currency variable declared earlier
      referralCode: referralCode || undefined,
      discountApplied: discountAmount > 0,
      discountAmount: discountAmount.toString(),
      startDate,
      endDate,
      autoRenew: true,
      paymentProvider: 'paystack',
      paymentReference: data.reference,
      metadata: {
        paystackCode: data.subscription_code,
        paystackCustomerCode: data.customer.customer_code,
      },
    };

    const preparedData = prepareSubscriptionData(subscriptionData);
    await db.insert(schema.subscriptions).values(preparedData);

    if (referralCode) {
      await processAffiliateCommission(userId, discountedAmount, currency); // userId is number
    }

    return true;
  } catch (error: unknown) {
    console.error('Error handling Paystack subscription create:', error);
    return false;
  }
}

/**
 * Handle Paystack charge success event
 */
async function handlePaystackChargeSuccess(rawData: unknown): Promise<boolean> {
  try {
    const PaystackChargeSuccessDataSchemaWithAmountFix = PaystackChargeSuccessDataSchema.extend({
      amount: z.preprocess(
        val => (typeof val === 'string' ? parseInt(String(val), 10) : val),
        z.number()
      ), // Amount in kobo, allow string input
    });
    const validationResult = PaystackChargeSuccessDataSchemaWithAmountFix.safeParse(rawData);
    if (!validationResult.success) {
      console.error(
        'Invalid Paystack charge.success payload:',
        validationResult.error.flatten().fieldErrors
      );
      return false;
    }
    const data = validationResult.data;
    const metadata = data.metadata || {}; // data.metadata can be any

    let userId: number | undefined;
    if (data.customer?.metadata?.user_id) {
      const parsedUserId = parseInt(String(data.customer.metadata.user_id), 10);
      if (!isNaN(parsedUserId)) {
        userId = parsedUserId;
      }
    } else if (metadata.user_id) {
      const parsedMetaUserId = parseInt(String(metadata.user_id), 10);
      if (!isNaN(parsedMetaUserId)) {
        userId = parsedMetaUserId;
      }
    }

    if (typeof userId !== 'number' && !data.subscription?.subscription_code) {
      console.warn(
        'User ID not found or not a number in Paystack charge.success payload, and not a clear subscription renewal.'
      );
      return true;
    }

    const subscriptionCode = data.subscription?.subscription_code || metadata?.subscription_code;
    if (subscriptionCode) {
      const [subscription] = await db
        .select()
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.paymentReference, data.reference))
        .limit(1);

      if (subscription) {
        if (subscription.referralCode && subscription.userId === userId) {
          if (subscription.userId !== null) {
            await processAffiliateCommission(
              subscription.userId, // number
              parseFloat(subscription.amount.toString()),
              subscription.currency || 'NGN' // Provide default if null
            );
          }
        }

        const newEndDate = new Date(subscription.endDate);
        const planInterval =
          (data.plan && typeof data.plan !== 'string' && 'interval' in data.plan
            ? data.plan.interval
            : metadata?.plan_interval) || 'monthly';

        if (planInterval === 'annually') {
          newEndDate.setFullYear(newEndDate.getFullYear() + 1);
        } else {
          newEndDate.setMonth(newEndDate.getMonth() + 1);
        }

        await db
          .update(schema.subscriptions)
          .set({
            endDate: newEndDate,
            status: 'active',
            updatedAt: new Date(),
          })
          .where(eq(schema.subscriptions.id, subscription.id));
      } else {
        console.warn(
          `Subscription not found for charge.success with reference: ${data.reference} and subscription code: ${subscriptionCode}`
        );
      }
    } else if (typeof userId === 'number' && metadata.is_subscription_creation) {
      console.log(
        `Charge success for user ${userId}, potentially a new subscription or one-time payment.`
      );
    }

    return true;
  } catch (error: unknown) {
    console.error('Error handling Paystack charge success:', error);
    return false;
  }
}

/**
 * Handle Paystack subscription disable event
 */
async function handlePaystackSubscriptionDisable(rawData: unknown): Promise<boolean> {
  try {
    const validationResult = PaystackSubscriptionDisableDataSchema.safeParse(rawData);
    if (!validationResult.success) {
      console.error(
        'Invalid Paystack subscription.disable payload:',
        validationResult.error.flatten().fieldErrors
      );
      return false;
    }
    const data = validationResult.data;
    const [subscription] = await db
      .select()
      .from(schema.subscriptions)
      .where(
        and(
          eq(schema.subscriptions.paymentProvider, 'paystack'),
          eq(schema.subscriptions.paymentReference, data.subscription_code)
        )
      )
      .limit(1);

    if (subscription) {
      await db
        .update(schema.subscriptions)
        .set({
          status: 'cancelled',
          autoRenew: false,
          updatedAt: new Date(),
        })
        .where(eq(schema.subscriptions.id, subscription.id));
    } else {
      console.warn(
        `Subscription not found for disable event with subscription_code: ${data.subscription_code}`
      );
    }

    return true;
  } catch (error: unknown) {
    console.error('Error handling Paystack subscription disable:', error);
    return false;
  }
}

async function handleFlutterwaveSubscriptionCreate(rawData: unknown): Promise<boolean> {
  try {
    const validationResult = FlutterwaveSubscriptionCreateDataSchema.safeParse(rawData);
    if (!validationResult.success) {
      console.error(
        'Invalid Flutterwave subscription.create payload:',
        validationResult.error.flatten().fieldErrors
      );
      return false;
    }
    const data = validationResult.data;
    // Extract user and subscription details
    let userId: number | undefined = data.customer?.id; // id from FlutterwaveCustomerSchema is already number
    if (!userId && data.customer?.meta?.user_id) {
      const metaUserId = parseInt(data.customer.meta.user_id, 10);
      if (!isNaN(metaUserId)) userId = metaUserId;
    }

    if (typeof userId !== 'number') {
      console.error(
        'User ID is missing or not a number in Flutterwave subscription.create payload'
      );
      return false;
    }
    const numericUserId = userId; // Assign to new const for type narrowing
    const plan = data.plan?.name?.toLowerCase();
    const referralCode = data.customer?.meta?.referral_code;
    const amount = data.amount; // Amount is already a number from Zod
    const currency = data.currency || 'NGN';

    // If there's a referral code, apply the discount
    let discountAmount = 0;
    let discountedAmount = amount;

    if (referralCode) {
      const discountResult = await applyReferralDiscount(userId, referralCode, amount, currency); // userId is number
      discountAmount = discountResult.discountAmount;
      discountedAmount = discountResult.discountedAmount;
    }

    // Calculate subscription period
    const startDate = new Date();
    const endDate = new Date();

    if (data.plan_interval === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      // Default to monthly
      endDate.setMonth(endDate.getMonth() + 1);
    }
    // Removed redeclared currency and discountedAmount variables
    // Removed redundant userId === null check as userId is validated earlier

    const subscriptionData: NewSubscription = {
      userId: numericUserId, // userId is confirmed to be a number by earlier checks
      plan: plan,
      status: 'active',
      amount: discountedAmount.toString(), // Use the calculated discountedAmount
      currency: currency, // Use the original currency variable declared earlier
      referralCode: referralCode || undefined,
      discountApplied: discountAmount > 0,
      discountAmount: discountAmount.toString(),
      startDate,
      endDate,
      autoRenew: true,
      paymentProvider: 'flutterwave',
      paymentReference: data.id.toString(), // Use Flutterwave subscription ID as reference
      metadata: { flutterwaveSubscriptionId: data.id }, // Store as object
    };

    // Use schema helper to prepare subscription data
    // This handles fields like status and updatedAt that might cause schema mismatches
    const preparedData = prepareSubscriptionData(subscriptionData);
    await db.insert(schema.subscriptions).values(preparedData);

    // Process affiliate commission if applicable
    if (referralCode) {
      await processAffiliateCommission(userId, discountedAmount, currency); // userId is number
    }

    return true;
  } catch (error: unknown) {
    console.error('Error handling Flutterwave subscription create:', error);
    return false;
  }
}

/**
 * Handle Flutterwave charge completed event
 */
async function handleFlutterwaveChargeCompleted(rawData: unknown): Promise<boolean> {
  try {
    const validationResult = FlutterwaveChargeCompletedDataSchema.safeParse(rawData);
    if (!validationResult.success) {
      console.error(
        'Invalid Flutterwave charge.completed payload:',
        validationResult.error.flatten().fieldErrors
      );
      return false;
    }
    const data = validationResult.data;
    // Extract metadata
    const meta = data.meta || {};
    const userId = (data.meta as any)?.user_id as string | undefined;
    const subscriptionId = (data.meta as any)?.subscription_id as string | undefined;

    // Skip if not related to a subscription
    if (!meta.is_subscription) {
      return true;
    }

    // Check if this is a subscription renewal
    if (subscriptionId) {
      // Find the subscription
      const [subscription] = await db
        .select()
        .from(schema.subscriptions)
        .where(
          eq(
            schema.subscriptions.metadata,
            JSON.stringify({
              flwSubscriptionId: meta.subscription_id,
              flwCustomerId: data.customer?.id,
            })
          )
        )
        .limit(1);

      if (subscription) {
        // Process the affiliate commission if this is a referred subscription
        if (subscription.referralCode) {
          if (subscription.userId !== null) {
            await processAffiliateCommission(
              subscription.userId,
              parseFloat(subscription.amount.toString()),
              subscription.currency || 'NGN' // Provide default if null
            );
          }
        }

        // Update the subscription end date
        const newEndDate = new Date(subscription.endDate);
        if (meta.plan_interval === 'yearly') {
          newEndDate.setFullYear(newEndDate.getFullYear() + 1);
        } else {
          newEndDate.setMonth(newEndDate.getMonth() + 1);
        }

        await db
          .update(schema.subscriptions)
          .set({
            endDate: newEndDate,
            status: 'active',
            updatedAt: new Date(),
          })
          .where(eq(schema.subscriptions.id, subscription.id));
      }
    }

    return true;
  } catch (error: unknown) {
    console.error('Error handling Flutterwave charge completed:', error);
    return false;
  }
}

/**
 * Handle Flutterwave subscription cancelled event
 */
async function handleFlutterwaveSubscriptionCancelled(rawData: unknown): Promise<boolean> {
  try {
    const validationResult = FlutterwaveSubscriptionCancelledDataSchema.safeParse(rawData);
    if (!validationResult.success) {
      console.error(
        'Invalid Flutterwave subscription.cancelled payload:',
        validationResult.error.flatten().fieldErrors
      );
      return false;
    }
    const data = validationResult.data;
    // Find the subscription
    const [subscription] = await db
      .select()
      .from(schema.subscriptions)
      .where(
        eq(
          schema.subscriptions.metadata,
          JSON.stringify({
            flwSubscriptionId: data.id,
            flwCustomerId: data.customer?.id,
          })
        )
      )
      .limit(1);

    if (subscription) {
      // Update the subscription status
      await db
        .update(schema.subscriptions)
        .set({
          status: 'cancelled',
          autoRenew: false,
          updatedAt: new Date(),
        })
        .where(eq(schema.subscriptions.id, subscription.id));
    }

    return true;
  } catch (error: unknown) {
    console.error('Error handling Flutterwave subscription cancelled:', error);
    return false;
  }
}
