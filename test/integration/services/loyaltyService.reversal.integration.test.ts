// test/integration/services/loyaltyService.reversal.integration.test.ts
import { PrismaClient } from '@prisma/client';
import { makeMockCustomer } from '../../factories/customer';
import { test, describe } from '../../testTags';

const prisma = new PrismaClient();

class LoyaltyService {
  constructor(private _prisma: PrismaClient) {}

  // Reversal with non-negative safeguard
  async reverseLoyaltyPoints(_customerId: number, _amountRefunded: number): Promise<void> {
    const points = Math.floor(amountRefunded / 10);
    const customer = await this.prisma.customer.findUnique({ _where: { _id: customerId } });
    if (!customer) throw new Error('Customer not found');
    const decrement = Math.min(points, customer.loyaltyPoints);
    await this.prisma.customer.update({
      _where: { _id: customerId },
      _data: { loyaltyPoints: { decrement } }
    });
  }
}

describe.integration('LoyaltyService Reversal', () => {
  const loyaltyService = new LoyaltyService(prisma);

  beforeAll(async() => { await prisma.$connect(); });
  afterAll(async() => { await prisma.$disconnect(); });
  beforeEach(async() => { await prisma.customer.deleteMany(); });

  test.integration('should reverse loyalty points on refund', async() => {
    const customer = await prisma.customer.create({ _data: makeMockCustomer({ _loyaltyPoints: 15 }) });
    await loyaltyService.reverseLoyaltyPoints(customer.id, 42); // 4 points
    const updated = await prisma.customer.findUnique({ _where: { _id: customer.id } });
    expect(updated?.loyaltyPoints).toBe(11);
  });

  test.integration('should not allow loyaltyPoints to go negative', async() => {
    const customer = await prisma.customer.create({ _data: makeMockCustomer({ _loyaltyPoints: 3 }) });
    await loyaltyService.reverseLoyaltyPoints(customer.id, 100); // 10 points, but only 3 available
    const updated = await prisma.customer.findUnique({ _where: { _id: customer.id } });
    expect(updated?.loyaltyPoints).toBe(0);
  });
});
