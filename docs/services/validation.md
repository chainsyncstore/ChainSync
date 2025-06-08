# Service Validation Standards

This document outlines the standard validation patterns and practices for ChainSync services.

## Overview

All service operations that accept user input must perform validation using Zod schemas. This ensures consistent type safety, error handling, and data normalization across the application.

## Standard Validation Approach

### 1. Define Zod Schemas

Each service should define validation schemas for its operations:

```typescript
// Example schema definitions
import { z } from 'zod';
import { CommonSchemas } from '../../utils/zod-helpers';

export const userCreateSchema = z.object({
  name: CommonSchemas.nonEmptyString,
  email: CommonSchemas.email,
  role: z.enum(['admin', 'user', 'guest']),
  status: CommonSchemas.status.default('active'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const userUpdateSchema = userCreateSchema.partial();
```

### 2. Use Standard Validation in Services

```typescript
import { BaseService } from '../base/standard-service';
import { userCreateSchema, userUpdateSchema } from './schemas';

class UserService extends BaseService<
  User,
  z.infer<typeof userCreateSchema>,
  z.infer<typeof userUpdateSchema>
> {
  protected readonly entityName = 'user';
  protected readonly tableName = 'users';
  protected readonly primaryKeyField = 'id';
  protected readonly createSchema = userCreateSchema;
  protected readonly updateSchema = userUpdateSchema;

  // Service implementation...
}
```

### 3. Handle Validation Errors

All validation errors are automatically handled by the `validateInput` method in the `BaseService` class:

```typescript
try {
  const validatedData = this.validateInput(data, this.createSchema);
  // Process the validated data...
} catch (error) {
  // The BaseService.handleError method will automatically convert ZodErrors to ServiceErrors
  return this.handleError(error, 'Error validating input');
}
```

## Common Validation Patterns

### Required Fields

```typescript
const schema = z.object({
  name: z.string().min(1, { message: 'Name is required' }),
});
```

### Optional Fields

```typescript
const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});
```

### Default Values

```typescript
const schema = z.object({
  status: z.enum(['active', 'inactive']).default('active'),
});
```

### Type Coercion

```typescript
const schema = z.object({
  id: z.string().uuid().or(z.number().int().positive()).transform(String),
  isActive: z.boolean().or(z.enum(['true', 'false']).transform(v => v === 'true')),
});
```

### Complex Validation

```typescript
const schema = z
  .object({
    startDate: z.date(),
    endDate: z.date(),
  })
  .refine(data => data.endDate > data.startDate, {
    message: 'End date must be after start date',
    path: ['endDate'],
  });
```

## Common Schemas

The `CommonSchemas` object in `utils/zod-helpers.ts` provides reusable validation schemas:

- `uuid`: Validates UUID strings
- `email`: Validates and normalizes email addresses
- `phone`: Validates phone numbers
- `url`: Validates URLs
- `nonEmptyString`: Ensures strings are not empty after trimming
- `positiveNumber`: Ensures numbers are positive
- `nonNegativeNumber`: Ensures numbers are zero or positive
- `date`: Validates Date objects
- `dateString`: Validates date strings in ISO format
- `pagination`: Standard pagination parameters

## Input Normalization

Zod provides powerful data transformation capabilities:

```typescript
const schema = z.object({
  email: z.string().email().toLowerCase(),
  name: z.string().trim(),
  tags: z.array(z.string()).transform(tags => tags.map(tag => tag.trim().toLowerCase())),
});
```

## Best Practices

1. **Single Source of Truth**: Define schemas once and reuse them for similar operations
2. **Clear Error Messages**: Provide specific error messages for each field
3. **Transform Data**: Use `.transform()` to normalize data during validation
4. **Composition**: Compose complex schemas from simpler ones
5. **Refinements**: Use `.refine()` for cross-field validations
6. **Documentation**: Comment schemas with examples and edge cases
7. **Defaults**: Use `.default()` for optional fields with sensible defaults
8. **Performance**: Keep schemas simple for high-volume operations

## Useful Utilities

The `SchemaUtils` and `ValidationHelpers` in `utils/zod-helpers.ts` provide helpful utilities:

- `stringToNumber`: Converts string inputs to numbers
- `trimAllStrings`: Automatically trims all string fields in an object
- `optionalField`: Creates an optional field that must meet validation if present
- `nullableField`: Creates a field that can be null or must meet validation
- `enumToSchema`: Converts TypeScript enums to Zod schemas
- `idValidator`: Creates a schema for ID validation with appropriate error messages
- `formatZodError`: Formats Zod errors into a standard structure

## Example: Complete Service Validation

```typescript
import { z } from 'zod';
import { BaseService } from '../base/standard-service';
import { CommonSchemas, SchemaUtils } from '../../utils/zod-helpers';

// Schema definitions
export const productCreateSchema = z.object({
  name: CommonSchemas.nonEmptyString,
  description: z.string().optional(),
  price: CommonSchemas.positiveNumber,
  stock: CommonSchemas.nonNegativeNumber.default(0),
  categories: z.array(z.string()).min(1, { message: 'At least one category is required' }),
  isActive: CommonSchemas.boolean.default(true),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const productUpdateSchema = productCreateSchema.partial();

export const productSearchSchema = z
  .object({
    query: z.string().optional(),
    minPrice: CommonSchemas.nonNegativeNumber.optional(),
    maxPrice: CommonSchemas.positiveNumber.optional(),
    categories: z.array(z.string()).optional(),
    ...CommonSchemas.pagination,
  })
  .refine(
    data => {
      if (data.minPrice && data.maxPrice) {
        return data.maxPrice > data.minPrice;
      }
      return true;
    },
    {
      message: 'Maximum price must be greater than minimum price',
      path: ['maxPrice'],
    }
  );

// Service implementation
class ProductService extends BaseService<
  Product,
  z.infer<typeof productCreateSchema>,
  z.infer<typeof productUpdateSchema>
> {
  protected readonly entityName = 'product';
  protected readonly tableName = 'products';
  protected readonly primaryKeyField = 'id';
  protected readonly createSchema = productCreateSchema;
  protected readonly updateSchema = productUpdateSchema;

  async search(params: z.infer<typeof productSearchSchema>): Promise<ListResponse<Product>> {
    try {
      // Validate input
      const validatedParams = this.validateInput(params, productSearchSchema);

      // Build filters
      const filters: Record<string, unknown> = {};

      if (validatedParams.query) {
        // Use SQL LIKE for text search
        filters.name = sql`LIKE ${`%${validatedParams.query}%`}`;
      }

      if (validatedParams.categories?.length) {
        // Using array intersection in PostgreSQL
        filters.categories = sql`&& ${sql.array(validatedParams.categories)}`;
      }

      if (validatedParams.minPrice !== undefined) {
        filters.price = sql`>= ${validatedParams.minPrice}`;
      }

      if (validatedParams.maxPrice !== undefined) {
        filters.price = sql`<= ${validatedParams.maxPrice}`;
      }

      // Use the standard list method with our filters and pagination
      return this.list(filters, {
        page: validatedParams.page,
        limit: validatedParams.limit,
        sortBy: validatedParams.sortBy,
        sortDirection: validatedParams.sortDirection,
      });
    } catch (error) {
      return this.handleError(error, 'Error searching products');
    }
  }
}
```
