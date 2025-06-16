import Paystack from 'paystack-node';
import Flutterwave from 'flutterwave-node-v3';
import { db } from '../../db';
import * as schema from '@shared/schema';
import { eq } from 'drizzle-orm';

// Type declaration for modules without types
// This is a simpler approach that avoids augmentation issues
type PaystackClient = any;
type FlutterwaveClient = any;

// Initialize payment providers
const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
const paystackPublicKey = process.env.PAYSTACK_PUBLIC_KEY;
const flutterwaveSecretKey = process.env.FLUTTERWAVE_SECRET_KEY;
const flutterwavePublicKey = process.env.FLUTTERWAVE_PUBLIC_KEY;

// Initialize Paystack
let paystack: PaystackClient = null;
try {
  if (paystackSecretKey) {
    paystack = new Paystack(paystackSecretKey);
    console.log('Paystack initialized successfully');
  } else {
    console.log('Paystack credentials not found. Payments will be simulated.');
    // Log the environment variables (but not their values) to help with debugging
    console.log('Available Paystack-related environment variables:');
    console.log('PAYSTACK_PUBLIC_KEY:', paystackPublicKey ? 'defined' : 'undefined');
    console.log('PAYSTACK_SECRET_KEY:', paystackSecretKey ? 'defined' : 'undefined');
  }
} catch (err) {
  console.error('Error initializing Paystack:', err);
}

// Initialize Flutterwave
let flutterwave: FlutterwaveClient = null;
try {
  if (flutterwaveSecretKey && flutterwavePublicKey) {
    flutterwave = new Flutterwave(flutterwavePublicKey, flutterwaveSecretKey);
    console.log('Flutterwave initialized successfully');
  } else {
    console.log('Flutterwave credentials not found. Payments will be simulated.');
    // Log the environment variables (but not their values) to help with debugging
    console.log('Available Flutterwave-related environment variables:');
    console.log('FLUTTERWAVE_PUBLIC_KEY:', flutterwavePublicKey ? 'defined' : 'undefined');
    console.log('FLUTTERWAVE_SECRET_KEY:', flutterwaveSecretKey ? 'defined' : 'undefined');
  }
} catch (err) {
  console.error('Error initializing Flutterwave:', err);
}

/**
 * Determine the appropriate payment provider based on user country
 * @param country User's country (ISO code)
 * @returns Payment provider to use
 */
export function getPaymentProvider(country: string = 'NG'): 'paystack' | 'flutterwave' {
  // Use Paystack for Nigerian users, Flutterwave for everyone else
  return country === 'NG' ? 'paystack' : 'flutterwave';
}

/**
 * Initialize a subscription payment with the appropriate provider
 */
export async function initializeSubscription(
  userId: number,
  email: string,
  amount: number,
  plan: string,
  referralCode?: string,
  country: string = 'NG'
): Promise<{ 
  authorization_url: string; 
  reference: string;
  provider: string;
}> {
  const provider = getPaymentProvider(country);
  let discountedAmount = amount;
  
  // Apply referral discount if applicable
  if (referralCode) {
    try {
      const { applyReferralDiscount } = await import('./affiliate');
      const discountResult = await applyReferralDiscount(userId, referralCode, amount);
      // If discount amount > 0, it means discount was applied
      if (discountResult.discountAmount > 0) {
        discountedAmount = discountResult.discountedAmount;
      }
    } catch (error) {
      console.error('Error applying referral discount:', error);
    }
  }
  
  // Format amount as required by payment providers
  // Paystack expects amount in kobo (multiply by 100)
  // Flutterwave accepts amount in main currency units
  const paystackAmount = Math.round(discountedAmount * 100);
  const flutterwaveAmount = discountedAmount;
  
  // Generate a unique reference/transaction ID
  const reference = `sub_${Date.now()}_${userId}`;
  
  try {
    if (provider === 'paystack' && paystack) {
      const response = await paystack.initializeTransaction({
        reference,
        amount: paystackAmount,
        email,
        metadata: {
          userId,
          plan,
          referralCode
        }
      });
      
      if (response.status && response.data && response.data.authorization_url) {
        return {
          authorization_url: response.data.authorization_url,
          reference,
          provider: 'paystack'
        };
      }
      throw new Error('Failed to initialize Paystack payment');
    } 
    else if (provider === 'flutterwave' && flutterwave) {
      const response = await flutterwave.Charge.card({
        amount: flutterwaveAmount,
        currency: 'USD',
        email,
        tx_ref: reference,
        redirect_url: `${process.env.BASE_URL || 'https://chainsync.repl.co'}/payment-callback`,
        customer: {
          email,
          name: email.split('@')[0]
        },
        meta: {
          userId,
          plan,
          referralCode
        }
      });
      
      if (response.status === 'success' && response.data && response.data.link) {
        return {
          authorization_url: response.data.link,
          reference,
          provider: 'flutterwave'
        };
      }
      throw new Error('Failed to initialize Flutterwave payment');
    }
    
    // Simulation mode for development without API keys
    console.log('Using payment simulation mode');
    return {
      authorization_url: `/payment-simulation?reference=${reference}&amount=${discountedAmount}&plan=${plan}`,
      reference,
      provider: 'simulation'
    };
  } catch (error: unknown) {
    console.error(`Payment initialization error with ${provider}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to initialize payment: ${errorMessage}`);
  }
}

/**
 * Verify a payment with the appropriate provider
 */
export async function verifyPayment(reference: string, provider: string): Promise<{
  status: 'success' | 'failed' | 'pending';
  amount: number;
  metadata: unknown;
}> {
  try {
    // Special handling for simulation mode
    if (provider === 'simulation') {
      const status = reference.includes('fail') ? 'failed' : 'success';
      
      // Extract plan and amount from reference if available
      const matches = reference.match(/plan_([a-z]+)_(\d+)/i);
      const plan = matches ? matches[1] : 'basic';
      const amount = matches ? parseInt(matches[2], 10) : 20000;
      
      console.log(`Simulation payment verification: ${reference}, Status: ${status}`);
      
      return {
        status: status as 'success' | 'failed',
        amount: amount,
        metadata: {
          plan,
          reference,
          simulation: true
        }
      };
    }
    
    if (provider === 'paystack' && paystack) {
      const response = await paystack.verifyTransaction({ reference });
      
      if (response.status && response.data && response.data.status === 'success') {
        return {
          status: 'success',
          amount: response.data.amount / 100, // Convert from kobo back to naira
          metadata: response.data.metadata
        };
      }
      return { status: 'failed', amount: 0, metadata: {} };
    } 
    else if (provider === 'flutterwave' && flutterwave) {
      const response = await flutterwave.Transaction.verify({ id: reference });
      
      if (response.status === 'success' && response.data && response.data.status === 'successful') {
        return {
          status: 'success',
          amount: response.data.amount,
          metadata: response.data.meta
        };
      }
      return { status: 'failed', amount: 0, metadata: {} };
    }
    
    // Fallback simulation mode for development without API keys
    return {
      status: 'success',
      amount: 20000, // Default to ₦20,000 for basic plan
      metadata: { 
        plan: 'basic',
        reference,
        simulation: true
      }
    };
  } catch (error: unknown) {
    console.error(`Payment verification error with ${provider}:`, error);
    return { status: 'failed', amount: 0, metadata: {} };
  }
}

/**
 * Process a subscription payment
 */
export async function processSubscriptionPayment(
  userId: number, 
  planId: string, 
  amount: number,
  reference: string,
  provider: string
): Promise<schema.Subscription> {
  try {
    // Get plan details
    const planTiers: {[key: string]: {name: string, storeLimit: number, features: string[]}} = {
      'basic': {
        name: 'Basic Plan',
        storeLimit: 1,
        features: ['POS System', 'Inventory Management', 'Basic Reports', 'AI Assistant']
      },
      'pro': {
        name: 'Pro Plan',
        storeLimit: 10,
        features: ['All Basic Features', 'Advanced Analytics', 'Advanced AI with Inventory Optimization', 'Multiple Store Management']
      },
      'enterprise': {
        name: 'Enterprise Plan',
        storeLimit: 999,
        features: ['All Pro Features', 'Custom Integrations', 'Dedicated Support', 'Unlimited Stores']
      }
    };
    
    // Default to basic plan if invalid plan provided
    const plan = planTiers[planId] || planTiers.basic;
    
    // Calculate next billing date (1 month from now)
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);
    
    // Create subscription in database
    const subscriptionData: schema.SubscriptionInsert = {
      userId,
      plan: planId,
      amount: amount.toString(), // Convert to string for decimal column
      status: 'active',
      paymentReference: reference,
      paymentProvider: provider,
      startDate,
      endDate,
      autoRenew: true,
      // Store plan features and store limit in metadata as JSON
      metadata: JSON.stringify({
        storeLimit: plan.storeLimit,
        features: plan.features,
        isAnnual: false
      })
    };
    
    // Find existing subscription to update or create new one
    const existingSubscription = await db.query.subscriptions.findFirst({
      where: eq(schema.subscriptions.userId, userId)
    });
    
    let subscription;
    
    if (existingSubscription) {
      // Update existing subscription
      const [updated] = await db.update(schema.subscriptions)
        .set({
          ...subscriptionData,
          updatedAt: new Date()
        })
        .where(eq(schema.subscriptions.id, existingSubscription.id))
        .returning();
      
      subscription = updated;
    } else {
      // Create new subscription
      const [newSubscription] = await db.insert(schema.subscriptions)
        .values(subscriptionData)
        .returning();
      
      subscription = newSubscription;
    }
    
    // Process affiliate commission if applicable
    try {
      const { processAffiliateCommission } = await import('./affiliate');
      await processAffiliateCommission(userId, amount);
    } catch (error) {
      console.error('Error processing affiliate commission:', error);
    }
    
    return subscription;
  } catch (error: unknown) {
    console.error('Error processing subscription payment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to process subscription payment: ${errorMessage}`);
  }
}