/**
 * Enhanced Subscription Service
 * 
 * A refactored version of the Subscription service that uses the enhanced base service
 * and utility abstractions to reduce code duplication and improve type safety.
 */
import { EnhancedBaseService } from '@server/services/base/enhanced-service';
import { SubscriptionFormatter } from './formatter';
import { subscriptionValidation, SchemaValidationError } from '@shared/schema-validation';
import { prepareSubscriptionData } from '@shared/schema-helpers';
import { ISubscriptionService } from './interface';
import { 
  CreateSubscriptionParams, 
  UpdateSubscriptionParams,
  SubscriptionSearchParams,
  SubscriptionStatus,
  PaymentProvider,
  ProcessWebhookParams,
  Subscription,
  SubscriptionPlan
} from './types';
import { SubscriptionServiceErrors } from './errors';
import { ErrorCode } from '@shared/types/errors';
import { db } from '@server/db';
import { eq, and, or, like, gte, lte, desc, asc, sql } from 'drizzle-orm';
import * as schema from '@shared/schema';

export class EnhancedSubscriptionService extends EnhancedBaseService implements ISubscriptionService {
  private formatter: SubscriptionFormatter;
  
  constructor() {
    super();
    this.formatter = new SubscriptionFormatter();
  }
  
  /**
   * Create a new subscription with validated data
   * 
   * @param params Subscription creation parameters
   * @returns The created subscription
   */
  async createSubscription(params: CreateSubscriptionParams): Promise<Subscription> {
    try {
      // Validate and prepare the data
      const validatedData = subscriptionValidation.insert(params);
      const preparedData = prepareSubscriptionData(validatedData);
      
      // Use the raw insert method to avoid TypeScript field mapping errors
      const subscription = await this.rawInsertWithFormatting(
        'subscriptions',
        preparedData,
        this.formatter.formatResult.bind(this.formatter)
      );
      
      // Ensure the subscription was created
      return this.ensureExists(subscription, 'Subscription');
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        console.error(`Validation error: ${error.message}`, error.toJSON());
      }
      return this.handleError(error, 'creating subscription');
    }
  }
  
  /**
   * Update a subscription with validated data
   * 
   * @param subscriptionId ID of the subscription to update
   * @param params Subscription update parameters
   * @returns The updated subscription
   */
  async updateSubscription(subscriptionId: number, params: UpdateSubscriptionParams): Promise<Subscription> {
    try {
      // Get existing subscription
      const existingSubscription = await this.getSubscriptionById(subscriptionId);
      if (!existingSubscription) {
        throw SubscriptionServiceErrors.SUBSCRIPTION_NOT_FOUND;
      }
      
      // Validate status transition if being updated
      if (params.status && params.status !== existingSubscription.status) {
        this.validateStatusTransition(existingSubscription.status, params.status);
      }
      
      // Prepare update data with proper field names
      const updateData = {
        ...params,
        metadata: params.metadata ? JSON.stringify(params.metadata) : existingSubscription.metadata,
        updatedAt: new Date()
      };
      
      // Validate and prepare the data
      const validatedData = subscriptionValidation.update(updateData);
      const preparedData = prepareSubscriptionData(validatedData);
      
      // Use the raw update method to avoid TypeScript field mapping errors
      const updatedSubscription = await this.rawUpdateWithFormatting(
        'subscriptions',
        preparedData,
        `id = ${subscriptionId}`,
        this.formatter.formatResult.bind(this.formatter)
      );
      
      // Ensure the subscription was updated
      return this.ensureExists(updatedSubscription, 'Subscription');
    } catch (error) {
      return this.handleError(error, 'updating subscription');
    }
  }
  
  /**
   * Get a subscription by ID
   * 
   * @param subscriptionId ID of the subscription to retrieve
   * @returns The subscription or null if not found
   */
  async getSubscriptionById(subscriptionId: number): Promise<Subscription | null> {
    try {
      // Create a simple query to fetch the subscription
      const query = `
        SELECT * FROM subscriptions WHERE id = ${subscriptionId}
      `;
      
      // Execute the query and format the result
      return await this.executeSqlWithFormatting(
        query,
        [],
        this.formatter.formatResult.bind(this.formatter)
      );
    } catch (error) {
      return this.handleError(error, 'getting subscription by ID');
    }
  }
  
  /**
   * Get all subscriptions for a user
   * 
   * @param userId ID of the user
   * @returns The subscription or null if not found
   */
  async getSubscriptionByUser(userId: number): Promise<Subscription | null> {
    try {
      // Create a simple query to fetch the subscription
      const query = `
        SELECT * FROM subscriptions 
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT 1
      `;
      
      // Execute the query and format the result
      return await this.executeSqlWithFormatting(
        query,
        [],
        this.formatter.formatResult.bind(this.formatter)
      );
    } catch (error) {
      return this.handleError(error, 'getting subscription by user');
    }
  }
  
  /**
   * Get the active subscription for a user
   * 
   * @param userId ID of the user
   * @returns The active subscription or null if not found
   */
  async getActiveSubscription(userId: number): Promise<Subscription | null> {
    try {
      // Create a query to fetch the active subscription
      const query = `
        SELECT * FROM subscriptions 
        WHERE user_id = ${userId} 
        AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
      `;
      
      // Execute the query and format the result
      return await this.executeSqlWithFormatting(
        query,
        [],
        this.formatter.formatResult.bind(this.formatter)
      );
    } catch (error) {
      return this.handleError(error, 'getting active subscription');
    }
  }
  
  /**
   * Validate that a subscription status transition is allowed
   * 
   * @param currentStatus Current status of the subscription
   * @param newStatus New status to transition to
   * @throws If the transition is not allowed
   */
  validateStatusTransition(currentStatus: string, newStatus: string): void {
    // Define allowed transitions
    const allowedTransitions: Record<string, string[]> = {
      [SubscriptionStatus.ACTIVE]: [
        SubscriptionStatus.CANCELLED,
        SubscriptionStatus.EXPIRED,
        SubscriptionStatus.SUSPENDED,
        SubscriptionStatus.FAILED
      ],
      [SubscriptionStatus.PENDING]: [
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.FAILED,
        SubscriptionStatus.CANCELLED
      ],
      [SubscriptionStatus.SUSPENDED]: [
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.CANCELLED
      ],
      [SubscriptionStatus.EXPIRED]: [
        SubscriptionStatus.ACTIVE
      ],
      [SubscriptionStatus.CANCELLED]: [
        SubscriptionStatus.ACTIVE
      ],
      [SubscriptionStatus.FAILED]: [
        SubscriptionStatus.ACTIVE
      ]
    };
    
    // Check if transition is allowed
    if (
      currentStatus === newStatus ||
      !allowedTransitions[currentStatus] ||
      !allowedTransitions[currentStatus].includes(newStatus)
    ) {
      throw SubscriptionServiceErrors.INVALID_STATUS_TRANSITION;
    }
  }
}
