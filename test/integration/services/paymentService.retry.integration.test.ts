// test/integration/services/paymentService.retry.integration.test.ts

import { jest, expect } from '@jest/globals';
import { makeMockPaymentProvider, MockPaymentProvider } from '../../mocks/externalApis';
import { test, describe } from '../../testTags'; // describe comes from testTags

class PaymentService {
  constructor(private paymentProvider: MockPaymentProvider) {}
  // Simulates a retry-once logic for charge failures
  async processChargeWithRetry(amount: number, cardToken: string) {
    let attempt = 0;
    while (attempt < 2) {
      try {
        const result = await this.paymentProvider.charge(amount, cardToken);
        // On success, you may want to save the transaction using your Drizzle ORM logic here.
        return result;
      } catch (err) {
        attempt++;
        // Log error (for demo, just call console.error)
        if (err instanceof Error) {
          console.error(`Charge attempt ${attempt} failed:`, err.message);
        } else {
          console.error(`Charge attempt ${attempt} failed:`, err);
        }
        if (attempt >= 2) throw err;
      }
    }
  }
}

describe.integration('PaymentService Retry Logic', () => {
  // beforeAll(async () => { await drizzleDb.connect(); });
  // afterAll(async () => { await drizzleDb.disconnect(); });
  // beforeEach(async () => { await drizzleDb.transaction.deleteMany(); });
  // Replace with Drizzle ORM setup/teardown if needed.

  test.integration(
    'should retry once on charge failure and succeed on second attempt',
    async () => {
      // Arrange: mock payment provider to fail once, then succeed
      const mockProvider: MockPaymentProvider = {
        charge: jest.fn() as jest.MockedFunction<
          (
            amount: number,
            cardToken: string
          ) => Promise<{ success: boolean; transactionId: string }>
        >,
        refund: jest.fn() as jest.MockedFunction<
          (
            transactionId: string,
            amount?: number
          ) => Promise<{ success: boolean; refundId: string }>
        >,
      };
      mockProvider.charge
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({ success: true, transactionId: 'tx-123' });
      const service = new PaymentService(mockProvider);
      const logSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

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
    }
  );
});
