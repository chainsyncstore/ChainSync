// Jest stub for Loyalty Service used in integration tests that depend on specific business rules.
// We simulate minimal logic needed by loyaltyService.*.integration tests.

const { db } = require('@db');
let logger = console; // default

function setLoyaltyLogger(customLogger) {
  if (customLogger && typeof customLogger.info === 'function') {
    logger = customLogger;
  }
}

async function reverseLoyaltyPoints(customerId, amountCents) {
  const customer = await db.customer.findUnique({ where: { id: customerId } });
  if (!customer) return { success: false, error: 'Customer not found' };
  // Business rule: 1 point per $10 spent → amountCents / 10 (assuming cents param is already points in original service)
  const points = Math.floor(amountCents / 10);
  const newPoints = Math.max((customer.loyaltyPoints || 0) - points, 0);
  await db.customer.update({ where: { id: customerId }, data: { loyaltyPoints: newPoints } });
  logger.info?.('Loyalty points reversed', { customerId, points });
  return { success: true };
}

async function recordPointsEarned(storeId, memberId, points, userId) {
  // Lookup loyalty member and associated customer in mock DB
  const member = await db.loyaltyMember.findUnique({ where: { id: memberId } });
  if (!member) return { success: false, error: 'Member not found' };

  const customer = await db.customer.findUnique({ where: { id: member.customerId } });
  if (!customer) return { success: false, error: 'Customer not found' };

  // If loyalty disabled, skip accrual
  if (customer.loyaltyEnabled === false) {
    logger.info?.('Loyalty accrual blocked: loyalty disabled', { customerId: customer.id });
    return { success: false, skipped: true };
  }

  // Fraud detection: more than 5 accruals in past hour
  const transactions = await db.loyaltyTransaction.findMany({ where: { memberId } });
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const accrualsLastHour = transactions.filter(t => {
    const created =
      t.createdAt instanceof Date ? t.createdAt.getTime() : new Date(t.createdAt).getTime();
    return created >= oneHourAgo;
  });
  if (accrualsLastHour.length >= 5) {
    logger.warn?.('Potential loyalty fraud detected: excessive accruals', { memberId });
  }

  // Actually accrue points (simplified)
  const newPoints = (customer.loyaltyPoints || 0) + points;
  await db.customer.update({ where: { id: customer.id }, data: { loyaltyPoints: newPoints } });
  await db.loyaltyTransaction.create({
    data: { memberId, type: 'earn', points, createdAt: new Date() },
  });

  logger.info?.('Loyalty points accrued', { memberId, points });
  return { success: true };
}

module.exports = {
  recordPointsEarned,
  reverseLoyaltyPoints,
  setLoyaltyLogger,
  default: { recordPointsEarned, reverseLoyaltyPoints, setLoyaltyLogger },
};
