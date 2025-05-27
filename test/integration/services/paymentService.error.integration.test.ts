// test/integration/services/paymentService.error.integration.test.ts

import { makeMockPaymentProvider } from '../../mocks/externalApis';
import { test, describe } from '../../testTags';



// Example PaymentService using DI for the payment provider
type PaymentProvider = ReturnType<typeof makeMockPaymentProvider>;
class PaymentService {
  constructor(private paymentProvider: PaymentProvider) {}
  async processCharge(amount: number, cardToken: string) {
    // Simulate DB transaction wrapper
    try {
      // Attempt to charge
      await this.paymentProvider.charge(amount, cardToken);
      // If successful, save transaction (for demo, just create a record)
      await /* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */transaction.create({ data: {
        storeId: 1, customerId: 1, userId: 1,
        type: 'SALE', status: 'COMPLETED',
        subtotal: '10.00', tax: '1.00', total: '11.00',
        paymentMethod: 'CARD', notes: 'Payment', reference: 'TXN-ERR',
        createdAt: new Date(), updatedAt: new Date(),
      }});
      return { success: true };
    } catch (err) {
      // Rollback logic: do not save transaction
      // Log error (for demo, just call console.error)
      console.error('Payment failed:', err.message);
      throw err;
    }
  }
}

describe.integration('PaymentService Error Handling', () => {
  beforeAll(async () => { await /* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */$connect(); });
  afterAll(async () => { await /* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */$disconnect(); });
  beforeEach(async () => { await /* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */transaction.deleteMany(); });

  test.integration('should handle payment provider failure and not save transaction', async () => {
    // Arrange: mock payment provider to fail
    const mockProvider = makeMockPaymentProvider({
      charge: jest.fn().mockRejectedValueOnce(new Error('Card declined')),
    });
    const service = new PaymentService(mockProvider);

    // Act & Assert
    await expect(service.processCharge(10, 'tok_declined')).rejects.toThrow('Card declined');

    // Assert: no transaction saved
    const txns = await /* REPLACE_PRISMA: Replace this logic with Drizzle ORM or test double */transaction.findMany({ where: { reference: 'TXN-ERR' } });
    expect(txns.length).toBe(0);
    // Optionally check logging (would use spy in real test)
  });
});
