import { AppError, ErrorCode, ErrorCategory } from '@shared/types/errors';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';

import { LoyaltyMember, MemberWithDetails } from './types';
import {
  loyaltyMembers,
  loyaltyPrograms,
  loyaltyTiers,
  loyaltyRewards,
  loyaltyTransactions,
  users,
  customers,
} from '../../../shared/db';
import { BaseService, ServiceConfig } from '../base/standard-service';

// --- Schemas ---
export const memberCreateSchema = z.object({
  loyaltyId: z.string(),
  customerId: z.number(),
  programId: z.number(),
  tierId: z.number().nullable(),
  points: z.number(),
});

export const memberUpdateSchema = memberCreateSchema.partial();

// --- Utility Functions ---
export function generateLoyaltyId(): string {
  return 'LOYALTY-' + Math.random().toString(36).substring(2, 10).toUpperCase();
}

export class LoyaltyService extends BaseService<
  typeof loyaltyMembers,
  z.infer<typeof memberCreateSchema>,
  z.infer<typeof memberUpdateSchema>
> {
  protected readonly entityName = 'loyalty_member';
  protected readonly tableName = 'loyalty_members'; // String tableName for BaseService
  protected readonly primaryKeyField = 'id';
  protected readonly createSchema = memberCreateSchema;
  protected readonly updateSchema = memberUpdateSchema;

  // Cache TTLs (in seconds)
  private readonly CACHE_TTL = {
    MEMBER: 3600, // 1 hour
    PROGRAM: 3600, // 1 hour
    TIER: 3600, // 1 hour
    REWARD: 3600, // 1 hour
    TRANSACTION: 1800, // 30 minutes
    LIST: 300, // 5 minutes
  };

  /**
   * Helper method to safely convert any value to a string for SQL
   * Uses the proper Drizzle pattern to avoid TypeScript errors
   */
  safeToString(value: any): string {
    return String(value);
  }

  constructor(config: ServiceConfig) {
    super(config);
    this.logger.info('LoyaltyService initialized');
  }

  /**
   * Get member with customer, program, and tier details
   */
  async getMemberWithDetails(id: number): Promise<MemberWithDetails | null> {
    try {
      const cacheKey = `loyalty:member:details:${id}`;
      if (this.cache) {
        const cached = await this.cache.get(cacheKey);
        if (cached) {
          this.logger.debug(`Cache hit for ${cacheKey}`);
          return cached as MemberWithDetails;
        }
      }

      // Use raw SQL to avoid type issues with Drizzle
      const query = sql`
        SELECT 
          m.id, m.loyalty_id, m.customer_id, m.program_id, m.tier_id, m.points, m.created_at, m.updated_at,
          c.id as customer_id, c.name as customer_name, c.email as customer_email, c.phone as customer_phone,
          p.id as program_id, p.name as program_name,
          t.id as tier_id, t.name as tier_name
        FROM loyalty_members m
        INNER JOIN customers c ON m.customer_id = c.id
        INNER JOIN loyalty_programs p ON m.program_id = p.id
        LEFT JOIN loyalty_tiers t ON m.tier_id = t.id
        WHERE m.id = ${this.safeToString(id)}
        LIMIT 1
      `;

      const result = await this.executeQuery(async db => {
        return db.execute(query);
      }, 'loyalty.getMemberWithDetails');

      // Type-safe check for empty results
      const rows = result.rows || [];
      if (rows.length === 0) {
        return null;
      }

      const row = rows[0] as Record<string, any>;

      // Create properly structured MemberWithDetails object
      const memberWithDetails: MemberWithDetails = {
        id: Number(row.id),
        loyaltyId: String(row.loyalty_id),
        customerId: Number(row.customer_id),
        programId: Number(row.program_id),
        tierId: row.tier_id ? Number(row.tier_id) : null,
        points: Number(row.points),
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        customer: {
          id: Number(row.customer_id),
          name: row.customer_name ? String(row.customer_name) : '',
          email: String(row.customer_email),
          phone: row.customer_phone ? String(row.customer_phone) : undefined,
        },
        program: {
          id: Number(row.program_id),
          name: String(row.program_name),
        },
        tier: row.tier_id
          ? {
              id: Number(row.tier_id),
              name: String(row.tier_name),
            }
          : { id: 0, name: 'Default Tier' },
      };

      if (this.cache) {
        await this.cache.set(cacheKey, memberWithDetails, this.CACHE_TTL.MEMBER);
      }

      return memberWithDetails;
    } catch (error) {
      this.logger.error(`Error fetching loyalty member with details for ID: ${id}`, { error });
      throw new AppError(
        `Error fetching loyalty member with details`,
        ErrorCategory.SERVICE,
        ErrorCode.INTERNAL_SERVER_ERROR,
        { error, id }
      );
    }
  }

  /**
   * Get member by customer ID
   */
  async getMemberByCustomerId(customerId: number, storeId?: number): Promise<LoyaltyMember | null> {
    try {
      const cacheKey = `loyalty:member:customer:${customerId}:${storeId || 'all'}`;
      if (this.cache) {
        const cached = await this.cache.get(cacheKey);
        if (cached) {
          this.logger.debug(`Cache hit for ${cacheKey}`);
          return cached as LoyaltyMember;
        }
      }

      // Use raw SQL to avoid type issues with Drizzle
      let query;
      if (storeId !== undefined) {
        query = sql`
          SELECT m.* FROM loyalty_members m
          INNER JOIN loyalty_programs p ON m.program_id = p.id
          WHERE m.customer_id = ${this.safeToString(customerId)}
          AND p.store_id = ${this.safeToString(storeId)}
          LIMIT 1
        `;
      } else {
        query = sql`
          SELECT * FROM loyalty_members
          WHERE customer_id = ${this.safeToString(customerId)}
          LIMIT 1
        `;
      }

      const result = await this.executeQuery(async db => {
        return db.execute(query);
      }, 'loyalty.getMemberByCustomerId');

      // Ensure we have a properly structured LoyaltyMember
      let member: LoyaltyMember | null = null;
      const rows = result.rows || [];
      if (rows.length > 0) {
        const row = rows[0] as Record<string, any>;
        member = {
          id: Number(row.id),
          loyaltyId: String(row.loyalty_id),
          customerId: Number(row.customer_id),
          programId: Number(row.program_id),
          tierId: row.tier_id !== null ? Number(row.tier_id) : null,
          points: Number(row.points),
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at),
        };

        if (this.cache) {
          await this.cache.set(cacheKey, member, this.CACHE_TTL.MEMBER);
        }
      }

      return member;
    } catch (error) {
      this.logger.error(`Error fetching loyalty member by customer ID: ${customerId}`, { error });
      throw new AppError(
        `Error fetching loyalty member by customer ID`,
        ErrorCategory.SERVICE,
        ErrorCode.INTERNAL_SERVER_ERROR,
        { error, customerId }
      );
    }
  }

  /**
   * Get member by loyalty ID
   */
  async getMemberByLoyaltyId(loyaltyId: string): Promise<LoyaltyMember | null> {
    try {
      const cacheKey = `loyalty:member:loyaltyId:${loyaltyId}`;
      if (this.cache) {
        const cached = await this.cache.get(cacheKey);
        if (cached) {
          this.logger.debug(`Cache hit for ${cacheKey}`);
          return cached as LoyaltyMember;
        }
      }

      // Use raw SQL to avoid type issues with Drizzle
      const query = sql`
        SELECT * FROM loyalty_members
        WHERE loyalty_id = ${this.safeToString(loyaltyId)}
        LIMIT 1
      `;

      const result = await this.executeQuery(async db => {
        return db.execute(query);
      }, 'loyalty.getMemberByLoyaltyId');

      // Ensure we have a properly structured LoyaltyMember
      let member: LoyaltyMember | null = null;
      const rows = result.rows || [];
      if (rows.length > 0) {
        const row = rows[0] as Record<string, any>;
        member = {
          id: Number(row.id),
          loyaltyId: String(row.loyalty_id),
          customerId: Number(row.customer_id),
          programId: Number(row.program_id),
          tierId: row.tier_id !== null ? Number(row.tier_id) : null,
          points: Number(row.points),
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at),
        };

        if (this.cache) {
          await this.cache.set(cacheKey, member, this.CACHE_TTL.MEMBER);
        }
      }

      return member;
    } catch (error) {
      this.logger.error(`Error fetching loyalty member by loyalty ID: ${loyaltyId}`, { error });
      throw new AppError(
        `Error fetching loyalty member by loyalty ID`,
        ErrorCategory.SERVICE,
        ErrorCode.INTERNAL_SERVER_ERROR,
        { error, loyaltyId }
      );
    }
  }

  /**
   * Create a new loyalty member
   */
  async createMember(data: z.infer<typeof memberCreateSchema>): Promise<LoyaltyMember> {
    try {
      // Generate loyalty ID if not provided
      if (!data.loyaltyId) {
        data.loyaltyId = generateLoyaltyId();
      }

      const result = await super.create(data);
      return result as LoyaltyMember;
    } catch (error) {
      this.logger.error('Error creating loyalty member', { error, data });
      throw new AppError(
        'Failed to create loyalty member',
        ErrorCategory.SERVICE,
        ErrorCode.INTERNAL_SERVER_ERROR,
        { error }
      );
    }
  }

  /**
   * Update an existing loyalty member
   */
  async updateMember(id: number, data: z.infer<typeof memberUpdateSchema>): Promise<LoyaltyMember> {
    try {
      const result = await super.update(id, data);
      return result as LoyaltyMember;
    } catch (error) {
      this.logger.error('Error updating loyalty member', { error, id, data });
      throw new AppError(
        'Failed to update loyalty member',
        ErrorCategory.SERVICE,
        ErrorCode.INTERNAL_SERVER_ERROR,
        { error }
      );
    }
  }

  /**
   * Get all active loyalty members for a program
   */
  async getMembersByProgramId(programId: number): Promise<LoyaltyMember[]> {
    try {
      const cacheKey = `loyalty:members:program:${programId}`;
      if (this.cache) {
        const cached = await this.cache.get(cacheKey);
        if (cached) {
          this.logger.debug(`Cache hit for ${cacheKey}`);
          return cached as LoyaltyMember[];
        }
      }

      // Use raw SQL to avoid type issues with Drizzle
      const query = sql`
        SELECT * FROM loyalty_members
        WHERE program_id = ${this.safeToString(programId)}
      `;

      const result = await this.executeQuery(async db => {
        return db.execute(query);
      }, 'loyalty.getMembersByProgramId');

      // Map DB results to properly structured LoyaltyMember objects
      const rows = result.rows || [];
      const members: LoyaltyMember[] = rows.map(row => {
        const typedRow = row as Record<string, any>;
        return {
          id: Number(typedRow.id),
          loyaltyId: String(typedRow.loyalty_id),
          customerId: Number(typedRow.customer_id),
          programId: Number(typedRow.program_id),
          tierId: typedRow.tier_id !== null ? Number(typedRow.tier_id) : null,
          points: Number(typedRow.points),
          createdAt: new Date(typedRow.created_at),
          updatedAt: new Date(typedRow.updated_at),
        };
      });

      if (this.cache) {
        await this.cache.set(cacheKey, members, this.CACHE_TTL.LIST);
      }

      return members;
    } catch (error) {
      this.logger.error(`Error fetching loyalty members for program ID: ${programId}`, { error });
      throw new AppError(
        'Failed to get loyalty members for program',
        ErrorCategory.SERVICE,
        ErrorCode.INTERNAL_SERVER_ERROR,
        { error, programId }
      );
    }
  }
}
