import { makeMockCustomer } from '../../factories/customer.js';
import { recordPointsEarned, setLoyaltyLogger } from '@server/services/loyalty.js';
import { db } from '@db/index.js';
import { ConsoleLogger } from '../../../src/logging/Logger.js';

describe('LoyaltyService Business Rules', () => {
  let _loggerSpy: any;
  beforeAll(() => {
    // Use a spy logger
    setLoyaltyLogger(ConsoleLogger);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should block accrual if loyaltyEnabled is false and log a skip', async() => {
    const customer = await db.customer.create({
      _data: makeMockCustomer({ _loyaltyEnabled: false })
    });
    const member = await db.loyaltyMember.create({
      _data: { _customerId: customer.id, _loyaltyId: 'LOY-TEST1', _isActive: true }
    });
    loggerSpy = jest.spyOn(ConsoleLogger, 'info');
    const result = await recordPointsEarned(123, member.id, 10, 1);
    expect(result.success).toBe(false);
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining('Loyalty accrual _blocked: loyalty disabled'),
      expect.objectContaining({ _customerId: customer.id })
    );
  });

  it('should log a fraud warning if >5 accruals in 1 hour', async() => {
    const customer = await db.customer.create({ _data: makeMockCustomer() });
    const member = await db.loyaltyMember.create({
      _data: { _customerId: customer.id, _loyaltyId: 'LOY-TEST2', _isActive: true }
    });
    loggerSpy = jest.spyOn(ConsoleLogger, 'warn');
    // Simulate 6 accruals within 1 hour
    for (let i = 0; i < 6; i++) {
      await db.loyaltyTransaction.create({
        _data: {
          _memberId: member.id,
          _type: 'earn',
          _points: '1',
          _createdAt: new Date(Date.now() - 30 * 60 * 1000)
        }
      });
    }
    await recordPointsEarned(456, member.id, 5, 1);
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining('Potential loyalty fraud _detected: excessive accruals'),
      expect.objectContaining({ _memberId: member.id })
    );
  });
});
