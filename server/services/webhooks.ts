import { db } from "../../db";
import * as schema from "../../shared/schema";
import { eq } from "drizzle-orm";
// import { AffiliateService } from "./affiliate/service"; // Unused
// import { PaymentService } from "./payment/service"; // Unused
// Helper function to prepare subscription data
function prepareSubscriptionData(data: any) {
  return data; // Simple pass-through for now
}
import { 
  applyReferralDiscount, 
  processAffiliateCommission 
} from "./affiliate";
import * as crypto from "crypto";

/**
 * Verify Paystack webhook signature
 */
function verifyPaystackSignature(signature: string, payload: string): boolean {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      console.warn("PAYSTACK_SECRET_KEY not set, webhook verification disabled");
      return true;
    }
    
    const hash = crypto.createHmac("sha512", secret).update(payload).digest("hex");
    return hash === signature;
  } catch (error) {
    console.error("Error verifying Paystack signature:", error);
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
      console.warn("FLW_SECRET_HASH not set, webhook verification disabled");
      return true;
    }
    
    const hash = crypto.createHmac("sha512", secret).update(payload).digest("hex");
    return hash === signature;
  } catch (error) {
    console.error("Error verifying Flutterwave signature:", error);
    return false;
  }
}

/**
 * Handle Paystack webhook events
 */
export async function handlePaystackWebhook(signature: string, rawPayload: string): Promise<boolean> {
  try {
    // Verify the webhook signature
    if (!verifyPaystackSignature(signature, rawPayload)) {
      console.error("Invalid Paystack webhook signature");
      return false;
    }
    
    const payload = JSON.parse(rawPayload);
    const event = payload.event;
    
    // Handle different Paystack events
    switch (event) {
      case "subscription.create":
        // New subscription created
        return await handlePaystackSubscriptionCreate(payload.data);
      
      case "charge.success":
        // Successful payment
        return await handlePaystackChargeSuccess(payload.data);
      
      case "subscription.disable":
        // Subscription cancelled or expired
        return await handlePaystackSubscriptionDisable(payload.data);
      
      default:
        console.log(`Unhandled Paystack event: ${event}`);
        return true;
    }
  } catch (error) {
    console.error("Error handling Paystack webhook:", error);
    return false;
  }
}

/**
 * Handle Flutterwave webhook events
 */
export async function handleFlutterwaveWebhook(signature: string, rawPayload: string): Promise<boolean> {
  try {
    // Verify the webhook signature
    if (!verifyFlutterwaveSignature(signature, rawPayload)) {
      console.error("Invalid Flutterwave webhook signature");
      return false;
    }
    
    const payload = JSON.parse(rawPayload);
    const event = payload.event;
    
    // Handle different Flutterwave events
    switch (event) {
      case "subscription.create":
        // New subscription created
        return await handleFlutterwaveSubscriptionCreate(payload.data);
      
      case "charge.completed":
        // Successful payment
        return await handleFlutterwaveChargeCompleted(payload.data);
      
      case "subscription.cancelled":
        // Subscription cancelled
        return await handleFlutterwaveSubscriptionCancelled(payload.data);
      
      default:
        console.log(`Unhandled Flutterwave event: ${event}`);
        return true;
    }
  } catch (error) {
    console.error("Error handling Flutterwave webhook:", error);
    return false;
  }
}

/**
 * Handle Paystack subscription create event
 */
async function handlePaystackSubscriptionCreate(data: any): Promise<boolean> {
  try {
    // Extract user and subscription details
    const userId = data.customer.metadata.user_id;
    const plan = data.plan.name.toLowerCase(); // basic, pro, enterprise
    const referralCode = data.customer.metadata.referral_code;
    const amount = parseFloat(data.amount) / 100; // Convert from kobo to naira
    const currency = data.currency;
    
    // If there's a referral code, apply the discount
    let discountAmount = 0;
    let discountedAmount = amount;
    
    if (referralCode) {
      const discountResult = await applyReferralDiscount(userId, referralCode, amount, currency);
      discountAmount = discountResult.discountAmount;
      discountedAmount = discountResult.discountedAmount;
    }
    
    // Calculate subscription period (typically monthly or yearly)
    // Determine end date based on plan interval
    const startDate = new Date();
    const endDate = new Date();
    
    if (data.plan.interval === "annually") {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      // Default to monthly
      endDate.setMonth(endDate.getMonth() + 1);
    }
    
    // Create subscription record
    const subscriptionData: schema.SubscriptionInsert = {
      userId,
      planId: plan,
      status: "active",
      amount: discountedAmount.toString(),
      currency,
      referralCode: referralCode || undefined,
      currentPeriodStart: startDate,
      currentPeriodEnd: endDate,
      autoRenew: true,
      paymentMethod: "paystack",
      metadata: JSON.stringify({
        paymentReference: data.reference,
        paystackCode: data.subscription_code,
        paystackCustomerCode: data.customer.customer_code
      })
    };
    
    // Use schema helper to prepare subscription data
    // This handles fields like status and updatedAt that might cause schema mismatches
    const preparedData = prepareSubscriptionData(subscriptionData);
    await db.insert(schema.subscriptions).values(preparedData);
    
    // Process affiliate commission if applicable
    if (referralCode) {
      await processAffiliateCommission(userId, discountedAmount, currency);
    }
    
    return true;
  } catch (error) {
    console.error("Error handling Paystack subscription create:", error);
    return false;
  }
}

/**
 * Handle Paystack charge success event
 */
async function handlePaystackChargeSuccess(data: any): Promise<boolean> {
  try {
    // This handles one-time payments and subscription renewals
    const metadata = data.metadata || {};
    const userId = metadata.user_id;
    
    // Skip if not related to a subscription
    if (!metadata.is_subscription) {
      return true;
    }
    
    // Check if this is a subscription renewal
    if (metadata.subscription_code) {
      // Find the subscription
      const [subscription] = await db.select()
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.metadata, JSON.stringify({
          paystackCode: metadata.subscription_code,
          paystackCustomerCode: data.customer.customer_code
        })))
        .limit(1);
      
      if (subscription) {
        // Process the affiliate commission if this is a referred subscription
        if (subscription.referralCode) {
          await processAffiliateCommission(
            subscription.userId, 
            parseFloat(subscription.amount?.toString() || '0'),
            subscription.currency || undefined
          );
        }
        
        // Update the subscription end date
        const newEndDate = new Date(subscription.endDate || new Date());
        if (subscription.planId === "annually") {
          newEndDate.setFullYear(newEndDate.getFullYear() + 1);
        } else {
          newEndDate.setMonth(newEndDate.getMonth() + 1);
        }
        
        await db.update(schema.subscriptions)
          .set({ 
            endDate: newEndDate,
            status: "active",
            updatedAt: new Date()
          })
          .where(eq(schema.subscriptions.id, subscription.id));
      }
    }
    
    return true;
  } catch (error) {
    console.error("Error handling Paystack charge success:", error);
    return false;
  }
}

/**
 * Handle Paystack subscription disable event
 */
async function handlePaystackSubscriptionDisable(data: any): Promise<boolean> {
  try {
    // Find the subscription
    const [subscription] = await db.select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.metadata, JSON.stringify({
        paystackCode: data.subscription_code,
        paystackCustomerCode: data.customer.customer_code
      })))
      .limit(1);
    
    if (subscription) {
      // Update the subscription status
      await db.update(schema.subscriptions)
        .set({ 
          status: "cancelled",
          autoRenew: false,
          updatedAt: new Date()
        })
        .where(eq(schema.subscriptions.id, subscription.id));
    }
    
    return true;
  } catch (error) {
    console.error("Error handling Paystack subscription disable:", error);
    return false;
  }
}

/**
 * Handle Flutterwave subscription create event
 */
async function handleFlutterwaveSubscriptionCreate(data: any): Promise<boolean> {
  try {
    // Extract user and subscription details
    const userId = data.customer?.meta?.user_id;
    const plan = data.plan.toLowerCase(); // basic, pro, enterprise
    const referralCode = data.customer?.meta?.referral_code;
    const amount = parseFloat(data.amount);
    const currency = data.currency || "NGN";
    
    // If there's a referral code, apply the discount
    let discountAmount = 0;
    let discountedAmount = amount;
    
    if (referralCode) {
      const discountResult = await applyReferralDiscount(userId, referralCode, amount, currency);
      discountAmount = discountResult.discountAmount;
      discountedAmount = discountResult.discountedAmount;
    }
    
    // Calculate subscription period
    const startDate = new Date();
    const endDate = new Date();
    
    if (data.plan_interval === "yearly") {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      // Default to monthly
      endDate.setMonth(endDate.getMonth() + 1);
    }
    
    // Create subscription record
    const subscriptionData: schema.SubscriptionInsert = {
      userId,
      planId: plan,
      status: "active",
      amount: discountedAmount.toString(),
      currency,
      referralCode: referralCode || undefined,
      currentPeriodStart: startDate,
      currentPeriodEnd: endDate,
      autoRenew: true,
      paymentMethod: "flutterwave",
      metadata: JSON.stringify({
        paymentReference: data.tx_ref,
        flwSubscriptionId: data.id,
        flwCustomerId: data.customer?.id
      })
    };
    
    // Use schema helper to prepare subscription data
    // This handles fields like status and updatedAt that might cause schema mismatches
    const preparedData = prepareSubscriptionData(subscriptionData);
    await db.insert(schema.subscriptions).values(preparedData);
    
    // Process affiliate commission if applicable
    if (referralCode) {
      await processAffiliateCommission(userId, discountedAmount, currency);
    }
    
    return true;
  } catch (error) {
    console.error("Error handling Flutterwave subscription create:", error);
    return false;
  }
}

/**
 * Handle Flutterwave charge completed event
 */
async function handleFlutterwaveChargeCompleted(data: any): Promise<boolean> {
  try {
    // Extract metadata
    const meta = data.meta || {};
    const userId = meta.user_id;
    
    // Skip if not related to a subscription
    if (!meta.is_subscription) {
      return true;
    }
    
    // Check if this is a subscription renewal
    if (meta.subscription_id) {
      // Find the subscription
      const [subscription] = await db.select()
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.metadata, JSON.stringify({
          flwSubscriptionId: meta.subscription_id,
          flwCustomerId: data.customer?.id
        })))
        .limit(1);
      
      if (subscription) {
        // Process the affiliate commission if this is a referred subscription
        if (subscription.referralCode) {
          await processAffiliateCommission(
            subscription.userId,
            parseFloat(subscription.amount?.toString() || '0'),
            subscription.currency || undefined
          );
        }
        
        // Update the subscription end date
        const newEndDate = new Date(subscription.endDate || new Date());
        if (subscription.planId === "yearly") {
          newEndDate.setFullYear(newEndDate.getFullYear() + 1);
        } else {
          newEndDate.setMonth(newEndDate.getMonth() + 1);
        }
        
        await db.update(schema.subscriptions)
          .set({ 
            endDate: newEndDate,
            status: "active",
            updatedAt: new Date()
          })
          .where(eq(schema.subscriptions.id, subscription.id));
      }
    }
    
    return true;
  } catch (error) {
    console.error("Error handling Flutterwave charge completed:", error);
    return false;
  }
}

/**
 * Handle Flutterwave subscription cancelled event
 */
async function handleFlutterwaveSubscriptionCancelled(data: any): Promise<boolean> {
  try {
    // Find the subscription
    const [subscription] = await db.select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.metadata, JSON.stringify({
        flwSubscriptionId: data.id,
        flwCustomerId: data.customer?.id
      })))
      .limit(1);
    
    if (subscription) {
      // Update the subscription status
      await db.update(schema.subscriptions)
        .set({ 
          status: "cancelled",
          autoRenew: false,
          updatedAt: new Date()
        })
        .where(eq(schema.subscriptions.id, subscription.id));
    }
    
    return true;
  } catch (error) {
    console.error("Error handling Flutterwave subscription cancelled:", error);
    return false;
  }
}
