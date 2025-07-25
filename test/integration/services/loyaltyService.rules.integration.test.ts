import { makeMockCustomer } from '../../factories/customer.js';
import { recordPointsEarned, setLoyaltyLogger } from '@server/services/loyalty.js';
import { db } from '@db/index.js';
import { ConsoleLogger } from '../../../src/logging/Logger.js';

describe('LoyaltyService Business Rules', () => {
  let loggerSpy: any;
  beforeAll(() => {
    // Use a spy logger
    setLoyaltyLogger(ConsoleLogger);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should block accrual if loyaltyEnabled is false and log a skip', async () => {
    const customer = await db.customer.create({
      data: makeMockCustomer({ loyaltyEnabled: false }),
    });
    const member = await db.loyaltyMember.create({
      data: { customerId: customer.id, loyaltyId: 'LOY-TEST1', isActive: true },
    });
    loggerSpy = jest.spyOn(ConsoleLogger, 'info');
    const result = await recordPointsEarned(123, member.id, 10, 1);
    expect(result.success).toBe(false);
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining('Loyalty accrual blocked: loyalty disabled'),
      expect.objectContaining({ customerId: customer.id })
    );
  });

  it('should log a fraud warning if >5 accruals in 1 hour', async () => {
    const customer = await db.customer.create({ data: makeMockCustomer() });
    const member = await db.loyaltyMember.create({
      data: { customerId: customer.id, loyaltyId: 'LOY-TEST2', isActive: true },
    });
    loggerSpy = jest.spyOn(ConsoleLogger, 'warn');
    // Simulate 6 accruals within 1 hour
    for (let i = 0; i < 6; i++) {
      await db.loyaltyTransaction.create({
        data: {
          memberId: member.id,
          type: 'earn',
          points: '1',
          createdAt: new Date(Date.now() - 30 * 60 * 1000),
        },
      });
    }
    await recordPointsEarned(456, member.id, 5, 1);
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining('Potential loyalty fraud detected: excessive accruals'),
      expect.objectContaining({ memberId: member.id })
    );
  });
});
