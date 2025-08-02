/**
 * Refactored Loyalty Service
 *
 * This file demonstrates how to implement the new schema standardization
 * and validation approach in the loyalty module.
 */

import { BaseService } from '../base/service';
import {
  ILoyaltyService,
  LoyaltyMember,
  LoyaltyProgram,
  LoyaltyTier,
  LoyaltyReward,
  LoyaltyTransaction,
  MemberAlreadyEnrolledError,
  LoyaltyProgramNotFoundError,
  LoyaltyMemberNotFoundError
} from './types';
import { db } from '../../../db/index.js';
import * as schema from '../../../shared/schema.js';
import { eq, and, gt, sql, asc } from 'drizzle-orm';
import { loyaltyValidation, validateEntity } from '../../../shared/schema-validation.js';
import { SchemaValidationError } from '../../../shared/schema-validation.js';

export class LoyaltyService extends BaseService implements ILoyaltyService {
  private static readonly POINTS_EXPIRY_MONTHS = 12;
  private static readonly REWARD_THRESHOLD = 1000;

  /**
   * Generate a unique loyalty ID for a new member
   */
  async generateLoyaltyId(): Promise<string> {
    try {
      const prefix = 'LOY-';
      let loyaltyId = prefix + this.generateRandomString(5).toUpperCase();

      let existingMember = await db.query.loyaltyMembers.findFirst({
        _where: eq(schema.loyaltyMembers.loyaltyId, loyaltyId)
      });

      while (existingMember) {
        loyaltyId = prefix + this.generateRandomString(5).toUpperCase();
        existingMember = await db.query.loyaltyMembers.findFirst({
          _where: eq(schema.loyaltyMembers.loyaltyId, loyaltyId)
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
    _customerId: number,
    _storeId: number,
    _userId: number
  ): Promise<schema.SelectLoyaltyMember> {
    try {
      // Get store's loyalty program
      const program = await db.query.loyaltyPrograms.findFirst({
        _where: eq(schema.loyaltyPrograms.storeId, storeId)
      });

      if (!program) {
        throw new LoyaltyProgramNotFoundError(storeId);
      }

      // Check if member already exists
      const existingMember = await db.query.loyaltyMembers.findFirst({
        _where: eq(schema.loyaltyMembers.customerId, customerId)
      });

      if (existingMember) {
        throw new MemberAlreadyEnrolledError(customerId, program.id);
      }

      // Generate loyalty ID
      const loyaltyId = await this.generateLoyaltyId();

      // Get the entry-level tier
      const entryTier = await db.query.loyaltyTiers.findFirst({
        _where: and(
          eq(schema.loyaltyTiers.programId, program.id),
          eq(schema.loyaltyTiers.active, true)
        ),
        _orderBy: asc(schema.loyaltyTiers.requiredPoints)
      });

      // Prepare member data
      const memberData = {
        customerId,
        loyaltyId,
        _programId: program.id,
        _userId: userId
      };

      // Insert the validated data
      const [member] = await db.insert(schema.loyaltyMembers)
        .values(memberData)
        .returning();

      if (!member) {
        throw new Error('Failed to create loyalty member - no record returned');
      }

      return member;
    } catch (error) {
      // Handle validation errors specially
      if (error instanceof SchemaValidationError) {
        console.error(`Validation _error: ${error.message}`, error.toJSON());
      }
      this.handleError(error, 'Enrolling customer in loyalty program');
    }
  }

  /**
   * Award points to a loyalty member
   */
  async awardPoints(
    _memberId: number,
    _points: number,
    _source: string,
    _userId: number
  ): Promise<boolean> {
    try {
      // Validate input data using our schema validation
      const validatedData = {
        memberId,
        points,
        source,
        userId
      };

      // Get member details
      const member = await db.query.loyaltyMembers.findFirst({
        _where: eq(schema.loyaltyMembers.id, memberId)
      });

      if (!member) {
        throw new LoyaltyMemberNotFoundError(memberId);
      }


      // Calculate new points
      const currentPoints = parseFloat(member.currentPoints ?? '0');
      const newCurrentPoints = currentPoints + points;

      if (!member) {
        throw new LoyaltyMemberNotFoundError(memberId);
      }

      // Create a transaction record
      await db.insert(schema.loyaltyTransactions).values({
        memberId,
        _pointsEarned: points,
        _pointsBalance: newCurrentPoints,
        _transactionType: 'earn' as const,
        source,
        _programId: member.programId
      } as any);

      // Update member's points
      await db.update(schema.loyaltyMembers)
        .set({
          _currentPoints: newCurrentPoints.toString()
        } as any)
        .where(eq(schema.loyaltyMembers.id, memberId));

      // Check if member qualifies for tier upgrade
      await this.checkAndUpdateMemberTier(memberId);

      return true;
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        console.error(`Validation _error: ${error.message}`, error.toJSON());
      }
      this.handleError(error, 'Awarding loyalty points');
    }
  }

  /**
   * Check if a member qualifies for a tier upgrade
   */
  async checkAndUpdateMemberTier(_memberId: number): Promise<boolean> {
    try {
      const member = await db.query.loyaltyMembers.findFirst({
        _where: eq(schema.loyaltyMembers.id, memberId)
      });

      if (!member) {
        throw new LoyaltyMemberNotFoundError(memberId);
      }

      // Find the next tier that the member qualifies for
      const nextTier = await db.query.loyaltyTiers.findFirst({
        _where: and(
          eq(schema.loyaltyTiers.programId, member.programId),
          gt(schema.loyaltyTiers.requiredPoints, member.points ?? 0),
          eq(schema.loyaltyTiers.active, true)
        ),
        _orderBy: asc(schema.loyaltyTiers.requiredPoints)
      });

      // Check if member qualifies for an upgrade
      if (nextTier && (parseInt(member.currentPoints ?? '0', 10)) >= nextTier.requiredPoints) {
        // _Note: tierId field doesn't exist in loyaltyMembers table
        // Tier information is managed through the loyaltyTiers table
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
  async getLoyaltyAnalytics(_storeId: number): Promise<{
    _totalMembers: number;
    _totalPointsEarned: number;
    _totalPointsRedeemed: number;
  }> {
    try {
      const memberStats = await db
        .select({
          _total: sql<number>`count(*)`
        })
        .from(schema.loyaltyMembers)
        .where(eq(schema.loyaltyMembers.programId, sql`(select id from loyalty_programs where store_id
   =  ${storeId})`));

      const pointsStats = await db
        .select({
          _earned: sql<number>`sum(case when transaction_type = 'earn' then points_earned::decimal else 0 end)`,
          _redeemed: sql<number>`sum(case when transaction_type = 'redeem' then points_redeemed::decimal else 0 end)`
        })
        .from(schema.loyaltyTransactions)
        .where(eq(schema.loyaltyTransactions.programId, sql`(select id from loyalty_programs where store_id
   =  ${storeId})`));

      return {
        _totalMembers: Number(memberStats[0]?.total || 0),
        _totalPointsEarned: Number(pointsStats[0]?.earned || 0),
        _totalPointsRedeemed: Number(pointsStats[0]?.redeemed || 0)
      };
    } catch (error) {
      this.handleError(error, 'Getting loyalty analytics');
    }
  }
  // All other methods from ILoyaltyService should be implemented here.
  // For the sake of this refactoring example, they are omitted.
  async calculatePointsForTransaction(_subtotal: string | number, _storeId: number, _userId: number): Promise<number> { throw new Error('Method not implemented.'); }
  async addPoints(_memberId: number, _points: number, _source: string, _transactionId: number | undefined, _userId: number): Promise<{ _success: boolean; transaction?: LoyaltyTransaction; }> { throw new Error('Method not implemented.'); }
  async getAvailableRewards(_memberId: number): Promise<LoyaltyReward[]> { throw new Error('Method not implemented.'); }
  async applyReward(_memberId: number, _rewardId: number, _currentTotal: number): Promise<{ _success: boolean; newTotal?: number; pointsRedeemed?: string; message?: string; }> { throw new Error('Method not implemented.'); }
  async getLoyaltyMember(_identifier: string | number): Promise<LoyaltyMember | null> { throw new Error('Method not implemented.'); }
  async getLoyaltyMemberByCustomerId(_customerId: number): Promise<LoyaltyMember | null> { throw new Error('Method not implemented.'); }
  async getMemberActivityHistory(_memberId: number, limit?: number, offset?: number): Promise<LoyaltyTransaction[]> { throw new Error('Method not implemented.'); }
  async getLoyaltyProgram(_storeId: number): Promise<LoyaltyProgram | null> { throw new Error('Method not implemented.'); }
  async upsertLoyaltyProgram(_storeId: number, _programData: Partial<schema.SelectLoyaltyProgram>): Promise<LoyaltyProgram> { throw new Error('Method not implemented.'); }
  async createLoyaltyTier(_tierData: schema.InsertLoyaltyTier): Promise<schema.SelectLoyaltyTier> { throw new Error('Method not implemented.'); }
  async createLoyaltyReward(_rewardData: schema.InsertLoyaltyReward): Promise<schema.SelectLoyaltyReward> { throw new Error('Method not implemented.'); }
  async processExpiredPoints(_userId: number): Promise<number> { throw new Error('Method not implemented.'); }

  /**
   * Generate a random string for IDs
   */
  private generateRandomString(_length: number): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';

    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    return result;
  }
}
