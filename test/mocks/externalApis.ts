// test/mocks/externalApis.ts
// Example: Mock for a hypothetical payment provider API
import { jest } from '@jest/globals';

// Define the shape of the payment provider
export interface MockPaymentProvider {
  charge: jest.MockedFunction<
    (amount: number, cardToken: string) => Promise<{ success: boolean; transactionId: string }>
  >;
  refund: jest.MockedFunction<
    (transactionId: string, amount?: number) => Promise<{ success: boolean; refundId: string }>
  >;
}

// Factory to create a new mock payment provider, allowing overrides
export function makeMockPaymentProvider(
  overrides: Partial<MockPaymentProvider> = {}
): MockPaymentProvider {
  return {
    charge: jest.fn(async (amount: number, cardToken: string) => ({
      success: true,
      transactionId: 'txn_mock_123',
    })),
    refund: jest.fn(async (transactionId: string, amount?: number) => ({
      success: true,
      refundId: 'refund_mock_456',
    })),
    ...overrides,
  };
}

// Pattern for injecting this mock into a service
// Example service constructor:
// class PaymentService {
//   constructor(private paymentProvider: MockPaymentProvider) {}
//   async processCharge(amount: number, cardToken: string) {
//     return this.paymentProvider.charge(amount, cardToken);
//   }
// }
// Usage in test:
// const mockProvider = makeMockPaymentProvider();
// const service = new PaymentService(mockProvider);
