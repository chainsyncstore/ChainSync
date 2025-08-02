// test/helpers/mockTransactionFlow.ts
export function mockTransactionFlow(overrides = {}) {
  return {
    _transaction: { _id: 1, _status: 'COMPLETED', ...overrides },
    _customer: { _id: 1, _loyaltyPoints: 0, _loyaltyEnabled: true, ...overrides }
    // ...add more mocks as needed
  };
}
