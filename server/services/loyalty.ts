import { Pool } from 'pg';
import { eq, and, desc, sum, count, gte, lte } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../../shared/schema.js';
import { getLogger } from '../../src/logging/index.js';
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
  private db: ReturnType<typeof drizzle> | null = null;
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
            orderBy: [schema.loyaltyTiers.pointsRequired]
          }
        }
      });

      return program;
    } catch (error: unknown) {
      logger.error('Error getting loyalty program', { error, storeId });
      throw error instanceof AppError ? error : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
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
      const memberData = {
        loyaltyId,
        customerId: data.customerId,
        tierId: defaultTier.id,
        pointsBalance: '0',
        totalPointsEarned: '0',
        totalPointsRedeemed: '0',
        joinDate: new Date(),
        status: 'active' as const
      };
      
      // Convert to database fields (snake_case) before inserting
      const dbFields = loyaltyMemberToDatabaseFields(memberData);
      const [memberResult] = await this.db!.insert(schema.loyaltyMembers).values(dbFields).returning();
      
      // Convert back to application fields (camelCase)
      const member = loyaltyMemberFromDatabaseFields(memberResult);

      return {
        ...member,
        program
      } as LoyaltyMember;
    } catch (error: unknown) {
      logger.error('Error creating loyalty member', { error, data });
      throw error instanceof AppError ? error : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  public async recordPointsEarned(
    transactionId: number,
    memberId: number,
    points: number,
    userId: number
  ): Promise<{ success: boolean; transaction?: LoyaltyTransaction }> {
    await this.ensureInitialized();

    try {
      if (points <= 0) {
        return { success: false };
      }

      // Create transaction object with camelCase fields
      const transactionData = {
        memberId,
        transactionId,
        type: 'earned' as const,
        points,
        description: `Points earned from transaction #${transactionId}`,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        userId
      };
      
      // Convert to database fields (snake_case) before inserting
      const dbFields = loyaltyTransactionToDatabaseFields(transactionData);
      const [transactionResult] = await this.db!.insert(schema.loyaltyTransactions).values(dbFields).returning();
      
      // Convert back to application fields (camelCase)
      const transaction = loyaltyTransactionFromDatabaseFields(transactionResult);

      // Update member balance
      await this.db!.update(schema.loyaltyMembers)
        .set({
          pointsBalance: String(Number(await this.getMemberPointsBalance(memberId)) + points),
          totalPointsEarned: String(Number(await this.getMemberTotalEarned(memberId)) + points),
          lastActivity: new Date()
        })
        .where(eq(schema.loyaltyMembers.id, memberId));

      // Check for tier upgrade
      await this.checkAndUpdateMemberTier(memberId);

      return { success: true, transaction };
    } catch (error: unknown) {
      logger.error('Error recording points earned', { error, transactionId, memberId, points });
      throw error instanceof AppError ? error : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  private async getMemberPointsBalance(memberId: number): Promise<string> {
    const member = await this.db!.query.loyaltyMembers.findFirst({
      where: eq(schema.loyaltyMembers.id, memberId)
    });
    return member?.pointsBalance || '0';
  }

  private async getMemberTotalEarned(memberId: number): Promise<string> {
    const member = await this.db!.query.loyaltyMembers.findFirst({
      where: eq(schema.loyaltyMembers.id, memberId)
    });
    return member?.totalPointsEarned || '0';
  }

  private async checkAndUpdateMemberTier(memberId: number): Promise<void> {
    await this.ensureInitialized();

    const member = await this.db!.query.loyaltyMembers.findFirst({
      where: eq(schema.loyaltyMembers.id, memberId),
      with: {
        program: {
          with: {
            tiers: {
              orderBy: [schema.loyaltyTiers.pointsRequired]
            }
          }
        }
      }
    });

    if (!member) return;

    const totalPoints = Number(member.totalPointsEarned);
    const currentTier = member.program.tiers.find(t => t.id === member.tierId);
    
    // Find the highest tier the member qualifies for
    let newTier = member.program.tiers[0];
    for (const tier of member.program.tiers) {
      if (totalPoints >= Number(tier.pointsRequired)) {
        newTier = tier;
      }
    }

    if (newTier.id !== member.tierId) {
      await this.db!.update(schema.loyaltyMembers)
        .set({ tierId: newTier.id })
        .where(eq(schema.loyaltyMembers.id, memberId));

      logger.info('Member tier upgraded', {
        memberId,
        oldTier: currentTier?.name,
        newTier: newTier.name
      });
    }
  }

  public async calculatePointsForTransaction(
    subtotal: string | number,
    storeId: number,
    items: Array<{ productId: number; quantity: number; unitPrice: number | string }>
  ): Promise<number> {
    const program = await this.getLoyaltyProgram(storeId);
    if (!program?.pointsPerAmount) return 0;

    const amount = typeof subtotal === 'string' ? parseFloat(subtotal) : subtotal;
    const pointsPerDollar = parseFloat(program.pointsPerAmount);
    
    return Math.floor(amount * pointsPerDollar);
  }

  public async generateLoyaltyId(): Promise<string> {
    const prefix = 'LYL';
    let loyaltyId: string;
    
    do {
      loyaltyId = prefix + this.generateRandomString(6);
    } while (!(await this.isLoyaltyIdUnique(loyaltyId)));
    
    return loyaltyId;
  }

  private async isLoyaltyIdUnique(loyaltyId: string): Promise<boolean> {
    await this.ensureInitialized();
    const existing = await this.db!.query.loyaltyMembers.findFirst({
      where: eq(schema.loyaltyMembers.loyaltyId, loyaltyId)
    });
    return !existing;
  }

  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  public async getMemberStats(memberId: number): Promise<LoyaltyMemberStats> {
    // Store memberId in a local variable for error handling context
    const memberIdForLogging = memberId;
    await this.ensureInitialized();

    const dbMember = await this.db!.query.loyaltyMembers.findFirst({
      where: eq(schema.loyaltyMembers.id, memberId),
      with: {
        program: {
          with: {
            tiers: true
          }
        }
      }
    });
    
    // Convert database fields (snake_case) to application fields (camelCase)
    const member = dbMember ? loyaltyMemberFromDatabaseFields(dbMember) as LoyaltyMember : null;
    
    if (!member) {
      throw new Error('Member not found');
    }

      // Extract the totalPoints value safely
      const totalPoints = member.totalPointsEarned;
      // Find the current tier from the program's tiers array
      const currentTier = member.program.tiers.find((tier: LoyaltyTier) => tier.id === member.tierId);

      if (!currentTier) {
        throw new Error('Current tier not found');
      }

      // Find the next tier that requires more points than the member currently has
      const nextTier = member.program.tiers
        .filter((tier: LoyaltyTier) => Number(tier.pointsRequired) > Number(totalPoints))
        .sort((a: LoyaltyTier, b: LoyaltyTier) => Number(a.pointsRequired) - Number(b.pointsRequired))[0] || null;

      const pointsToNextTier = nextTier ? 
        Number(nextTier.pointsRequired) - Number(totalPoints) : 
        null;

      // Get recent transactions
      const recentTransactions = await this.db!.query.loyaltyTransactions.findMany({
        where: eq(schema.loyaltyTransactions.memberId, memberId),
        orderBy: [desc(schema.loyaltyTransactions.createdAt)],
        limit: 5
      });
      
      // Convert transaction database fields to application fields
      const mappedTransactions = recentTransactions.map((t: Record<string, unknown>) => {
        // First convert to unknown type to avoid direct casting errors
        const converted = loyaltyTransactionFromDatabaseFields(t) as unknown;
        // Then safely cast to the required type
        return converted as LoyaltyTransaction;
      });
      
      // Get redemption history
      const redemptionHistory = await this.db!.query.loyaltyTransactions.findMany({
        where: and(
          eq(schema.loyaltyTransactions.memberId, memberId),
          eq(schema.loyaltyTransactions.type, 'redeemed')
        ),
        orderBy: [desc(schema.loyaltyTransactions.createdAt)],
        limit: 10
      });
      
      // Convert redemption database fields to application fields
      const mappedRedemptions = redemptionHistory.map((r: Record<string, unknown>) => {
        // First convert to unknown type to avoid direct casting errors
        const converted = loyaltyTransactionFromDatabaseFields(r) as unknown;
        // Then safely cast to the required type
        return converted as LoyaltyTransaction;
      });
      
      return {
        member,
        totalPoints,
        currentTier,
        nextTier,
        pointsToNextTier,
        recentTransactions: mappedTransactions,
        memberSince: member.joinDate,
        lastActivity: member.lastActivity,
        redemptionHistory: mappedRedemptions
      };
    } catch (error: unknown) {
      // Log the error with proper context using the stored member ID
      const errorContext = { error, memberId: memberIdForLogging };
      logger.error('Error getting member stats', errorContext);
      throw error instanceof Error ? error : new Error(`Unknown error in getMemberStats for member ${memberIdForLogging}`);
    }
  }
}
