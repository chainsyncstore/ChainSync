/**
 * Subscription Service Tests
 * 
 * This file contains tests for the refactored subscription service, focusing on
 * validation, error handling, and schema standardization.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SubscriptionService } from './service';
import { 
  SubscriptionServiceErrors, 
  SubscriptionStatus,
  SubscriptionPlan,
  PaymentProvider
} from './types';
import { db } from '../../../db';
import * as schema from '@shared/schema';
import { SchemaValidationError } from '@shared/schema-validation';

// Mock DB and schema validation
jest.mock('@db', () => ({
  query: {
    subscriptions: {
      findFirst: jest.fn(),
      findMany: jest.fn()
    },
    users: {
      findFirst: jest.fn()
    }
  },
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  offset: jest.fn().mockReturnThis(),
  returning: jest.fn(),
  set: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis()
}));

jest.mock('@shared/schema-validation', () => ({
  subscriptionValidation: {
    insert: jest.fn(data => data),
    update: jest.fn(data => data),
    webhook: jest.fn(data => data)
  },
  SchemaValidationError: class SchemaValidationError extends Error {
    constructor(message: string, options?: Record<string, unknown>) {
      super(message);
      this.name = 'SchemaValidationError';
    }
    toJSON() {
      return {
        error: this.name,
        message: this.message
      };
    }
  }
}));

jest.mock('@shared/schema-helpers', () => ({
  prepareSubscriptionData: jest.fn(data => data)
}));

describe('SubscriptionService', () => {
  let subscriptionService: SubscriptionService;
  
  beforeEach(() => {
    subscriptionService = new SubscriptionService();
    jest.clearAllMocks();
  });
  
  describe('createSubscription', () => {
    const validSubscriptionData = {
      userId: 1,
      plan: SubscriptionPlan.PREMIUM,
      amount: '100.00',
      currency: 'NGN',
      provider: PaymentProvider.PAYSTACK,
      providerReference: 'test-reference',
      autoRenew: true
    };
    
    it('should create a subscription with validated data', async () => {
      // Mock user existence
      (db.query.users.findFirst as jest.Mock).mockResolvedValue({ id: 1, name: 'Test User' });
      
      // Mock no existing active subscription
      jest.spyOn(subscriptionService, 'getActiveSubscription').mockResolvedValue(null);
      
      // Mock returning to return the created subscription
      (db.insert().values().returning as jest.Mock).mockResolvedValue([
        { id: 1, ...validSubscriptionData, status: SubscriptionStatus.ACTIVE }
      ]);
      
      const result = await subscriptionService.createSubscription(validSubscriptionData);
      
      // Check that validation was called
      expect(require('@shared/schema-validation').subscriptionValidation.insert).toHaveBeenCalled();
      
      // Check that data was prepared
      expect(require('@shared/schema-helpers').prepareSubscriptionData).toHaveBeenCalled();
      
      // Check result has expected values
      expect(result).toEqual(expect.objectContaining({
        id: 1,
        userId: validSubscriptionData.userId,
        plan: validSubscriptionData.plan,
        status: SubscriptionStatus.ACTIVE
      }));
    });
    
    it('should throw error when user does not exist', async () => {
      // Mock user not found
      (db.query.users.findFirst as jest.Mock).mockResolvedValue(null);
      
      await expect(subscriptionService.createSubscription(validSubscriptionData))
        .rejects.toThrow(SubscriptionServiceErrors.USER_NOT_FOUND.message);
    });
    
    it('should throw error when active subscription already exists', async () => {
      // Mock user exists
      (db.query.users.findFirst as jest.Mock).mockResolvedValue({ id: 1, name: 'Test User' });
      
      // Mock existing active subscription
      jest.spyOn(subscriptionService, 'getActiveSubscription').mockResolvedValue({
        id: 1,
        userId: 1,
        plan: SubscriptionPlan.BASIC,
        status: SubscriptionStatus.ACTIVE
      } as schema.Subscription);
      
      await expect(subscriptionService.createSubscription(validSubscriptionData))
        .rejects.toThrow(SubscriptionServiceErrors.DUPLICATE_SUBSCRIPTION.message);
    });
    
    it('should handle validation errors properly', async () => {
      // Mock user exists
      (db.query.users.findFirst as jest.Mock).mockResolvedValue({ id: 1, name: 'Test User' });
      
      // Mock no existing active subscription
      jest.spyOn(subscriptionService, 'getActiveSubscription').mockResolvedValue(null);
      
      // Make validation throw an error
      (require('@shared/schema-validation').subscriptionValidation.insert as jest.Mock)
        .mockImplementationOnce(() => {
          throw new SchemaValidationError('Invalid subscription data');
        });
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await expect(subscriptionService.createSubscription(validSubscriptionData))
        .rejects.toThrow();
      
      // Check that error was logged
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });
  
  describe('updateSubscription', () => {
    const subscriptionId = 1;
    const updateData = {
      plan: SubscriptionPlan.PREMIUM,
      amount: '150.00',
      status: SubscriptionStatus.ACTIVE
    };
    
    it('should update a subscription with validated data', async () => {
      // Mock existing subscription
      (db.query.subscriptions.findFirst as jest.Mock).mockResolvedValue({
        id: subscriptionId,
        status: SubscriptionStatus.ACTIVE,
        metadata: JSON.stringify({ test: 'data' })
      });
      
      // Mock returning to return the updated subscription
      (db.update().set().where().returning as jest.Mock).mockResolvedValue([
        { id: subscriptionId, ...updateData }
      ]);
      
      const result = await subscriptionService.updateSubscription(subscriptionId, updateData);
      
      // Check that validation was called
      expect(require('@shared/schema-validation').subscriptionValidation.update).toHaveBeenCalled();
      
      // Check that data was prepared
      expect(require('@shared/schema-helpers').prepareSubscriptionData).toHaveBeenCalled();
      
      // Check result has expected values
      expect(result).toEqual(expect.objectContaining({
        id: subscriptionId,
        plan: updateData.plan,
        amount: updateData.amount
      }));
    });
    
    it('should throw error when subscription does not exist', async () => {
      // Mock subscription not found
      (db.query.subscriptions.findFirst as jest.Mock).mockResolvedValue(null);
      
      await expect(subscriptionService.updateSubscription(subscriptionId, updateData))
        .rejects.toThrow(SubscriptionServiceErrors.SUBSCRIPTION_NOT_FOUND.message);
    });
    
    it('should validate status transitions', async () => {
      // Mock existing subscription with status that cannot transition to the requested status
      (db.query.subscriptions.findFirst as jest.Mock).mockResolvedValue({
        id: subscriptionId,
        status: SubscriptionStatus.CANCELLED,
        metadata: null
      });
      
      // Invalid transition from CANCELLED to PAST_DUE
      const invalidUpdate = {
        status: SubscriptionStatus.PAST_DUE
      };
      
      await expect(subscriptionService.updateSubscription(subscriptionId, invalidUpdate))
        .rejects.toThrow(SubscriptionServiceErrors.INVALID_STATUS_TRANSITION.message);
    });
  });
  
  describe('getActiveSubscription', () => {
    const userId = 1;
    
    it('should return active subscription if exists', async () => {
      const mockSubscription = {
        id: 1,
        userId,
        plan: SubscriptionPlan.PREMIUM,
        status: SubscriptionStatus.ACTIVE,
        endDate: new Date(Date.now() + 86400000) // tomorrow
      };
      
      // Mock findFirst to return an active subscription
      (db.query.subscriptions.findFirst as jest.Mock).mockResolvedValue(mockSubscription);
      
      const result = await subscriptionService.getActiveSubscription(userId);
      
      expect(result).toEqual(mockSubscription);
    });
    
    it('should return null if no active subscription exists', async () => {
      // Mock findFirst to return null
      (db.query.subscriptions.findFirst as jest.Mock).mockResolvedValue(null);
      
      const result = await subscriptionService.getActiveSubscription(userId);
      
      expect(result).toBeNull();
    });
  });
  
  describe('cancelSubscription', () => {
    const subscriptionId = 1;
    const reason = 'Test cancellation';
    
    it('should cancel an active subscription', async () => {
      // Mock existing subscription
      jest.spyOn(subscriptionService, 'getSubscriptionById').mockResolvedValue({
        id: subscriptionId,
        status: SubscriptionStatus.ACTIVE,
        metadata: JSON.stringify({ test: 'data' })
      } as schema.Subscription);
      
      // Mock returning to return the cancelled subscription
      (db.update().set().where().returning as jest.Mock).mockResolvedValue([
        { id: subscriptionId, status: SubscriptionStatus.CANCELLED }
      ]);
      
      const result = await subscriptionService.cancelSubscription(subscriptionId, reason);
      
      // Check result has expected values
      expect(result).toEqual(expect.objectContaining({
        id: subscriptionId,
        status: SubscriptionStatus.CANCELLED
      }));
      
      // Check that metadata was updated with reason
      expect(db.update).toHaveBeenCalledWith(schema.subscriptions);
      expect(db.set).toHaveBeenCalledWith(expect.objectContaining({
        status: SubscriptionStatus.CANCELLED,
        metadata: expect.stringContaining(reason)
      }));
    });
    
    it('should throw error when subscription does not exist', async () => {
      // Mock subscription not found
      jest.spyOn(subscriptionService, 'getSubscriptionById').mockResolvedValue(null);
      
      await expect(subscriptionService.cancelSubscription(subscriptionId, reason))
        .rejects.toThrow(SubscriptionServiceErrors.SUBSCRIPTION_NOT_FOUND.message);
    });
    
    it('should throw error when subscription is not active', async () => {
      // Mock subscription that is already cancelled
      jest.spyOn(subscriptionService, 'getSubscriptionById').mockResolvedValue({
        id: subscriptionId,
        status: SubscriptionStatus.CANCELLED,
        metadata: null
      } as schema.Subscription);
      
      await expect(subscriptionService.cancelSubscription(subscriptionId, reason))
        .rejects.toThrow(SubscriptionServiceErrors.INVALID_CANCELLATION.message);
    });
  });
  
  describe('processWebhook', () => {
    const webhookData = {
      provider: PaymentProvider.PAYSTACK,
      event: 'subscription.create',
      data: {
        customer: {
          metadata: {
            user_id: '1'
          },
          customer_code: 'test-customer-code'
        },
        plan: {
          name: 'premium'
        },
        amount: 10000, // 100.00 in kobo
        reference: 'test-reference',
        subscription_code: 'test-subscription-code'
      }
    };
    
    it('should process Paystack subscription create webhook', async () => {
      // Mock processPaystackWebhook
      jest.spyOn(subscriptionService as any, 'processPaystackWebhook')
        .mockResolvedValue(true);
      
      const result = await subscriptionService.processWebhook(webhookData);
      
      // Check that validation was called
      expect(require('@shared/schema-validation').subscriptionValidation.webhook).toHaveBeenCalled();
      
      expect(result).toBe(true);
      expect((subscriptionService as any).processPaystackWebhook).toHaveBeenCalledWith(
        webhookData.event,
        webhookData.data
      );
    });
    
    it('should handle Flutterwave webhooks', async () => {
      const flutterwaveWebhook = {
        ...webhookData,
        provider: PaymentProvider.FLUTTERWAVE
      };
      
      // Mock processFlutterwaveWebhook
      jest.spyOn(subscriptionService as any, 'processFlutterwaveWebhook')
        .mockResolvedValue(true);
      
      const result = await subscriptionService.processWebhook(flutterwaveWebhook);
      
      expect(result).toBe(true);
      expect((subscriptionService as any).processFlutterwaveWebhook).toHaveBeenCalledWith(
        flutterwaveWebhook.event,
        flutterwaveWebhook.data
      );
    });
    
    it('should throw error for unsupported provider', async () => {
      const unsupportedWebhook = {
        ...webhookData,
        provider: 'unsupported' as PaymentProvider
      };
      
      await expect(subscriptionService.processWebhook(unsupportedWebhook))
        .rejects.toThrow('Unsupported payment provider');
    });
  });
  
  describe('validateSubscriptionAccess', () => {
    const userId = 1;
    
    it('should return true when user has required plan', async () => {
      // Mock active subscription with premium plan
      jest.spyOn(subscriptionService, 'getActiveSubscription').mockResolvedValue({
        id: 1,
        userId,
        plan: SubscriptionPlan.PREMIUM,
        status: SubscriptionStatus.ACTIVE
      } as schema.Subscription);
      
      // Check access for basic plan (which is lower than premium)
      const result = await subscriptionService.validateSubscriptionAccess(userId, SubscriptionPlan.BASIC);
      
      expect(result).toBe(true);
    });
    
    it('should return false when user does not have required plan', async () => {
      // Mock active subscription with basic plan
      jest.spyOn(subscriptionService, 'getActiveSubscription').mockResolvedValue({
        id: 1,
        userId,
        plan: SubscriptionPlan.BASIC,
        status: SubscriptionStatus.ACTIVE
      } as schema.Subscription);
      
      // Check access for premium plan (which is higher than basic)
      const result = await subscriptionService.validateSubscriptionAccess(userId, SubscriptionPlan.PREMIUM);
      
      expect(result).toBe(false);
    });
    
    it('should return false when user has no active subscription', async () => {
      // Mock no active subscription
      jest.spyOn(subscriptionService, 'getActiveSubscription').mockResolvedValue(null);
      
      const result = await subscriptionService.validateSubscriptionAccess(userId, SubscriptionPlan.BASIC);
      
      expect(result).toBe(false);
    });
    
    it('should return true when checking for any subscription', async () => {
      // Mock active subscription
      jest.spyOn(subscriptionService, 'getActiveSubscription').mockResolvedValue({
        id: 1,
        userId,
        plan: SubscriptionPlan.BASIC,
        status: SubscriptionStatus.ACTIVE
      } as schema.Subscription);
      
      // Check access without specifying required plan
      const result = await subscriptionService.validateSubscriptionAccess(userId);
      
      expect(result).toBe(true);
    });
  });
});
