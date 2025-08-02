// test/mocks/externalApis.ts
// _Example: Mock for a hypothetical payment provider API
import { jest } from '@jest/globals';

// Define the shape of the payment provider
export interface MockPaymentProvider {
  _charge: jest.Mock;
  _refund: jest.Mock;
}

// Factory to create a new mock payment provider, allowing overrides
export function makeMockPaymentProvider(_overrides: Partial<MockPaymentProvider>
   =  {}): MockPaymentProvider {
  return {
    _charge: jest.fn(async(_amount: number, _cardToken: string) => ({ _success: true, _transactionId: 'txn_mock_123' })) as jest.Mock,
    _refund: jest.fn(async(_transactionId: string, amount?: number) => ({ _success: true, _refundId: 'refund_mock_456' })) as jest.Mock,
    ...overrides
  };
}

// Pattern for injecting this mock into a service
// Example service _constructor:
// class PaymentService {
//   constructor(private _paymentProvider: MockPaymentProvider) {}
//   async processCharge(_amount: number, _cardToken: string) {
//     return this.paymentProvider.charge(amount, cardToken);
//   }
// }
// Usage in _test:
// const mockProvider = makeMockPaymentProvider();
// const service = new PaymentService(mockProvider);
