// test/integration/services/paymentService.refund.error.integration.test.ts

import { makeMockPaymentProvider } from '../../mocks/externalApis';
import { test, describe } from '../../testTags';



type PaymentProvider = ReturnType<typeof makeMockPaymentProvider>;
class PaymentService {
  constructor(private paymentProvider: PaymentProvider) {}
  async processRefund(transactionId: string, amount?: number) {
    try {
      await this.paymentProvider.refund(transactionId, amount);
      // If successful, save refund record (for demo, just create a record)
      await /* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */refund.create({ data: {
        transactionId,
        amount: amount ?? 0,
        status: 'COMPLETED',
        createdAt: new Date(),
        updatedAt: new Date(),
      }});
      return { success: true };
    } catch (err) {
      // Rollback logic: do not save refund
      // Log error (for demo, just call console.error)
      console.error('Refund failed:', err.message);
      throw err;
    }
  }
}

describe.integration('PaymentService Refund Error Handling', () => {
  beforeAll(async () => { await /* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */$connect(); });
  afterAll(async () => { await /* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */$disconnect(); });
  beforeEach(async () => { await /* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */refund.deleteMany(); });

  test.integration('should handle refund provider failure and not save refund record', async () => {
    // Arrange: mock payment provider to fail on refund
    const mockProvider = makeMockPaymentProvider({
      refund: jest.fn().mockRejectedValueOnce(new Error('Refund gateway timeout')),
    });
    const service = new PaymentService(mockProvider);

    // Act & Assert
    await expect(service.processRefund('txn_abc_123', 50)).rejects.toThrow('Refund gateway timeout');

    // Assert: no refund saved
    const refunds = await /* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */refund.findMany({ where: { transactionId: 'txn_abc_123' } });
    expect(refunds.length).toBe(0);
    // Optionally check logging (would use spy in real test)
  });
});
