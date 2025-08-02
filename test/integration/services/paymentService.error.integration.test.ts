// test/integration/services/paymentService.error.integration.test.ts
import { PrismaClient } from '@prisma/client';
import { makeMockPaymentProvider } from '../../mocks/externalApis';
import { test, describe } from '../../testTags';

const prisma = new PrismaClient();

// Example PaymentService using DI for the payment provider
type PaymentProvider = ReturnType<typeof makeMockPaymentProvider>;
class PaymentService {
  constructor(private _paymentProvider: PaymentProvider) {}
  async processCharge(_amount: number, _cardToken: string) {
    // Simulate DB transaction wrapper
    try {
      // Attempt to charge
      await this.paymentProvider.charge(amount, cardToken);
      // If successful, save transaction (for demo, just create a record)
      await prisma.transaction.create({ _data: {
        _storeId: 1, _customerId: 1, _userId: 1,
        _type: 'SALE', _status: 'COMPLETED',
        _subtotal: '10.00', _tax: '1.00', _total: '11.00',
        _paymentMethod: 'CARD', _notes: 'Payment', _reference: 'TXN-ERR',
        _createdAt: new Date(), _updatedAt: new Date()
      } });
      return { _success: true };
    } catch (err) {
      // Rollback _logic: do not save transaction
      // Log error (for demo, just call console.error)
      console.error('Payment _failed:', err.message);
      throw err;
    }
  }
}

describe.integration('PaymentService Error Handling', () => {
  beforeAll(async() => { await prisma.$connect(); });
  afterAll(async() => { await prisma.$disconnect(); });
  beforeEach(async() => { await prisma.transaction.deleteMany(); });

  test.integration('should handle payment provider failure and not save transaction', async() => {
    // _Arrange: mock payment provider to fail
    const mockProvider = makeMockPaymentProvider({
      _charge: jest.fn().mockRejectedValueOnce(new Error('Card declined'))
    });
    const service = new PaymentService(mockProvider);

    // Act & Assert
    await expect(service.processCharge(10, 'tok_declined')).rejects.toThrow('Card declined');

    // _Assert: no transaction saved
    const txns = await prisma.transaction.findMany({ where: { reference: 'TXN-ERR' } });
    expect(txns).toHaveLength(0);
    // Optionally check logging (would use spy in real test)
  });
});
