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
          m.lifetime_points, m.status, m.enrollment_date, m.last_activity_date, m.metadata, -- Added fields
          c.id as c_customer_id, c.name as customer_name, c.email as customer_email, c.phone as customer_phone, -- aliased customer_id to avoid conflict
          p.id as p_program_id, p.name as program_name, -- aliased program_id
          t.id as t_tier_id, t.name as tier_name -- aliased tier_id
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
        customerId: Number(row.customer_id), // This is m.customer_id
        programId: Number(row.program_id), // This is m.program_id
        tierId: row.tier_id ? Number(row.tier_id) : null,
        points: Number(row.points),
        lifetimePoints: row.lifetime_points ? Number(row.lifetime_points) : Number(row.points), // Default to points if not present
        status: row.status ? (String(row.status) as LoyaltyMember['status']) : 'active',
        enrollmentDate: row.enrollment_date
          ? new Date(row.enrollment_date)
          : new Date(row.created_at),
        lastActivityDate: row.last_activity_date
          ? new Date(row.last_activity_date)
          : new Date(row.updated_at),
        metadata: row.metadata ? JSON.parse(String(row.metadata)) : undefined,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        customer: {
          id: Number(row.c_customer_id), // Use aliased c_customer_id
          name: row.customer_name ? String(row.customer_name) : '',
          email: String(row.customer_email),
          phone: row.customer_phone ? String(row.customer_phone) : undefined,
        },
        program: {
          id: Number(row.p_program_id), // Use aliased p_program_id
          name: String(row.program_name),
        },
        tier: row.t_tier_id
          ? {
              // Use aliased t_tier_id
              id: Number(row.t_tier_id),
              name: String(row.tier_name),
            }
          : { id: 0, name: 'Default Tier' }, // Consider if default tier should be null or fetched
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
      // Added all fields from loyalty_members including new ones
      const selectFields = `m.id, m.loyalty_id, m.customer_id, m.program_id, m.tier_id, m.points, m.created_at, m.updated_at, m.lifetime_points, m.status, m.enrollment_date, m.last_activity_date, m.metadata`;

      if (storeId !== undefined) {
        query = sql`
          SELECT ${sql.raw(selectFields)} FROM loyalty_members m
          INNER JOIN loyalty_programs p ON m.program_id = p.id
          WHERE m.customer_id = ${this.safeToString(customerId)}
          AND p.store_id = ${this.safeToString(storeId)}
          LIMIT 1
        `;
      } else {
        query = sql`
          SELECT ${sql.raw(selectFields)} FROM loyalty_members m
          WHERE m.customer_id = ${this.safeToString(customerId)}
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
          lifetimePoints: row.lifetime_points ? Number(row.lifetime_points) : Number(row.points),
          status: row.status ? (String(row.status) as LoyaltyMember['status']) : 'active',
          enrollmentDate: row.enrollment_date
            ? new Date(row.enrollment_date)
            : new Date(row.created_at),
          lastActivityDate: row.last_activity_date
            ? new Date(row.last_activity_date)
            : new Date(row.updated_at),
          metadata: row.metadata ? JSON.parse(String(row.metadata)) : undefined,
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
      // Added all fields from loyalty_members including new ones
      const selectFields = `id, loyalty_id, customer_id, program_id, tier_id, points, created_at, updated_at, lifetime_points, status, enrollment_date, last_activity_date, metadata`;
      const query = sql`
        SELECT ${sql.raw(selectFields)} FROM loyalty_members
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
          lifetimePoints: row.lifetime_points ? Number(row.lifetime_points) : Number(row.points),
          status: row.status ? (String(row.status) as LoyaltyMember['status']) : 'active',
          enrollmentDate: row.enrollment_date
            ? new Date(row.enrollment_date)
            : new Date(row.created_at),
          lastActivityDate: row.last_activity_date
            ? new Date(row.last_activity_date)
            : new Date(row.updated_at),
          metadata: row.metadata ? JSON.parse(String(row.metadata)) : undefined,
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
}
