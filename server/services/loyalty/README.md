# Loyalty Service

This service implements the standard service pattern for loyalty program management in ChainSync.

## Features

- Customer loyalty program management
- Points accrual and redemption
- Tiered membership levels
- Rewards management
- Transaction tracking

## Migration Notes

This service was migrated from the original service.ts implementation to follow the standardized service pattern.

Key improvements:
- Proper dependency injection using the ServiceFactory
- Consistent error handling with ServiceError class
- Schema validation using Zod
- Improved performance with optimized caching strategies
- Transactions for data consistency

## Usage

```typescript
// Create service instance using factory
const loyaltyService = serviceFactory.getService(LoyaltyService);

// Get member by ID
const member = await loyaltyService.getMemberById('123');

// Add points to a member
await loyaltyService.addPoints({
  memberId: '123',
  points: 100,
  reason: 'purchase',
  transactionId: 'txn-456'
});
```
