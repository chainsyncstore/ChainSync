// test/integration/services/loyaltyService.reversal.integration.test.ts

import { makeMockCustomer } from '../../factories/customer';
import { test, describe } from '../../testTags';



class LoyaltyService {
  constructor(private prisma: PrismaClient) {}

  // Reversal with non-negative safeguard
  async reverseLoyaltyPoints(customerId: number, amountRefunded: number): Promise<void> {
    const points = Math.floor(amountRefunded / 10);
    const customer = await this./* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new Error('Customer not found');
    const decrement = Math.min(points, customer.loyaltyPoints);
    await this./* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */customer.update({
      where: { id: customerId },
      data: { loyaltyPoints: { decrement } },
    });
  }
}

describe.integration('LoyaltyService Reversal', () => {
  const loyaltyService = new LoyaltyService(prisma);

  beforeAll(async () => { await /* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */$connect(); });
  afterAll(async () => { await /* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */$disconnect(); });
  beforeEach(async () => { await /* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */customer.deleteMany(); });

  test.integration('should reverse loyalty points on refund', async () => {
    const customer = await /* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */customer.create({ data: makeMockCustomer({ loyaltyPoints: 15 }) });
    await loyaltyService.reverseLoyaltyPoints(customer.id, 42); // 4 points
    const updated = await /* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */customer.findUnique({ where: { id: customer.id } });
    expect(updated?.loyaltyPoints).toBe(11);
  });

  test.integration('should not allow loyaltyPoints to go negative', async () => {
    const customer = await /* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */customer.create({ data: makeMockCustomer({ loyaltyPoints: 3 }) });
    await loyaltyService.reverseLoyaltyPoints(customer.id, 100); // 10 points, but only 3 available
    const updated = await /* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */customer.findUnique({ where: { id: customer.id } });
    expect(updated?.loyaltyPoints).toBe(0);
  });
});
