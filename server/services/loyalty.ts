import { Pool } from 'pg';
import { eq, and, desc, sum, count, gte, lte } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../../shared/schema.js';
import { getLogger } from '../../src/logging/index.js';

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
    } catch (error) {
      logger.error('Error getting loyalty program', { error, storeId });
      throw error;
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

      const [member] = await this.db!.insert(schema.loyaltyMembers).values({
        loyaltyId,
        customerId: data.customerId,
        tierId: defaultTier.id,
        pointsBalance: '0',
        totalPointsEarned: '0',
        totalPointsRedeemed: '0',
        joinDate: new Date(),
        status: 'active'
      }).returning();

      return {
        ...member,
        program
      } as LoyaltyMember;
    } catch (error) {
      logger.error('Error creating loyalty member', { error, data });
      throw error;
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

      const [transaction] = await this.db!.insert(schema.loyaltyTransactions).values({
        memberId,
        transactionId,
        type: 'earned',
        points,
        description: `Points earned from transaction #${transactionId}`,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        userId
      }).returning();

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
    } catch (error) {
      logger.error('Error recording points earned', { error, transactionId, memberId, points });
      throw error;
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
    await this.ensureInitialized();

    try {
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

      if (!member) {
        throw new Error('Member not found');
      }

      const totalPoints = member.totalPointsEarned;
      const currentTier = member.program.tiers.find(t => t.id === member.tierId);

      if (!currentTier) {
        throw new Error('Current tier not found');
      }

      const nextTier = member.program.tiers
        .filter(t => Number(t.pointsRequired) > Number(totalPoints))
        .sort((a, b) => Number(a.pointsRequired) - Number(b.pointsRequired))[0] || null;

      const pointsToNextTier = nextTier ? 
        Number(nextTier.pointsRequired) - Number(totalPoints) : 
        null;

      return {
        member,
        totalPoints,
        currentTier,
        nextTier,
        pointsToNextTier,
        recentTransactions: [],
        memberSince: member.joinDate,
        lastActivity: member.lastActivity,
        redemptionHistory: []
      };
    } catch (error) {
      logger.error('Error getting member stats', { error, memberId });
      throw error;
    }
  }
}
