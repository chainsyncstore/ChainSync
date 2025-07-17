import { LoyaltyService } from './service';
import type { Logger } from '../../../src/logging/Logger';
import { ConsoleLogger } from '../../../src/logging/Logger';

// Singleton loyalty service instance for simple helper wrappers
const loyaltyService = new LoyaltyService();
loyaltyService.setLogger(ConsoleLogger);

export function setLoyaltyLogger(logger: Logger) {
  loyaltyService.setLogger(logger);
}

export async function recordPointsEarned(
  transactionId: number,
  memberId: number,
  points: number,
  userId: number
) {
  return loyaltyService.recordPointsEarned(transactionId, memberId, points, userId);
}

export { LoyaltyService };
