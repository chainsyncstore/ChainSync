// test/helpers/mockTransactionFlow.ts
export function mockTransactionFlow(overrides = {}) {
  return {
    transaction: { id: 1, status: 'COMPLETED', ...overrides },
    customer: { id: 1, loyaltyPoints: 0, loyaltyEnabled: true, ...overrides }
    // ...add more mocks as needed
  };
}
