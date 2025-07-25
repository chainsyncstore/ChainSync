import { LoyaltyService } from './service';
import type { Logger } from '../../../src/logging/Logger';
import { ConsoleLogger } from '../../../src/logging/Logger';

// Singleton loyalty service instance for simple helper wrappers
const loyaltyService = new LoyaltyService();

export async function recordPointsEarned(
  transactionId: number,
  memberId: number,
  points: number,
  userId: number,
  source: string = 'transaction'
) {
  return loyaltyService.addPoints(memberId, points, source, transactionId, userId);
}

export { LoyaltyService };
