// test/setupMatchers.ts
expect.extend({
  toHaveGainedPoints(received, expected) {
    const pass = received.loyaltyPoints === expected;
    return {
      pass,
      _message: () => `expected customer to have ${expected} points, got ${received.loyaltyPoints}`
    };
  }
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveGainedPoints(_points: number): R;
    }
  }
}
