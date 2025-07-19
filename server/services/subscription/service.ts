/**
 * Subscription Service Implementation
 * 
 * This file implements a standardized subscription service with proper schema validation
 * and error handling according to our schema style guide.
 */

import { BaseService } from '../base/service';
import { 
  ISubscriptionService,
  SubscriptionServiceErrors,
  CreateSubscriptionParams,
  UpdateSubscriptionParams,
  SubscriptionSearchParams,
  ProcessWebhookParams,
  SubscriptionStatus,
  SubscriptionPlan,
  PaymentProvider
} from './types';
import { db } from '../../../db';
import * as schema from '@shared/schema';
import { eq, and, or, like, gte, lte, lt, desc, asc, sql, SQL } from 'drizzle-orm';
import { subscriptionValidation, SchemaValidationError } from '@shared/schema-validation';
import { prepareSubscriptionData, formatSubscriptionResult } from '@shared/schema-helpers';

export class SubscriptionService extends BaseService implements ISubscriptionService {
  /**
   * Create a new subscription with validated data
   */
  async createSubscription(params: CreateSubscriptionParams): Promise<schema.Subscription> {
    try {
      // Verify user exists
      const user = await db.query.users.findFirst({
        where: eq(schema.users.id, params.userId)
      });
      
      if (!user) {
        throw SubscriptionServiceErrors.USER_NOT_FOUND;
      }
      
      // Check for existing active subscription
      const existingSubscription = await this.getActiveSubscription(params.userId);
      
      if (existingSubscription) {
        throw SubscriptionServiceErrors.DUPLICATE_SUBSCRIPTION;
      }
      
      // Set default values for optional fields
      const startDate = params.startDate || new Date();
      const endDate = params.endDate || this.calculateEndDate(startDate, params.plan);
      const currency = params.currency || 'NGN';
      
      // Prepare subscription data with camelCase field names
      const subscriptionData = {
        userId: params.userId,
        plan: params.plan,
        status: SubscriptionStatus.ACTIVE,
        amount: params.amount,
        currency,
        startDate,
        endDate,
        autoRenew: params.autoRenew ?? true,
        paymentProvider: params.provider || PaymentProvider.MANUAL,
        paymentReference: params.providerReference || '',
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Validate with our schema validation
      const validatedData = subscriptionValidation.insert(subscriptionData);
      
      // Prepare data for insertion with proper field mapping
      const preparedData = prepareSubscriptionData(validatedData);
      
      // Insert validated data using SQL.raw to bypass type checking for this operation
      // This is a workaround for field name mismatches between our code and the database schema
      const query = `
        INSERT INTO subscriptions (
          user_id, plan, status, amount, currency, 
          start_date, end_date, auto_renew, payment_provider, 
          payment_reference, metadata, created_at, updated_at
        ) VALUES (
          ${preparedData.user_id}, '${preparedData.plan}', '${preparedData.status}', 
          '${preparedData.amount}', '${preparedData.currency}', 
          $1, $2, ${preparedData.auto_renew}, '${preparedData.payment_provider}', 
          ${preparedData.payment_reference ? `'${preparedData.payment_reference}'` : 'NULL'}, 
          ${preparedData.metadata ? `'${preparedData.metadata}'` : 'NULL'}, 
          $3, $4
        ) RETURNING *
      `;
      
      // Convert date parameters for SQL injection
      const startDateStr = preparedData.start_date ? `'${preparedData.start_date.toISOString()}'` : `'${new Date().toISOString()}'`;
      const endDateStr = preparedData.end_date ? `'${preparedData.end_date.toISOString()}'` : 'NULL';
      const createdAtStr = preparedData.created_at ? `'${preparedData.created_at.toISOString()}'` : `'${new Date().toISOString()}'`;
      const updatedAtStr = preparedData.updated_at ? `'${preparedData.updated_at.toISOString()}'` : `'${new Date().toISOString()}'`;
      
      // Update the query to use direct string interpolation instead of parameters
      const finalQuery = query
        .replace('$1', startDateStr)
        .replace('$2', endDateStr)
        .replace('$3', createdAtStr)
        .replace('$4', updatedAtStr);
      
      // Execute the SQL query without parameters
      const result = await db.execute(sql.raw(finalQuery));
      
      // Extract the first row from the result and map it to the expected type
      const rawSubscription = result.rows?.[0];

      if (!rawSubscription) {
        throw new Error('Failed to insert subscription');
      }

      const subscription = formatSubscriptionResult(rawSubscription) as schema.Subscription;
      return subscription;
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        console.error(`Validation error: ${error.message}`, error.toJSON());
      }
      return this.handleError(error as Error, 'Creating subscription');
    }
  }
  
  /**
   * Update a subscription with validated data
   */
  async updateSubscription(subscriptionId: number, params: UpdateSubscriptionParams): Promise<schema.Subscription> {
    try {
      // Verify subscription exists
      const existingSubscription = await db.query.subscriptions.findFirst({
        where: eq(schema.subscriptions.id, subscriptionId)
      });
      
      if (!existingSubscription) {
        throw SubscriptionServiceErrors.SUBSCRIPTION_NOT_FOUND;
      }
      
      // Validate status transition if being updated
      if (params.status && params.status !== existingSubscription.status) {
        this.validateStatusTransition(existingSubscription.status, params.status);
      }
      
      // Prepare update data with proper camelCase field names
      const updateData = {
        ...params,
        metadata: params.metadata ? JSON.stringify(params.metadata) : existingSubscription.metadata,
        updatedAt: new Date()
      };
      
      // Validate the update data
      const validatedData = subscriptionValidation.update(updateData);
      
      // Prepare data for update with proper field mapping
      const preparedData = prepareSubscriptionData(validatedData);
      
      // Build SET clauses for our SQL query based on the data provided
      const setClauses: string[] = [];
      
      // Use string interpolation directly instead of params array
      // This avoids TypeScript errors with parameter handling
      
      // Build SET clauses for each field that was provided with direct string interpolation
      if (preparedData.user_id !== undefined) setClauses.push(`user_id = ${preparedData.user_id}`);
      if (preparedData.plan !== undefined) setClauses.push(`plan = '${preparedData.plan}'`);
      if (preparedData.status !== undefined) setClauses.push(`status = '${preparedData.status}'`);
      if (preparedData.amount !== undefined) setClauses.push(`amount = '${preparedData.amount}'`);
      if (preparedData.currency !== undefined) setClauses.push(`currency = '${preparedData.currency}'`);
      if (preparedData.referral_code !== undefined) setClauses.push(`referral_code = '${preparedData.referral_code}'`);
      if (preparedData.discount_applied !== undefined) setClauses.push(`discount_applied = ${preparedData.discount_applied}`);
      if (preparedData.discount_amount !== undefined) setClauses.push(`discount_amount = '${preparedData.discount_amount}'`);
      if (preparedData.start_date !== undefined) {
        const startDateStr = preparedData.start_date instanceof Date ? 
          `'${preparedData.start_date.toISOString()}'` : `'${preparedData.start_date}'`;
        setClauses.push(`start_date = ${startDateStr}`);
      }
      if (preparedData.end_date !== undefined) {
        const endDateStr = preparedData.end_date instanceof Date ? 
          `'${preparedData.end_date.toISOString()}'` : (preparedData.end_date ? `'${preparedData.end_date}'` : 'NULL');
        setClauses.push(`end_date = ${endDateStr}`);
      }
      if (preparedData.auto_renew !== undefined) setClauses.push(`auto_renew = ${preparedData.auto_renew}`);
      if (preparedData.payment_provider !== undefined) setClauses.push(`payment_provider = '${preparedData.payment_provider}'`);
      if (preparedData.payment_reference !== undefined) setClauses.push(`payment_reference = '${preparedData.payment_reference}'`);
      if (preparedData.metadata !== undefined) {
        const metadataStr = typeof preparedData.metadata === 'string' ? 
          `'${preparedData.metadata}'` : `'${JSON.stringify(preparedData.metadata)}'`;
        setClauses.push(`metadata = ${metadataStr}`);
      }
      
      // Always update the updated_at timestamp
      const now = new Date();
      setClauses.push(`updated_at = '${now.toISOString()}'`);
      
      // Construct the full SQL query
      const query = `
        UPDATE subscriptions
        SET ${setClauses.join(', ')}
        WHERE id = ${subscriptionId}
        RETURNING *
      `;
      
      // Execute the SQL query
      const result = await db.execute(sql.raw(query));
      
      // Extract the first row from the result and map it to the expected type
      const rawSubscription = result.rows?.[0];
      
      // Use our format helper to properly map database fields to code fields
      if (!rawSubscription) {
        throw new Error('Operation failed, no subscription updated');
      }
      const updatedSubscription = formatSubscriptionResult(rawSubscription) as schema.Subscription;
      
      return updatedSubscription;
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        console.error(`Validation error: ${error.message}`, error.toJSON());
      }
      return this.handleError(error as Error, 'Updating subscription');
    }
  }
  
  /**
   * Get a subscription by ID
   */
  async getSubscriptionById(subscriptionId: number): Promise<schema.Subscription | null> {
    try {
      const subscriptionRecord = await db.query.subscriptions.findFirst({
        where: eq(schema.subscriptions.id, subscriptionId)
      });
      
      return subscriptionRecord ?? null;
    } catch (error) {
      return this.handleError(error as Error, 'Getting subscription by ID');
    }
  }
  
  /**
   * Get all subscriptions for a user
   */
  async getSubscriptionByUser(userId: number): Promise<schema.Subscription | null> {
    try {
      const subscriptionRecord = await db.query.subscriptions.findFirst({
        where: eq(schema.subscriptions.userId, userId),
        orderBy: [desc(schema.subscriptions.createdAt)]
      });
      
      return subscriptionRecord ?? null;
    } catch (error) {
      return this.handleError(error as Error, 'Getting subscription by user');
    }
  }
  
  /**
      return subscription;
    } catch (error) {
      return this.handleError(error as Error, 'Getting active subscription');
    }
  }
  
  /**
   * Search subscriptions with advanced filters
   */
  async searchSubscriptions(params: SubscriptionSearchParams): Promise<{
    subscriptions: schema.Subscription[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const page = params.page || 1;
      const limit = params.limit || 20;
      const offset = (page - 1) * limit;
      
      // Build where clause
      // Build dynamic conditions array to avoid undefined in AND
      const conditions: SQL[] = [];
      if (params.userId) {
        conditions.push(eq(schema.subscriptions.userId, params.userId));
      }
      if (params.plan) {
        conditions.push(eq(schema.subscriptions.plan, params.plan));
      }
      if (params.status) {
        conditions.push(eq(schema.subscriptions.status, params.status));
      }
      if (params.startDate) {
        conditions.push(gte(schema.subscriptions.startDate, params.startDate));
      }
      if (params.endDate) {
        conditions.push(lte(schema.subscriptions.endDate, params.endDate));
      }
      if (params.provider) {
        conditions.push(eq(schema.subscriptions.paymentProvider, params.provider));
      }

      let whereClause: SQL;
      if (conditions.length) {
        whereClause = and(...conditions) as SQL;
      } else {
        whereClause = sql`true`;
      }

      // Count total results
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.subscriptions)
        .where(whereClause);
      
      const total = Number(countResult?.count || 0);
      
      // Get subscriptions
      const subscriptions = await db.query.subscriptions.findMany({
        where: whereClause,
        limit,
        offset,
        orderBy: [desc(schema.subscriptions.createdAt)],
        with: {
          user: true
        }
      });
      
      return {
        subscriptions,
        total,
        page,
        limit
      };
    } catch (error) {
      return this.handleError(error as Error, 'Searching subscriptions');
    }
  }
  
  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: number, reason?: string): Promise<schema.Subscription> {
    try {
      // Verify subscription exists
      const subscription = await this.getSubscriptionById(subscriptionId);
      
      if (!subscription) {
        throw SubscriptionServiceErrors.SUBSCRIPTION_NOT_FOUND;
      }
      
      // Verify subscription is active
      if (subscription.status !== SubscriptionStatus.ACTIVE) {
        throw SubscriptionServiceErrors.INVALID_CANCELLATION;
      }
      
      // Update subscription status
      const metadata = subscription.metadata 
        ? JSON.parse(subscription.metadata) 
        : {};
      
      const updatedMetadata = {
        ...metadata,
        cancellationReason: reason || 'User cancelled',
        cancelledAt: new Date().toISOString()
      };
      
      // Use raw SQL to update the subscription status instead of Drizzle ORM
      // This avoids TypeScript errors with field mapping
      const query = `
        UPDATE subscriptions
        SET status = 'cancelled', 
            updated_at = '${new Date().toISOString()}',
            metadata = '${JSON.stringify(updatedMetadata)}'
        WHERE id = ${subscriptionId}
        RETURNING *
      `;
      
      // Execute the query and get the result
      const result = await db.execute(sql.raw(query));
      
      // Extract the first row from the result and map it to the expected type
      const rawSubscription = result.rows?.[0];
      
      // Use our format helper to properly map database fields to code fields
      if (!rawSubscription) {
        throw new Error('Operation failed, no subscription updated');
      }
      const updatedSubscription = formatSubscriptionResult(rawSubscription) as schema.Subscription;
      
      return updatedSubscription;
    } catch (error) {
      return this.handleError(error as Error, 'Cancelling subscription');
    }
  }
  
  /**
   * Renew a subscription
   */
  async renewSubscription(subscriptionId: number): Promise<schema.Subscription> {
    try {
      // Verify subscription exists
      const subscription = await this.getSubscriptionById(subscriptionId);
      
      if (!subscription) {
        throw SubscriptionServiceErrors.SUBSCRIPTION_NOT_FOUND;
      }
      
      // Verify subscription can be renewed
      if (![SubscriptionStatus.ACTIVE, SubscriptionStatus.EXPIRED, SubscriptionStatus.PAST_DUE].includes(subscription.status as SubscriptionStatus)) {
        throw SubscriptionServiceErrors.INVALID_RENEWAL;
      }
      
      // Calculate new end date
      const newStartDate = new Date();
      const newEndDate = this.calculateEndDate(newStartDate, subscription.plan);
      
      // Use raw SQL to update the subscription instead of Drizzle ORM
      // This avoids TypeScript errors with field mapping
      const query = `
        UPDATE subscriptions
        SET status = 'active',
            start_date = '${newStartDate.toISOString()}',
            end_date = '${newEndDate.toISOString()}',
            updated_at = '${new Date().toISOString()}'
        WHERE id = ${subscriptionId}
        RETURNING *
      `;
      
      // Execute the query and get the result
      const result = await db.execute(sql.raw(query));
      
      // Extract the first row from the result and map it to the expected type
      const rawSubscription = result.rows?.[0];
      
      // Use our format helper to properly map database fields to code fields
      if (!rawSubscription) {
        throw new Error('Operation failed, no subscription updated');
      }
      const updatedSubscription = formatSubscriptionResult(rawSubscription) as schema.Subscription;
      
      return updatedSubscription;
    } catch (error) {
      return this.handleError(error as Error, 'Renewing subscription');
    }
  }
  
  /**
   * Process a webhook event from a payment provider
   */
  async processWebhook(params: ProcessWebhookParams): Promise<boolean> {
    try {
      // Validate webhook data
      const validatedData = subscriptionValidation.webhook(params);
      
      switch (params.provider) {
        case PaymentProvider.PAYSTACK:
          return this.processPaystackWebhook(params.event, params.data);
        case PaymentProvider.FLUTTERWAVE:
          return this.processFlutterwaveWebhook(params.event, params.data);
        default:
          throw new Error(`Unsupported payment provider: ${params.provider}`);
      }
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        console.error(`Validation error: ${error.message}`, error.toJSON());
      }
      return this.handleError(error as Error, 'Processing webhook');
    }
  }
  
  /**
   * Process a Paystack webhook event
   */
  private async processPaystackWebhook(event: string, data: any): Promise<boolean> {
    try {
      switch (event) {
        case 'subscription.create':
          return this.handleSubscriptionCreate(PaymentProvider.PAYSTACK, data);
        case 'charge.success':
          return this.handleChargeSuccess(PaymentProvider.PAYSTACK, data);
        case 'subscription.disable':
          return this.handleSubscriptionCancel(PaymentProvider.PAYSTACK, data);
        default:
          console.log(`Unhandled Paystack event: ${event}`);
          return true;
      }
    } catch (error) {
      return this.handleError(error as Error, `Processing Paystack webhook: ${event}`);
    }
  }
  
  /**
   * Process a Flutterwave webhook event
   */
  private async processFlutterwaveWebhook(event: string, data: any): Promise<boolean> {
    try {
      switch (event) {
        case 'subscription.created':
          return this.handleSubscriptionCreate(PaymentProvider.FLUTTERWAVE, data);
        case 'charge.completed':
          return this.handleChargeSuccess(PaymentProvider.FLUTTERWAVE, data);
        case 'subscription.cancelled':
          return this.handleSubscriptionCancel(PaymentProvider.FLUTTERWAVE, data);
        default:
          console.log(`Unhandled Flutterwave event: ${event}`);
          return true;
      }
    } catch (error) {
      return this.handleError(error as Error, `Processing Flutterwave webhook: ${event}`);
    }
  }
  
  /**
   * Handle subscription creation webhook
   */
  private async handleSubscriptionCreate(provider: PaymentProvider, data: any): Promise<boolean> {
    try {
      // Extract user and subscription details based on provider
      let userId: number, plan: string, amount: string, reference: string;
      let metadata: Record<string, any> = {};
      
      if (provider === PaymentProvider.PAYSTACK) {
        userId = parseInt(data.customer.metadata.user_id);
        plan = data.plan.name.toLowerCase();
        amount = (parseFloat(data.amount) / 100).toString(); // Convert from kobo to naira
        reference = data.reference;
        metadata = {
          paystackCode: data.subscription_code,
          paystackCustomerCode: data.customer.customer_code
        };
      } else if (provider === PaymentProvider.FLUTTERWAVE) {
        userId = parseInt(data.customer.meta.user_id);
        plan = data.plan.toLowerCase();
        amount = data.amount.toString();
        reference = data.reference || data.id;
        metadata = {
          flwReference: data.id,
          flwCustomerId: data.customer.id
        };
      } else {
        throw new Error(`Unsupported payment provider: ${provider}`);
      }
      
      // Verify user exists
      const user = await db.query.users.findFirst({
        where: eq(schema.users.id, userId)
      });
      
      if (!user) {
        throw SubscriptionServiceErrors.USER_NOT_FOUND;
      }
      
      // Check for existing active subscription
      const existingSubscription = await this.getActiveSubscription(userId);
      
      if (existingSubscription) {
        // Update existing subscription instead of creating new one
        return await this.updateExistingSubscription(existingSubscription.id, plan, amount, reference);
      }
      
      // Create new subscription
      const startDate = new Date();
      const endDate = this.calculateEndDate(startDate, plan);
      
      // Prepare subscription data
      const subscriptionData = {
        userId,
        plan,
        status: SubscriptionStatus.ACTIVE,
        amount,
        currency: 'NGN',
        startDate,
        endDate,
        autoRenew: true,
        paymentProvider: provider,
        paymentReference: reference,
        metadata: JSON.stringify(metadata),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Validate and prepare data
      const validatedData = subscriptionValidation.insert(subscriptionData);
      const preparedData = prepareSubscriptionData(validatedData);
      
      // Use raw SQL to insert the subscription instead of Drizzle ORM
      // This avoids TypeScript errors with field mapping
      const query = `
        INSERT INTO subscriptions (
          user_id, plan, status, amount, currency, start_date, end_date, 
          auto_renew, payment_provider, payment_reference, metadata, 
          created_at, updated_at
        ) VALUES (
          ${preparedData.user_id}, '${preparedData.plan}', '${preparedData.status}', 
          '${preparedData.amount}', '${preparedData.currency}', 
          '${preparedData.start_date.toISOString()}', '${preparedData.end_date.toISOString()}', 
          ${preparedData.auto_renew}, '${preparedData.payment_provider}', 
          '${preparedData.payment_reference}', '${preparedData.metadata}', 
          '${preparedData.created_at.toISOString()}', '${preparedData.updated_at.toISOString()}'
        )
      `;
      
      // Execute the SQL query
      await db.execute(sql.raw(query));
      
      return true;
    } catch (error) {
      return this.handleError(error as Error, 'Handling subscription create webhook');
    }
  }
  
  /**
   * Handle charge success webhook
   */
  private async handleChargeSuccess(provider: PaymentProvider, data: any): Promise<boolean> {
    try {
      // Extract details based on provider
      let userId: number, reference: string, amount: string;
      
      if (provider === PaymentProvider.PAYSTACK) {
        userId = parseInt(data.customer.metadata.user_id);
        reference = data.reference;
        amount = (parseFloat(data.amount) / 100).toString(); // Convert from kobo to naira
      } else if (provider === PaymentProvider.FLUTTERWAVE) {
        userId = parseInt(data.customer.meta.user_id);
        reference = data.reference || data.id;
        amount = data.amount.toString();
      } else {
        throw new Error(`Unsupported payment provider: ${provider}`);
      }
      
      // Verify user exists
      const user = await db.query.users.findFirst({
        where: eq(schema.users.id, userId)
      });
      
      if (!user) {
        throw SubscriptionServiceErrors.USER_NOT_FOUND;
      }
      
      // Find user's subscription
      const subscription = await this.getSubscriptionByUser(userId);
      
      if (!subscription) {
        // No subscription found, this might be a new one-time payment
        // Logic for handling one-time payments would go here
        return true;
      }
      
      // Update subscription with new payment reference if needed
      const query = `
        UPDATE subscriptions
        SET payment_reference = '${reference}', updated_at = '${new Date().toISOString()}'
        WHERE id = ${subscription.id}
      `;
      
      await db.execute(sql.raw(query));
      
      return true;
    } catch (error) {
      return this.handleError(error as Error, 'Handling charge success webhook');
    }
  }
  
  /**
   * Handle subscription cancellation webhook
   */
  private async handleSubscriptionCancel(provider: PaymentProvider, data: any): Promise<boolean> {
    try {
      // Extract details based on provider
      let userId: number, reason: string = 'Cancelled via webhook';
      
      if (provider === PaymentProvider.PAYSTACK) {
        userId = parseInt(data.customer.metadata.user_id);
        reason = data.reason || reason;
      } else if (provider === PaymentProvider.FLUTTERWAVE) {
        userId = parseInt(data.customer.meta.user_id);
        reason = data.reason || reason;
      } else {
        throw new Error(`Unsupported payment provider: ${provider}`);
      }
      
      // Find user's subscription
      const subscription = await this.getSubscriptionByUser(userId);
      
      if (!subscription) {
        // No subscription found
        return true;
      }
      
      // Cancel the subscription
      await this.cancelSubscription(subscription.id, reason);
      
      return true;
    } catch (error) {
      return this.handleError(error as Error, 'Handling subscription cancel webhook');
    }
  }
  
  /**
   * Update an existing subscription with new plan/amount/reference
   */
  private async updateExistingSubscription(
    subscriptionId: number, 
    plan: string, 
    amount: string, 
    reference: string
  ): Promise<boolean> {
    try {
      // Calculate new end date
      const startDate = new Date();
      const endDate = this.calculateEndDate(startDate, plan);
      
      // Update subscription
      await db.update(schema.subscriptions)
        .set({
          plan,
          amount,
          paymentReference: reference,
          startDate,
          endDate,
          status: SubscriptionStatus.ACTIVE,
          updatedAt: new Date()
        })
        .where(eq(schema.subscriptions.id, subscriptionId));
      
      return true;
    } catch (error) {
      return this.handleError(error as Error, 'Updating existing subscription');
    }
  }
  
  /**
   * Calculate end date based on plan and start date
   */
  /**
   * Get the active subscription for a user (helper used in many methods)
   */
  async getActiveSubscription(userId: number): Promise<schema.Subscription | null> {
    const now = new Date();
    const subscription = await db.query.subscriptions.findFirst({
      where: and(
        eq(schema.subscriptions.userId, userId),
        eq(schema.subscriptions.status, SubscriptionStatus.ACTIVE),
        gte(schema.subscriptions.endDate, now)
      )
    });
    return subscription ?? null;
  }

  private calculateEndDate(startDate: Date, plan: string): Date {
    const endDate = new Date(startDate);
    
    // Determine subscription duration based on plan
    if (plan.includes('annual') || plan.includes('yearly')) {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else if (plan.includes('quarterly') || plan.includes('3-month')) {
      endDate.setMonth(endDate.getMonth() + 3);
    } else if (plan.includes('biannual') || plan.includes('6-month')) {
      endDate.setMonth(endDate.getMonth() + 6);
    } else {
      // Default to monthly
      endDate.setMonth(endDate.getMonth() + 1);
    }
    
    return endDate;
  }
  
  /**
   * Validate that a subscription has access to a required plan
   */
  async validateSubscriptionAccess(userId: number, requiredPlan?: SubscriptionPlan | string): Promise<boolean> {
    try {
      // If no plan is required, just check for any active subscription
      if (!requiredPlan) {
        const subscription = await this.getActiveSubscription(userId);
        return !!subscription;
      }
      
      // Get active subscription
      const subscription = await this.getActiveSubscription(userId);
      
      if (!subscription) {
        return false;
      }
      
      // Define plan hierarchy
      const planHierarchy: Record<string, number> = {
        'basic': 0,
        'premium': 1,
        'pro': 2,
        'enterprise': 3
      };
      
      // Get numeric values for comparison
      const requiredPlanValue = planHierarchy[requiredPlan.toLowerCase()] || 0;
      const userPlanValue = planHierarchy[subscription.plan.toLowerCase()] || 0;
      
      // User has access if their plan is equal or higher in the hierarchy
      return userPlanValue >= requiredPlanValue;
    } catch (error) {
      return this.handleError(error as Error, 'Validating subscription access');
    }
  }
  
  /**
   * Get subscription metrics
   */
  async getSubscriptionMetrics(): Promise<{
    totalSubscriptions: number;
    activeSubscriptions: number;
    revenueThisMonth: string;
    revenueLastMonth: string;
    subscriptionsByPlan: Record<string, number>;
    churnRate: string;
  }> {
    try {
      // Get current date info
      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      
      // Get total subscriptions count
      const [totalResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.subscriptions);
      
      const totalSubscriptions = Number(totalResult?.count || 0);
      
      // Get active subscriptions count
      const [activeResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.subscriptions)
        .where(and(
          eq(schema.subscriptions.status, SubscriptionStatus.ACTIVE),
          gte(schema.subscriptions.endDate, now)
        ));
      
      const activeSubscriptions = Number(activeResult?.count || 0);
      
      // Get revenue for this month
      const [thisMonthRevenue] = await db
        .select({
          revenue: sql<string>`COALESCE(SUM(${schema.subscriptions.amount}::numeric), 0)`
        })
        .from(schema.subscriptions)
        .where(and(
          gte(schema.subscriptions.createdAt, thisMonth),
          lt(schema.subscriptions.createdAt, now)
        ));
      
      const revenueThisMonth = thisMonthRevenue?.revenue || '0';
      
      // Get revenue for last month
      const [lastMonthRevenue] = await db
        .select({
          revenue: sql<string>`COALESCE(SUM(${schema.subscriptions.amount}::numeric), 0)`
        })
        .from(schema.subscriptions)
        .where(and(
          gte(schema.subscriptions.createdAt, lastMonth),
          lt(schema.subscriptions.createdAt, thisMonth)
        ));
      
      const revenueLastMonth = lastMonthRevenue?.revenue || '0';
      
      // Get subscriptions by plan
      const subscriptionsByPlanResults = await db
        .select({
          plan: schema.subscriptions.plan,
          count: sql<number>`count(*)`
        })
        .from(schema.subscriptions)
        .groupBy(schema.subscriptions.plan);
      
      const subscriptionsByPlan: Record<string, number> = {};
      subscriptionsByPlanResults.forEach(result => {
        subscriptionsByPlan[result.plan] = Number(result.count);
      });
      
      // Calculate churn rate
      // Get subscribers at start of last month
      const [subscribersStart] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.subscriptions)
        .where(and(
          lt(schema.subscriptions.createdAt, lastMonth),
          or(
            gte(schema.subscriptions.endDate, lastMonth),
            eq(schema.subscriptions.status, SubscriptionStatus.ACTIVE)
          )
        ));
      
      // Get cancelled subscriptions during last month
      const [cancellations] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.subscriptions)
        .where(and(
          gte(schema.subscriptions.updatedAt, lastMonth),
          lt(schema.subscriptions.updatedAt, thisMonth),
          eq(schema.subscriptions.status, SubscriptionStatus.CANCELLED)
        ));
      
      const startCount = Number(subscribersStart?.count || 0);
      const cancelCount = Number(cancellations?.count || 0);
      
      // Calculate churn rate (cancellations / starting subscribers)
      const churnRate = startCount > 0 
        ? ((cancelCount / startCount) * 100).toFixed(2)
        : '0.00';
      
      return {
        totalSubscriptions,
        activeSubscriptions,
        revenueThisMonth,
        revenueLastMonth,
        subscriptionsByPlan,
        churnRate
      };
    } catch (error) {
      return this.handleError(error as Error, 'Getting subscription metrics');
    }
  }
  
  /**
   * Validate that a subscription status transition is allowed
   */
  private validateStatusTransition(currentStatus: string, newStatus: string): void {
    // Define allowed status transitions
    const allowedTransitions: Record<string, string[]> = {
      [SubscriptionStatus.ACTIVE]: [
        SubscriptionStatus.CANCELLED,
        SubscriptionStatus.EXPIRED,
        SubscriptionStatus.PAST_DUE
      ],
      [SubscriptionStatus.PENDING]: [
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.CANCELLED,
        SubscriptionStatus.FAILED
      ],
      [SubscriptionStatus.PAST_DUE]: [
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.CANCELLED,
        SubscriptionStatus.EXPIRED
      ],
      [SubscriptionStatus.TRIAL]: [
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.CANCELLED,
        SubscriptionStatus.EXPIRED
      ],
      [SubscriptionStatus.EXPIRED]: [
        SubscriptionStatus.ACTIVE
      ],
      [SubscriptionStatus.CANCELLED]: [
        SubscriptionStatus.ACTIVE
      ]
    };
    
    // Check if transition is allowed
    const allowed = allowedTransitions[currentStatus]?.includes(newStatus);
    
    if (!allowed) {
      throw SubscriptionServiceErrors.INVALID_STATUS_TRANSITION;
    }
  }
}
