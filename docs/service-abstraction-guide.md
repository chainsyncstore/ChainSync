# ChainSync Service Abstraction Guide

## Overview

This guide documents the service abstraction patterns implemented in the ChainSync project to standardize database interactions, error handling, and data formatting across services. These patterns address common TypeScript issues related to field mapping between camelCase (in code) and snake_case (in database), as well as providing consistent approaches for SQL query execution and result formatting.

## Table of Contents

1. [Core Utilities](#core-utilities)
   - [Field Mapping](#field-mapping)
   - [SQL Helpers](#sql-helpers)
   - [Service Helpers](#service-helpers)
2. [Enhanced Base Service](#enhanced-base-service)
3. [Implementing Service-Specific Formatters](#implementing-service-specific-formatters)
4. [Usage Patterns](#usage-patterns)
   - [Creating a New Service](#creating-a-new-service)
   - [Field Mapping and Database Interactions](#field-mapping-and-database-interactions)
   - [Error Handling](#error-handling)
   - [Result Formatting](#result-formatting)
5. [Testing](#testing)
6. [Best Practices](#best-practices)

## Core Utilities

### Field Mapping

Located in `shared/utils/field-mapping.ts`, these utilities handle the conversion between camelCase (in code) and snake_case (in database).

```typescript
// Convert object keys from camelCase to snake_case
const dbData = toDatabaseFields(subscriptionData);

// Convert object keys from snake_case to camelCase
const codeData = fromDatabaseFields(dbResult);

// Extract only specific fields from an object
const userFields = pickFields(userData, ['id', 'email', 'name']);

// Check if an object has a specific field
if (hasField(userData, 'email')) {
  // Do something with the email
}
```

### SQL Helpers

Located in `shared/utils/sql-helpers.ts`, these utilities provide consistent handling of SQL queries, dates, and JSON data.

```typescript
// Format dates and JSON for SQL
const sqlDate = formatDateForSql(new Date());
const sqlJson = formatJsonForSql({ key: 'value' });

// Build parameterized queries
const { query, values } = buildInsertQuery('users', userData);
const { query, values } = buildUpdateQuery('users', userData, 'id = 1');

// Build raw SQL queries (for TypeScript compatibility)
const preparedData = prepareSqlValues(userData);
const query = buildRawInsertQuery('users', preparedData);
const query = buildRawUpdateQuery('users', preparedData, 'id = 1');
```

### Service Helpers

Located in `shared/utils/service-helpers.ts`, these utilities standardize result formatting and error handling.

```typescript
// Using a result formatter
class UserFormatter extends ResultFormatter<User> {
  formatResult(dbResult: Record<string, any>): User {
    // Convert database fields to domain object
    return {
      ...this.baseFormat(dbResult),
      metadata: this.handleMetadata(dbResult.metadata)
    };
  }
}

// Using the error handler
try {
  // Some operation
} catch (error) {
  throw ServiceErrorHandler.handleError(error, 'creating user');
}

// Ensure a result exists
const user = ServiceErrorHandler.ensureExists(result, 'User');
```

## Enhanced Base Service

Located in `server/services/base/enhanced-service.ts`, this service provides a foundation for all services, combining the utilities above into a comprehensive base class.

```typescript
class UserService extends EnhancedBaseService {
  async createUser(params: CreateUserParams): Promise<User> {
    try {
      // Validate and insert with proper field mapping
      const user = await this.rawInsertWithFormatting(
        'users',
        preparedData,
        this.formatter.formatResult.bind(this.formatter)
      );
      
      return this.ensureExists(user, 'User');
    } catch (error) {
      return this.handleError(error, 'creating user');
    }
  }
}
```

## Implementing Service-Specific Formatters

Each service should have its own formatter to standardize the conversion from database rows to domain objects:

```typescript
class SubscriptionFormatter extends ResultFormatter<Subscription> {
  formatResult(dbResult: Record<string, any>): Subscription {
    // First apply base formatting (snake_case to camelCase)
    const base = this.baseFormat(dbResult);
    
    // Parse metadata if present
    const metadata = this.handleMetadata(base.metadata);
    
    // Convert date strings to Date objects
    const withDates = this.formatDates(
      base, 
      ['createdAt', 'updatedAt', 'startDate', 'endDate']
    );
    
    // Return the formatted subscription
    return {
      ...withDates,
      id: Number(withDates.id),
      userId: Number(withDates.userId),
      // ... other fields with specific formatting
      metadata: metadata
    };
  }
}
```

## Usage Patterns

### Creating a New Service

1. Create a service-specific formatter by extending `ResultFormatter`
2. Create a service interface to define the service API
3. Implement the service by extending `EnhancedBaseService`

```typescript
// 1. Create a formatter
class UserFormatter extends ResultFormatter<User> {
  formatResult(dbResult: Record<string, any>): User {
    // Formatting logic
  }
}

// 2. Define the interface
interface IUserService {
  createUser(params: CreateUserParams): Promise<User>;
  updateUser(userId: number, params: UpdateUserParams): Promise<User>;
  // ... other methods
}

// 3. Implement the service
class UserService extends EnhancedBaseService implements IUserService {
  private formatter: UserFormatter;
  
  constructor() {
    super();
    this.formatter = new UserFormatter();
  }
  
  // Implement the interface methods
}
```

### Field Mapping and Database Interactions

When interacting with the database, use the appropriate method from `EnhancedBaseService`:

```typescript
// For inserts
await this.insertWithFormatting(
  'users',
  userData,
  this.formatter.formatResult.bind(this.formatter)
);

// For updates
await this.updateWithFormatting(
  'users',
  userData,
  `id = ${userId}`,
  this.formatter.formatResult.bind(this.formatter)
);

// For raw SQL (to resolve TypeScript field mapping issues)
await this.rawInsertWithFormatting(
  'users',
  userData,
  this.formatter.formatResult.bind(this.formatter)
);

// For multiple results
await this.executeSqlWithMultipleResults(
  'SELECT * FROM users WHERE active = TRUE',
  [],
  this.formatter.formatResult.bind(this.formatter)
);
```

### Error Handling

Use the standardized error handling methods to ensure consistent error responses:

```typescript
try {
  // Some operation that might fail
} catch (error) {
  return this.handleError(error, 'descriptive operation name');
}

// Check if a result exists
return this.ensureExists(result, 'Entity Name');
```

### Result Formatting

Always use formatters to convert database results to domain objects:

```typescript
// Single result
const result = await this.executeSqlWithFormatting(
  query,
  params,
  this.formatter.formatResult.bind(this.formatter)
);

// Multiple results
const results = await this.executeSqlWithMultipleResults(
  query,
  params,
  this.formatter.formatResult.bind(this.formatter)
);
```

## Testing

Unit tests for each utility and service should cover:

1. Field mapping conversions
2. SQL query generation
3. Error handling
4. Result formatting

Use the provided test files as examples:
- `tests/utils/field-mapping.test.ts`
- `tests/utils/sql-helpers.test.ts`
- `tests/utils/service-helpers.test.ts`
- `tests/services/enhanced-base-service.test.ts`

## Best Practices

1. **Always use formatters**: Never return raw database results directly to clients
2. **Handle errors consistently**: Use the error handling utilities to ensure consistent error responses
3. **Raw SQL for TypeScript issues**: Use raw SQL methods when TypeScript has issues with field mapping
4. **Validate input data**: Use Zod schemas to validate input data before database operations
5. **Document service methods**: Add JSDoc comments to document service methods and parameters
6. **Test edge cases**: Ensure tests cover error scenarios and edge cases
7. **Minimize duplication**: Extract common patterns into reusable utilities
8. **Consistent field naming**: Follow camelCase in code and snake_case in database consistently
