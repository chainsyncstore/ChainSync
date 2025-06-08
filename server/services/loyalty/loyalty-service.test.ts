/**
 * Loyalty Service Tests
 *
 * This test suite demonstrates the standardized testing patterns
 * for ChainSync services, including:
 * - Unit tests with mocks
 * - Integration tests with test database
 * - Validation testing
 * - Error handling testing
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { z } from 'zod';

import { LoyaltyService } from './loyalty-service';
import { ValidationError } from '../../../shared/types/errors';
import {
  startTestTransaction,
  rollbackTestTransaction,
  createTestStore,
  createTestCustomer,
} from '../../../test/utils/test-helpers';
import { db } from '../../db/connection';
import { loyaltyPrograms, loyaltyMembers, loyaltyTransactions } from '../../db/schema';
import { findById, insertOne, findMany } from '../../db/sqlHelpers';

// Test data schemas for validation
const testProgramSchema = z.object({
  name: z.string().min(3),
  description: z.string().optional(),
  pointsPerDollar: z.number().positive(),
  storeId: z.string().uuid(),
  isActive: z.boolean().default(true),
});

// Mock logger for unit tests
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  child: jest.fn(() => mockLogger),
};

describe('LoyaltyService', () => {
  // Unit tests with mocks
  describe('Unit Tests', () => {
    let service: LoyaltyService;
    const mockDb = {
      query: jest.fn(),
      execute: jest.fn(),
      transaction: jest.fn(callback => callback(mockDb)),
    };

    beforeEach(() => {
      service = new LoyaltyService(mockDb as any, mockLogger as any);
      jest.clearAllMocks();
    });

    it('should create a loyalty program with valid data', async () => {
      // Arrange
      const programData = {
        name: 'Test Program',
        description: 'A test loyalty program',
        pointsPerDollar: 10,
        storeId: '123e4567-e89b-12d3-a456-426614174000',
        isActive: true,
      };

      mockDb.execute.mockResolvedValueOnce([
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          ...programData,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      // Act
      const result = await service.createLoyaltyProgram(programData);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBeTruthy();
      expect(result.name).toBe(programData.name);
      expect(mockDb.execute).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Created loyalty program'),
          programId: expect.any(String),
        })
      );
    });

    it('should throw validation error for invalid program data', async () => {
      // Arrange
      const invalidData = {
        name: 'A', // Too short
        pointsPerDollar: -5, // Negative
        storeId: '123e4567-e89b-12d3-a456-426614174000',
      };

      // Act & Assert
      await expect(service.createLoyaltyProgram(invalidData as any)).rejects.toThrow(
        ValidationError
      );

      expect(mockDb.execute).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Validation failed'),
          error: expect.any(Object),
        })
      );
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const programData = {
        name: 'Test Program',
        description: 'A test loyalty program',
        pointsPerDollar: 10,
        storeId: '123e4567-e89b-12d3-a456-426614174000',
        isActive: true,
      };

      const dbError = new Error('Database connection lost');
      mockDb.execute.mockRejectedValueOnce(dbError);

      // Act & Assert
      await expect(service.createLoyaltyProgram(programData)).rejects.toThrow(
        'Failed to create loyalty program'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Failed to create loyalty program'),
          error: expect.any(Object),
        })
      );
    });
  });

  // Integration tests with actual database
  describe('Integration Tests', () => {
    let service: LoyaltyService;

    beforeEach(async () => {
      // Use real DB but with transaction for isolation
      await startTestTransaction();
      service = new LoyaltyService();
    });

    afterEach(async () => {
      // Rollback transaction to clean up
      await rollbackTestTransaction();
    });

    it('should create and retrieve a loyalty program', async () => {
      // Arrange - Create a test store
      const testStore = await createTestStore();

      const programData = {
        name: 'Gold Rewards',
        description: 'Rewards program for frequent shoppers',
        pointsPerDollar: 5,
        storeId: testStore.id,
        isActive: true,
      };

      // Act - Create program
      const program = await service.createLoyaltyProgram(programData);

      // Assert - Verify program was created
      expect(program).toBeDefined();
      expect(program.id).toBeTruthy();
      expect(program.name).toBe(programData.name);

      // Act - Retrieve program
      const retrieved = await service.getLoyaltyProgramById(program.id);

      // Assert - Verify retrieved program
      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(program.id);
      expect(retrieved.name).toBe(programData.name);
    });

    it('should enroll a customer in a loyalty program', async () => {
      // Arrange - Create test store, program, and customer
      const testStore = await createTestStore();
      const testCustomer = await createTestCustomer();

      const program = await service.createLoyaltyProgram({
        name: 'Silver Rewards',
        description: 'Basic rewards program',
        pointsPerDollar: 2,
        storeId: testStore.id,
        isActive: true,
      });

      // Act - Enroll customer
      const member = await service.enrollCustomer({
        customerId: testCustomer.id,
        programId: program.id,
        startingPoints: 100,
        tierLevel: 1,
      });

      // Assert - Verify membership
      expect(member).toBeDefined();
      expect(member.customerId).toBe(testCustomer.id);
      expect(member.programId).toBe(program.id);
      expect(member.points).toBe(100);
      expect(member.tierLevel).toBe(1);

      // Act - Check if customer is enrolled
      const isEnrolled = await service.isCustomerEnrolled(testCustomer.id, program.id);

      // Assert
      expect(isEnrolled).toBe(true);
    });

    it('should award points for a purchase', async () => {
      // Arrange - Create test data
      const testStore = await createTestStore();
      const testCustomer = await createTestCustomer();

      const program = await service.createLoyaltyProgram({
        name: 'Bronze Rewards',
        description: 'Entry-level rewards',
        pointsPerDollar: 1,
        storeId: testStore.id,
        isActive: true,
      });

      const member = await service.enrollCustomer({
        customerId: testCustomer.id,
        programId: program.id,
        startingPoints: 50,
        tierLevel: 1,
      });

      const purchaseAmount = 100.0;

      // Act - Award points for purchase
      const transaction = await service.awardPointsForPurchase({
        memberId: member.id,
        purchaseAmount,
        orderId: 'order-123',
        storeId: testStore.id,
      });

      // Calculate expected points (purchaseAmount * pointsPerDollar)
      const expectedPoints = purchaseAmount * program.pointsPerDollar;

      // Assert - Verify transaction
      expect(transaction).toBeDefined();
      expect(transaction.points).toBe(expectedPoints);
      expect(transaction.type).toBe('purchase');

      // Act - Get updated member
      const updatedMember = await service.getMemberById(member.id);

      // Assert - Verify points were added to member
      expect(updatedMember.points).toBe(member.points + expectedPoints);
    });

    it('should handle concurrent transactions correctly', async () => {
      // Arrange - Create test data
      const testStore = await createTestStore();
      const testCustomer = await createTestCustomer();

      const program = await service.createLoyaltyProgram({
        name: 'Concurrency Test Program',
        pointsPerDollar: 1,
        storeId: testStore.id,
        isActive: true,
      });

      const member = await service.enrollCustomer({
        customerId: testCustomer.id,
        programId: program.id,
        startingPoints: 0,
        tierLevel: 1,
      });

      // Act - Run multiple point transactions concurrently
      const transaction1 = service.awardPointsForPurchase({
        memberId: member.id,
        purchaseAmount: 50,
        orderId: 'order-1',
        storeId: testStore.id,
      });

      const transaction2 = service.awardPointsForPurchase({
        memberId: member.id,
        purchaseAmount: 75,
        orderId: 'order-2',
        storeId: testStore.id,
      });

      // Wait for both transactions to complete
      await Promise.all([transaction1, transaction2]);

      // Act - Get updated member
      const updatedMember = await service.getMemberById(member.id);

      // Assert - Verify total points (50 + 75 = 125 points)
      expect(updatedMember.points).toBe(125);
    });

    it('should handle error conditions', async () => {
      // Test for non-existent program
      await expect(service.getLoyaltyProgramById('non-existent-id')).rejects.toThrow(
        'Loyalty program not found'
      );

      // Test for invalid enrollment (non-existent program)
      const testCustomer = await createTestCustomer();
      await expect(
        service.enrollCustomer({
          customerId: testCustomer.id,
          programId: 'non-existent-id',
          startingPoints: 0,
          tierLevel: 1,
        })
      ).rejects.toThrow('Loyalty program not found');

      // Test for duplicate enrollment
      const testStore = await createTestStore();
      const program = await service.createLoyaltyProgram({
        name: 'Error Test Program',
        pointsPerDollar: 1,
        storeId: testStore.id,
        isActive: true,
      });

      await service.enrollCustomer({
        customerId: testCustomer.id,
        programId: program.id,
        startingPoints: 0,
        tierLevel: 1,
      });

      // Try to enroll the same customer again
      await expect(
        service.enrollCustomer({
          customerId: testCustomer.id,
          programId: program.id,
          startingPoints: 0,
          tierLevel: 1,
        })
      ).rejects.toThrow('Customer is already enrolled');
    });
  });

  // Validation tests
  describe('Validation', () => {
    let service: LoyaltyService;

    beforeEach(() => {
      service = new LoyaltyService(undefined, mockLogger as any);
      jest.clearAllMocks();
    });

    it('should validate program data', () => {
      // Test valid data
      const validData = {
        name: 'Test Program',
        description: 'A test loyalty program',
        pointsPerDollar: 10,
        storeId: '123e4567-e89b-12d3-a456-426614174000',
        isActive: true,
      };

      expect(() => testProgramSchema.parse(validData)).not.toThrow();

      // Test invalid data cases
      expect(() =>
        testProgramSchema.parse({
          ...validData,
          name: 'A', // Too short
        })
      ).toThrow();

      expect(() =>
        testProgramSchema.parse({
          ...validData,
          pointsPerDollar: 0, // Not positive
        })
      ).toThrow();

      expect(() =>
        testProgramSchema.parse({
          ...validData,
          storeId: 'not-a-uuid',
        })
      ).toThrow();
    });

    it('should validate transaction data', () => {
      // Define transaction schema inline for this test
      const transactionSchema = z.object({
        memberId: z.string().uuid(),
        points: z.number().int().positive(),
        type: z.enum(['purchase', 'redemption', 'adjustment', 'expiration']),
        referenceId: z.string().optional(),
        description: z.string().optional(),
      });

      // Test valid data
      const validData = {
        memberId: '123e4567-e89b-12d3-a456-426614174000',
        points: 100,
        type: 'purchase' as const,
        referenceId: 'order-123',
      };

      expect(() => transactionSchema.parse(validData)).not.toThrow();

      // Test invalid data cases
      expect(() =>
        transactionSchema.parse({
          ...validData,
          points: -50, // Negative points
        })
      ).toThrow();

      expect(() =>
        transactionSchema.parse({
          ...validData,
          type: 'invalid-type' as any, // Invalid enum value
        })
      ).toThrow();
    });
  });
});
