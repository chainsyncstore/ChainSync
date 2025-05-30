# ChainSync Service Standard Guide

## Overview

This guide documents the standardized service pattern implemented in Phase 1 of our 6-phase roadmap. The goal is to ensure consistent, maintainable, and resilient service implementations across the entire ChainSync application.

## Key Components

The standardized service architecture consists of these key components:

1. **Base Service Class** - Core functionality for all services
2. **Service Factory** - Consistent instantiation with dependency injection
3. **ServiceError** - Standardized error handling
4. **Zod Schemas** - Consistent input validation

## Service Implementation Guide

### 1. Creating a New Service

To create a new service that follows the standard pattern:

```typescript
import { z } from 'zod';
import { BaseService, ServiceConfig } from '../base/standard-service';
import { ErrorCode } from '@shared/types/errors';

// 1. Define validation schemas
const entityCreateSchema = z.object({
  name: z.string().min(1),
  isActive: z.boolean().default(true),
  // Add required fields
});

const entityUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  // Add optional fields
});

// 2. Define entity interfaces
export interface Entity {
  id: number;
  name: string;
  isActive: boolean;
  createdAt: Date;
}

// 3. Create the service class
export class EntityService extends BaseService<Entity, 
  z.infer<typeof entityCreateSchema>, 
  z.infer<typeof entityUpdateSchema>> {
  
  // Required abstract properties
  protected readonly entityName = 'entity';
  protected readonly tableName = entities; // Import from db schema
  protected readonly primaryKeyField = 'id';
  protected readonly createSchema = entityCreateSchema;
  protected readonly updateSchema = entityUpdateSchema;
  
  constructor(config: ServiceConfig) {
    super(config);
    this.logger.info('EntityService initialized');
  }
  
  // 4. Add custom service methods
  async getActiveEntities(): Promise<Entity[]> {
    try {
      return await this.executeQuery(
        async (db) => {
          return db
            .select()
            .from(this.tableName)
            .where(eq(this.tableName.isActive, true));
        },
        'entity.getActive'
      );
    } catch (error) {
      return this.handleError(error, 'Error fetching active entities');
    }
  }
}
```

### 2. Using the Service Factory

Always use the Service Factory to instantiate services for consistent dependency injection:

```typescript
import { getService } from '../services/factory';
import { EntityService } from '../services/entity/service';

// Get service instance
const entityService = getService(EntityService);

// Use the service
const entity = await entityService.getById(123);
```

### 3. Error Handling

All services have consistent error handling through the ServiceError class:

```typescript
try {
  // Service operation
} catch (error) {
  if (error instanceof ServiceError) {
    // Handle specific error codes
    if (error.code === ErrorCode.NOT_FOUND) {
      // Handle not found
    } else if (error.code === ErrorCode.VALIDATION_ERROR) {
      // Handle validation error
    }
  } else {
    // Handle unexpected errors
  }
}
```

### 4. Transactions

Use transactions for operations that require data consistency:

```typescript
await entityService.withTransaction(async (trx) => {
  // Perform multiple operations within a transaction
  const entity = await trx
    .insert(entities)
    .values(data)
    .returning();
    
  await trx
    .insert(relatedTable)
    .values({ entityId: entity[0].id, ...otherData });
    
  return entity[0];
});
```

### 5. Caching

Services implement consistent caching patterns:

```typescript
// Override cache key generation if needed
protected getCacheKey(id: string | number): string | null {
  if (!this.cache) return null;
  return `custom:${this.entityName}:${id}`;
}

// Invalidate cache when data changes
protected async invalidateListCache(): Promise<void> {
  if (!this.cache) return;
  await this.cache.invalidatePattern(`${this.entityName}:list:*`);
  await this.cache.invalidatePattern(`custom:${this.entityName}:*`);
}
```

### 6. Resilience Patterns

Use retry mechanisms for operations that may fail transiently:

```typescript
await this.withRetry(
  async () => this.someOperationThatMightFail(),
  {
    maxRetries: 3,
    baseDelayMs: 1000,
    retryableErrors: [ErrorCode.TEMPORARY_UNAVAILABLE, ErrorCode.EXTERNAL_SERVICE_ERROR]
  }
);
```

## Migration Checklist

When migrating an existing service to the standard pattern:

1. ✅ Create validation schemas for inputs
2. ✅ Define proper interfaces for all entities
3. ✅ Extend the BaseService class
4. ✅ Implement required abstract properties
5. ✅ Convert direct database access to use executeQuery
6. ✅ Implement proper error handling with ServiceError
7. ✅ Add appropriate caching with invalidation
8. ✅ Use transactions for multi-step operations
9. ✅ Add retry mechanisms for resilience
10. ✅ Update tests to use the new service pattern

## Best Practices

1. **Validation First** - Always validate inputs with Zod schemas
2. **Explicit Error Handling** - Use ServiceError with specific error codes
3. **Consistent Logging** - Log operations at appropriate levels
4. **Defensive Caching** - Always check if cache exists before using it
5. **Resilient Operations** - Use retry and circuit breaker patterns for external dependencies
6. **Transaction Safety** - Use transactions for any multi-step database operations
7. **Type Safety** - Leverage TypeScript for type safety across the service
8. **Documentation** - Document complex service methods with JSDoc

## Example Services

Refer to these standardized service implementations for examples:

1. `auth/auth-service-standard.ts` - Authentication with Redis token storage
2. `inventory/standard-inventory-service.ts` - Inventory with resilience patterns
3. `loyalty/standard-loyalty-service.ts` - Loyalty with complex transactions
