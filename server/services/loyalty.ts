import { Pool } from 'pg';
import { eq, and, desc, sum, count, gte, lte } from 'drizzle-orm';
import { NodePgDatabase, drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../../shared/schema.js';
import { getLogger } from '../../src/logging/index.js';
import { AppError } from '@shared/types/errors';
import { 
  loyaltyMemberToDatabaseFields, 
  loyaltyMemberFromDatabaseFields,
  loyaltyProgramFromDatabaseFields,
  loyaltyTransactionToDatabaseFields,
  loyaltyTransactionFromDatabaseFields
} from '../../shared/utils/loyalty-mapping.js';

const logger = getLogger().child({ component: 'loyalty-service' });

export interface LoyaltyMember {
  id: number;
  loyaltyId: string;
  customerId: number;
  tierId: number;
  pointsBalance: string;
  totalPointsEarned: string;
  totalPointsRedeemed: string;
  joinDate: Date;
  lastActivity: Date | null;
  status: 'active' | 'inactive' | 'suspended';
  program: {
    id: number;
    name: string;
    storeId: number;
    pointsPerAmount: string;
    tiers: LoyaltyTier[];
  };
}

export interface LoyaltyTier {
  id: number;
  name: string;
  pointsRequired: string;
  benefits: string;
  multiplier: string;
}

export interface LoyaltyTransaction {
  id: number;
  memberId: number;
  transactionId: number | null;
  type: 'earned' | 'redeemed' | 'expired' | 'adjusted';
  points: number;
  description: string;
  createdAt: Date;
  expiresAt: Date | null;
  userId: number;
}

export interface LoyaltyMemberStats {
  member: LoyaltyMember;
  totalPoints: string;
  currentTier: LoyaltyTier;
  nextTier: LoyaltyTier | null;
  pointsToNextTier: number | null;
  recentTransactions: LoyaltyTransaction[];
  memberSince: Date;
  lastActivity: Date | null;
  redemptionHistory: Array<{
    date: Date;
    points: number;
    description: string;
  }>;
}

export class LoyaltyService {
  private db: NodePgDatabase<typeof schema> | null = null;
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.db) {
      this.db = drizzle(this.pool, { schema });
    }
  }

  public async getLoyaltyProgram(storeId: number): Promise<any> {
    await this.ensureInitialized();
    
    try {
      const program = await this.db!.query.loyaltyPrograms.findFirst({
        where: eq(schema.loyaltyPrograms.storeId, storeId),
        with: {
          tiers: {
            orderBy: [schema.loyaltyTiers.pointThreshold]
          }
        }
      });

      return program;
    } catch (error: unknown) {
      logger.error('Error getting loyalty program', { error, storeId });
      throw error instanceof AppError ? error : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  // Placeholder for generateLoyaltyId - implementation needed
  private async generateLoyaltyId(): Promise<string> {
    // This should generate a unique loyalty ID, e.g., using a UUID library or a custom sequence
    return Promise.resolve(`LOY-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
  }

  public async createLoyaltyMember(data: {
    customerId: number;
    storeId: number;
    userId: number;
  }): Promise<LoyaltyMember> {
    await this.ensureInitialized();

    try {
      const program = await this.getLoyaltyProgram(data.storeId);
      if (!program) {
        throw new Error('No loyalty program found for store');
      }

      const loyaltyId = await this.generateLoyaltyId(); 
      const defaultTier = program.tiers[0];

      // Create member object with camelCase fields
      const memberDataForDb = { // Renamed to avoid conflict with LoyaltyMember interface if imported
        loyaltyId,
        customerId: data.customerId,
        tierId: defaultTier.id,
        points: 0, // Changed from pointsBalance and type to number
        joinDate: new Date(),
        status: 'active' as const
        // totalPointsEarned and totalPointsRedeemed are not direct DB fields for loyaltyMembers
      };
      
      // Create member object with camelCase fields, matching Drizzle's expected input for schema.loyaltyMembers
      const memberDataForDbInsert = {
        programId: program.id, // Added programId
        loyaltyId,
        customerId: data.customerId,
        tierId: defaultTier.id,
        points: 0, 
        joinDate: new Date(),
        status: 'active' // Changed from 'active' as const
      };
      
      // Drizzle expects camelCase keys that match the schema definition
      const [insertedRecord] = await this.db!.insert(schema.loyaltyMembers).values(memberDataForDbInsert).returning();

      // insertedRecord is snake_case from the DB. Convert to camelCase using the mapping utility.
      // The LoyaltyMember type from loyalty-mapping.ts is used here.
      const newMemberFromMapping = loyaltyMemberFromDatabaseFields(insertedRecord);
      
      // Construct the final LoyaltyMember object as defined by this service's interface
      const serviceLoyaltyMember: LoyaltyMember = {
        id: newMemberFromMapping.id!, // id is definitely present after insert
        loyaltyId: newMemberFromMapping.loyaltyId!,
        customerId: newMemberFromMapping.customerId!,
        tierId: newMemberFromMapping.tierId!,
        pointsBalance: (newMemberFromMapping.points ?? 0).toString(),
        totalPointsEarned: '0', // Placeholder - not in DB table
        totalPointsRedeemed: '0', // Placeholder - not in DB table
        joinDate: newMemberFromMapping.joinDate!, 
        lastActivity: null, // Placeholder - not set during creation
        status: newMemberFromMapping.status!,
        program: { 
          id: program.id,
          name: program.name,
          storeId: program.storeId,
          pointsPerAmount: program.pointsPerAmount, 
          tiers: program.tiers.map((t: LoyaltyTier) => ({ // Use LoyaltyTier interface for 't'
            id: t.id,
            name: t.name,
            pointsRequired: t.pointsRequired,
            benefits: t.benefits,
            multiplier: t.multiplier,
          })),
        }
      };
      return serviceLoyaltyMember;
    } catch (error) {
      logger.error('Error creating loyalty member', { error, data });
      throw error;
    }
  }
}
