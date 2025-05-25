/**
 * Refactored Loyalty Service
 * 
 * This file demonstrates how to implement the new schema standardization
 * and validation approach in the loyalty module.
 */

import { BaseService } from '../base/service';
import { ILoyaltyService, ILoyaltyServiceErrors, LoyaltyServiceErrors } from './types';
import { db } from '@db';
import * as schema from '@shared/schema';
import { eq, and, gt, lt, desc, sql, asc } from 'drizzle-orm';
import { loyaltyValidation } from '@shared/schema-validation';
import { SchemaValidationError } from '@shared/schema-validation';

export class LoyaltyService extends BaseService implements ILoyaltyService {
  private static readonly POINTS_EXPIRY_MONTHS = 12;
  private static readonly REWARD_THRESHOLD = 1000;

  /**
   * Generate a unique loyalty ID for a new member
   */
  async generateLoyaltyId(): Promise<string> {
    try {
      const prefix = "LOY-";
      let loyaltyId = prefix + this.generateRandomString(5).toUpperCase();
      
      let existingMember = await db.query.loyaltyMembers.findFirst({
        where: eq(schema.loyaltyMembers.loyaltyId, loyaltyId)
      });
      
      while (existingMember) {
        loyaltyId = prefix + this.generateRandomString(5).toUpperCase();
        existingMember = await db.query.loyaltyMembers.findFirst({
          where: eq(schema.loyaltyMembers.loyaltyId, loyaltyId)
        });
      }
      
      return loyaltyId;
    } catch (error) {
      this.handleError(error, 'Generating loyalty ID');
    }
  }

  /**
   * Enroll a customer in the loyalty program
   */
  async enrollCustomer(
    customerId: number,
    storeId: number,
    userId: number
  ): Promise<schema.LoyaltyMember> {
    try {
      // Check if member already exists
      const existingMember = await db.query.loyaltyMembers.findFirst({
        where: eq(schema.loyaltyMembers.customerId, customerId)
      });

      if (existingMember) {
        throw LoyaltyServiceErrors.DUPLICATE_MEMBER;
      }

      // Get store's loyalty program
      const program = await db.query.loyaltyPrograms.findFirst({
        where: eq(schema.loyaltyPrograms.storeId, storeId)
      });

      if (!program) {
        throw LoyaltyServiceErrors.PROGRAM_NOT_FOUND;
      }

      // Generate loyalty ID
      const loyaltyId = await this.generateLoyaltyId();
      
      // Get the entry-level tier
      const entryTier = await db.query.loyaltyTiers.findFirst({
        where: and(
          eq(schema.loyaltyTiers.programId, program.id),
          eq(schema.loyaltyTiers.active, true)
        ),
        orderBy: asc(schema.loyaltyTiers.requiredPoints)
      });

      // Prepare member data
      const memberData = {
        customerId,
        loyaltyId,
        currentPoints: "0",
        totalPointsEarned: "0",
        totalPointsRedeemed: "0",
        tierId: entryTier?.id,
        enrollmentDate: new Date(),
        lastActivity: new Date(),
        isActive: true,
        programId: program.id
      };

      // Validate the data against our schema
      const validatedData = loyaltyValidation.member.insert(memberData);

      // Insert the validated data
      const [member] = await db.insert(schema.loyaltyMembers)
        .values(validatedData)
        .returning();

      return member;
    } catch (error) {
      // Handle validation errors specially
      if (error instanceof SchemaValidationError) {
        console.error(`Validation error: ${error.message}`, error.toJSON());
      }
      this.handleError(error, 'Enrolling customer in loyalty program');
    }
  }

  /**
   * Award points to a loyalty member
   */
  async awardPoints(
    memberId: number,
    points: number,
    source: string,
    userId: number
  ): Promise<boolean> {
    try {
      // Validate input data using our schema validation
      const validatedData = loyaltyValidation.earnPoints({
        memberId,
        points,
        source,
        userId
      });

      // Get member details
      const member = await db.query.loyaltyMembers.findFirst({
        where: eq(schema.loyaltyMembers.id, memberId),
        with: {
          program: true
        }
      });

      if (!member) {
        throw LoyaltyServiceErrors.CUSTOMER_NOT_FOUND;
      }

      if (!member.isActive) {
        throw new Error("Member account is not active");
      }

      // Calculate new points
      const currentPoints = parseFloat(member.currentPoints);
      const totalEarned = parseFloat(member.totalPointsEarned);
      const newCurrentPoints = currentPoints + points;
      const newTotalEarned = totalEarned + points;

      // Create a transaction record
      await db.insert(schema.loyaltyTransactions).values({
        memberId,
        transactionAmount: points.toString(),
        transactionType: "earn",
        source,
        programId: member.program.id,
        createdAt: new Date()
      });

      // Update member's points
      await db.update(schema.loyaltyMembers)
        .set({
          currentPoints: newCurrentPoints.toString(),
          totalPointsEarned: newTotalEarned.toString(),
          lastActivity: new Date(),
          updatedAt: new Date()
        })
        .where(eq(schema.loyaltyMembers.id, memberId));

      // Check if member qualifies for tier upgrade
      await this.checkAndUpdateTier(memberId, userId);

      return true;
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        console.error(`Validation error: ${error.message}`, error.toJSON());
      }
      this.handleError(error, 'Awarding loyalty points');
    }
  }

  /**
   * Check if a member qualifies for a tier upgrade
   */
  private async checkAndUpdateTier(memberId: number, userId: number): Promise<boolean> {
    try {
      const member = await db.query.loyaltyMembers.findFirst({
        where: eq(schema.loyaltyMembers.id, memberId)
      });

      if (!member) {
        throw LoyaltyServiceErrors.CUSTOMER_NOT_FOUND;
      }

      const currentTier = await db.query.loyaltyTiers.findFirst({
        where: eq(schema.loyaltyTiers.id, member.tierId)
      });

      // Find the next tier that the member qualifies for
      const nextTier = await db.query.loyaltyTiers.findFirst({
        where: and(
          eq(schema.loyaltyTiers.programId, member.programId),
          gt(schema.loyaltyTiers.requiredPoints, parseFloat(member.currentPoints)),
          eq(schema.loyaltyTiers.active, true)
        ),
        orderBy: asc(schema.loyaltyTiers.requiredPoints)
      });

      // Check if member qualifies for an upgrade
      if (nextTier && parseFloat(member.currentPoints) >= parseFloat(nextTier.requiredPoints)) {
        await db.update(schema.loyaltyMembers)
          .set({
            tierId: nextTier.id,
            updatedAt: new Date()
          })
          .where(eq(schema.loyaltyMembers.id, memberId));

        return true;
      }

      return false;
    } catch (error) {
      this.handleError(error, 'Checking and updating member tier');
    }
  }

  /**
   * Get analytics data for a store's loyalty program
   */
  async getLoyaltyAnalytics(storeId: number): Promise<{
    memberCount: number;
    activeMembers: number;
    totalPointsEarned: string;
    totalPointsRedeemed: string;
    pointsBalance: string;
    programDetails: schema.LoyaltyProgram | null;
    topRewards: Array<{ name: string; redemptions: number }>;
  }> {
    try {
      const [memberStats, pointsStats, program, topRewards] = await db.transaction(async (tx) => {
        // Get member statistics
        const memberStats = await tx
          .select({
            total: sql<number>`count(*)`,
            active: sql<number>`count(*) filter (where ${schema.loyaltyMembers.isActive} = true)`
          })
          .from(schema.loyaltyMembers)
          .where(eq(schema.loyaltyMembers.customerId, sql`(SELECT id FROM customers WHERE store_id = ${storeId} LIMIT 1)`));

        // Get points statistics using raw SQL since we don't have a redemptions table yet
        const pointsStats = await tx
          .select({
            earned: sql<number>`COALESCE(sum(${schema.loyaltyTransactions.transactionAmount}), 0)`,
            redeemed: sql<number>`0` // Placeholder until redemptions table is implemented
          })
          .from(schema.loyaltyMembers)
          .where(eq(schema.loyaltyMembers.customerId, sql`(SELECT id FROM customers WHERE store_id = ${storeId} LIMIT 1)`))
          .leftJoin(schema.loyaltyTransactions, eq(schema.loyaltyTransactions.memberId, schema.loyaltyMembers.id));

        // Get program details
        const program = await tx.query.loyaltyPrograms.findFirst({
          where: eq(schema.loyaltyPrograms.storeId, storeId)
        });

        // Get top rewards (placeholder until we implement redemptions)
        const topRewards = await tx
          .select({
            name: schema.loyaltyRewards.name,
            redemptions: sql<number>`0` // Placeholder until redemptions table is implemented
          })
          .from(schema.loyaltyRewards)
          .where(eq(schema.loyaltyRewards.programId, program?.id || 0))
          .limit(5);

        return [memberStats[0], pointsStats[0], program, topRewards];
      });

      // Calculate points balance
      const earned = parseFloat(pointsStats?.earned?.toString() || "0");
      const redeemed = parseFloat(pointsStats?.redeemed?.toString() || "0");
      const balance = earned - redeemed;

      return {
        memberCount: memberStats?.total || 0,
        activeMembers: memberStats?.active || 0,
        totalPointsEarned: earned.toFixed(2),
        totalPointsRedeemed: redeemed.toFixed(2),
        pointsBalance: balance.toFixed(2),
        programDetails: program,
        topRewards: topRewards || []
      };
    } catch (error) {
      this.handleError(error, 'Getting loyalty analytics');
    }
  }

  /**
   * Generate a random string for IDs
   */
  private generateRandomString(length: number): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    return result;
  }
}
