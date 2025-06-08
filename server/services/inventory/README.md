# Inventory Service

This service implements the standard service pattern for inventory management in ChainSync.

## Features

- Standardized CRUD operations for inventory items
- Batch management with optimistic locking
- Resilient operations with retry and circuit breaker patterns
- Integration with supplier APIs with fallback mechanisms
- Caching for performance optimization

## Migration Notes

This service was migrated from the existing resilient-inventory-service.ts implementation to follow the standardized service pattern.

Key improvements:

- Proper dependency injection using the ServiceFactory
- Consistent error handling with ServiceError class
- Improved caching strategies
- Better typing with Zod schema validation
- Integration with monitoring through OpenTelemetry

## Usage

```typescript
// Create service instance using factory
const inventoryService = serviceFactory.getService(InventoryService);

// Get inventory by ID
const inventoryItem = await inventoryService.getById('123');

// Update inventory quantity
await inventoryService.updateQuantity('123', 10, 'add', {
  batchId: 'batch-456',
  reason: 'stock-adjustment',
});
```
