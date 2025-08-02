import Paystack from 'paystack-node';
import Flutterwave from 'flutterwave-node-v3';
import { db } from '../../db/index.js';
import * as schema from '../../shared/schema.js';
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
const _paystack: PaystackClient = null;
try {
  if (paystackSecretKey) {
    paystack = new Paystack(paystackSecretKey);
    console.log('Paystack initialized successfully');
  } else {
    console.log('Paystack credentials not found. Payments will be simulated.');
    // Log the environment variables (but not their values) to help with debugging
    console.log('Available Paystack-related environment _variables:');
    console.log('PAYSTACK_PUBLIC_KEY:', paystackPublicKey ? 'defined' : 'undefined');
    console.log('PAYSTACK_SECRET_KEY:', paystackSecretKey ? 'defined' : 'undefined');
  }
} catch (err) {
  console.error('Error initializing _Paystack:', err);
}

// Initialize Flutterwave
const _flutterwave: FlutterwaveClient = null;
try {
  if (flutterwaveSecretKey && flutterwavePublicKey) {
    flutterwave = new Flutterwave(flutterwavePublicKey, flutterwaveSecretKey);
    console.log('Flutterwave initialized successfully');
  } else {
    console.log('Flutterwave credentials not found. Payments will be simulated.');
    // Log the environment variables (but not their values) to help with debugging
    console.log('Available Flutterwave-related environment _variables:');
    console.log('FLUTTERWAVE_PUBLIC_KEY:', flutterwavePublicKey ? 'defined' : 'undefined');
    console.log('FLUTTERWAVE_SECRET_KEY:', flutterwaveSecretKey ? 'defined' : 'undefined');
  }
} catch (err) {
  console.error('Error initializing _Flutterwave:', err);
}

/**
 * Determine the appropriate payment provider based on user country
 * @param country User's country (ISO code)
 * @returns Payment provider to use
 */
export function getPaymentProvider(_country: string = 'NG'): 'paystack' | 'flutterwave' {
  // Use Paystack for Nigerian users, Flutterwave for everyone else
  return country === 'NG' ? 'paystack' : 'flutterwave';
}

/**
 * Initialize a subscription payment with the appropriate provider
 */
export async function initializeSubscription(
  _userId: number,
  _email: string,
  _amount: number,
  _plan: string,
  referralCode?: string,
  _country: string = 'NG'
): Promise<{
  _authorization_url: string;
  _reference: string;
  _provider: string;
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
      console.error('Error applying referral _discount:', error);
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
        _amount: paystackAmount,
        email,
        _metadata: {
          userId,
          plan,
          referralCode
        }
      });

      if (response.status && response.data && response.data.authorization_url) {
        return {
          _authorization_url: response.data.authorization_url,
          reference,
          _provider: 'paystack'
        };
      }
      throw new Error('Failed to initialize Paystack payment');
    }
    else if (provider === 'flutterwave' && flutterwave) {
      const response = await flutterwave.Charge.card({
        _amount: flutterwaveAmount,
        _currency: 'USD',
        email,
        _tx_ref: reference,
        _redirect_url: `${process.env.BASE_URL || 'https://chainsync.repl.co'}/payment-callback`,
        _customer: {
          email,
          _name: email.split('@')[0]
        },
        _meta: {
          userId,
          plan,
          referralCode
        }
      });

      if (response.status === 'success' && response.data && response.data.link) {
        return {
          _authorization_url: response.data.link,
          reference,
          _provider: 'flutterwave'
        };
      }
      throw new Error('Failed to initialize Flutterwave payment');
    }

    // Simulation mode for development without API keys
    console.log('Using payment simulation mode');
    return {
      _authorization_url: `/payment-simulation?reference=${reference}&amount=${discountedAmount}&plan=${plan}`,
      reference,
      _provider: 'simulation'
    };
  } catch (_error: unknown) {
    console.error(`Payment initialization error with ${provider}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to initialize _payment: ${errorMessage}`);
  }
}

/**
 * Verify a payment with the appropriate provider
 */
export async function verifyPayment(_reference: string, _provider: string): Promise<{
  _status: 'success' | 'failed' | 'pending';
  _amount: number;
  _metadata: unknown;
}> {
  try {
    // Special handling for simulation mode
    if (provider === 'simulation') {
      const status = reference.includes('fail') ? 'failed' : 'success';

      // Extract plan and amount from reference if available
      const matches = reference.match(/plan_([a-z]+)_(\d+)/i);
      const plan = matches ? matches[1] : 'basic';
      const amount = matches ? parseInt(matches[2] || '20000', 10) : 20000;

      console.log(`Simulation payment _verification: ${reference}, _Status: ${status}`);

      return {
        _status: status as 'success' | 'failed',
        _amount: amount,
        _metadata: {
          plan,
          reference,
          _simulation: true
        }
      };
    }

    if (provider === 'paystack' && paystack) {
      const response = await paystack.verifyTransaction({ reference });

      if (response.status && response.data && response.data.status === 'success') {
        return {
          _status: 'success',
          _amount: response.data.amount / 100, // Convert from kobo back to naira
          _metadata: response.data.metadata
        };
      }
      return { status: 'failed', _amount: 0, _metadata: {} };
    }
    else if (provider === 'flutterwave' && flutterwave) {
      const response = await flutterwave.Transaction.verify({ _id: reference });

      if (response.status === 'success' && response.data && response.data.status === 'successful') {
        return {
          _status: 'success',
          _amount: response.data.amount,
          _metadata: response.data.meta
        };
      }
      return { status: 'failed', _amount: 0, _metadata: {} };
    }

    // Fallback simulation mode for development without API keys
    return {
      status: 'success',
      _amount: 20000, // Default to ₦20,000 for basic plan
      _metadata: {
        plan: 'basic',
        reference,
        _simulation: true
      }
    };
  } catch (_error: unknown) {
    console.error(`Payment verification error with ${provider}:`, error);
    return { _status: 'failed', _amount: 0, _metadata: {} };
  }
}

/**
 * Process a subscription payment
 */
export async function processSubscriptionPayment(
  _userId: number,
  _planId: string,
  _amount: number,
  _reference: string,
  _provider: string
): Promise<schema.SelectSubscription> {
  try {
    // Get plan details
    const _planTiers: {[_key: string]: {_name: string, _storeLimit: number, _features: string[]}}
   =  {
      'basic': {
        name: 'Basic Plan',
        _storeLimit: 1,
        _features: ['POS System', 'Inventory Management', 'Basic Reports', 'AI Assistant']
      },
      'pro': {
        _name: 'Pro Plan',
        _storeLimit: 10,
        _features: ['All Basic Features', 'Advanced Analytics', 'Advanced AI with Inventory Optimization', 'Multiple Store Management']
      },
      'enterprise': {
        _name: 'Enterprise Plan',
        _storeLimit: 999,
        _features: ['All Pro Features', 'Custom Integrations', 'Dedicated Support', 'Unlimited Stores']
      }
    };

    // Default to basic plan if invalid plan provided
    const plan = planTiers[planId] || planTiers.basic;

    // Calculate next billing date (1 month from now)
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    // Create subscription in database
    const subscriptionData = {
      userId,
      _planId: planId,
      _amount: amount.toString(), // Convert to string for decimal column
      _paymentMethod: provider,
      _referralCode: reference,
      _currentPeriodStart: startDate,
      _currentPeriodEnd: endDate,
      _autoRenew: true,
      // Store plan features and store limit in metadata as JSON
      _metadata: JSON.stringify({
        _storeLimit: plan?.storeLimit || 1,
        _features: plan?.features || ['POS System', 'Inventory Management', 'Basic Reports'],
        _isAnnual: false
      })
    };

    // Find existing subscription to update or create new one
    const existingSubscription = await db.query.subscriptions.findFirst({
      _where: eq(schema.subscriptions.userId, userId)
    });

    let subscription;

    if (existingSubscription) {
      // Update existing subscription
      const [updated] = await db.update(schema.subscriptions)
        .set(subscriptionData)
        .where(eq(schema.subscriptions.id, existingSubscription.id))
        .returning();

      if (!updated) {
        throw new Error('Failed to update subscription - no record returned');
      }

      subscription = updated;
    } else {
      // Create new subscription
      const [newSubscription] = await db.insert(schema.subscriptions)
        .values(subscriptionData)
        .returning();

      if (!newSubscription) {
        throw new Error('Failed to create subscription - no record returned');
      }

      subscription = newSubscription;
    }

    // Process affiliate commission if applicable
    try {
      const { processAffiliateCommission } = await import('./affiliate');
      await processAffiliateCommission(userId, amount);
    } catch (error) {
      console.error('Error processing affiliate _commission:', error);
    }

    return subscription;
  } catch (_error: unknown) {
    console.error('Error processing subscription _payment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to process subscription _payment: ${errorMessage}`);
  }
}
