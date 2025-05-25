// test/integration/services/paymentService.retry.integration.test.ts
import { PrismaClient } from '@prisma/client';
import { makeMockPaymentProvider } from '../../mocks/externalApis';
import { test, describe } from '../../testTags';

const prisma = new PrismaClient();

type PaymentProvider = ReturnType<typeof makeMockPaymentProvider>;
class PaymentService {
  constructor(private paymentProvider: PaymentProvider) {}
  // Simulates a retry-once logic for charge failures
  async processChargeWithRetry(amount: number, cardToken: string) {
    let attempt = 0;
    while (attempt < 2) {
      try {
        const result = await this.paymentProvider.charge(amount, cardToken);
        // On success, save transaction
        await prisma.transaction.create({ data: {
          storeId: 1, customerId: 1, userId: 1,
          type: 'SALE', status: 'COMPLETED',
          subtotal: '10.00', tax: '1.00', total: '11.00',
          paymentMethod: 'CARD', notes: 'Payment', reference: 'TXN-RETRY',
          createdAt: new Date(), updatedAt: new Date(),
        }});
        return result;
      } catch (err) {
        attempt++;
        // Log error (for demo, just call console.error)
        console.error(`Charge attempt ${attempt} failed:`, err.message);
        if (attempt >= 2) throw err;
      }
    }
  }
}

describe.integration('PaymentService Retry Logic', () => {
  beforeAll(async () => { await prisma.$connect(); });
  afterAll(async () => { await prisma.$disconnect(); });
  beforeEach(async () => { await prisma.transaction.deleteMany(); });

  test.integration('should retry once on charge failure and succeed on second attempt', async () => {
    // Arrange: mock payment provider to fail once, then succeed
    const mockProvider = makeMockPaymentProvider({
      charge: jest.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({ success: true, transactionId: 'tx-123' }),
    });
    const service = new PaymentService(mockProvider);
    const logSpy = jest.spyOn(console, 'error').mockImplementation();

    // Act
    const result = await service.processChargeWithRetry(10, 'tok_retry');

    // Assert: success on second attempt
    expect(result).toEqual({ success: true, transactionId: 'tx-123' });
    // Only one transaction saved
    const txns = await prisma.transaction.findMany({ where: { reference: 'TXN-RETRY' } });
    expect(txns.length).toBe(1);
    // First failure was logged
    expect(logSpy).toHaveBeenCalledWith('Charge attempt 1 failed:', 'Temporary failure');
    logSpy.mockRestore();
    // Charge called twice
    expect(mockProvider.charge).toHaveBeenCalledTimes(2);
  });
});
