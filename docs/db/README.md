# ChainSync Database Guide

This guide documents the standard patterns and best practices for working with the database in the ChainSync application.

## Table of Contents

1. [Database Architecture](#database-architecture)
2. [Drizzle ORM Usage](#drizzle-orm-usage)
3. [SQL Helper Utilities](#sql-helper-utilities)
4. [Schema Definition](#schema-definition)
5. [Query Operations](#query-operations)
6. [Error Handling](#error-handling)
7. [Validation](#validation)
8. [Migrations](#migrations)
9. [Performance Optimization](#performance-optimization)

## Database Architecture

ChainSync uses a PostgreSQL database with the following architecture:

- **Connection Pool Management**: Centralized connection pool for optimal resource usage
- **Type-safe ORM**: Drizzle ORM for type-safe database operations
- **SQL Helper Library**: Standardized utility functions for common database operations
- **Schema Validation**: Runtime validation of database responses with Zod
- **Migration Management**: Versioned migrations with automatic schema synchronization

## Drizzle ORM Usage

### Defining Schema

Use the Drizzle schema definition to create type-safe table definitions:

```typescript
import { mysqlTable, int, varchar, text, boolean, datetime } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

export const users = mysqlTable('users', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at')
});
```

### Database Operations

#### Basic CRUD Operations

**Select**:
```typescript
import { db } from '../../db';
import { users } from './schema';
import { eq } from 'drizzle-orm';
import { findById, findMany } from '../../server/db/sqlHelpers';

// Using SQL helpers (recommended)
const user = await findById(db, users, 'id', 123);

// Using Drizzle directly
const result = await db.select().from(users).where(eq(users.id, 123));
```

**Insert**:
```typescript
import { insertOne } from '../../server/db/sqlHelpers';

// Using SQL helpers (recommended)
const newUser = await insertOne(db, users, {
  name: 'John Doe',
  email: 'john@example.com'
});

// Using Drizzle directly
const result = await db.insert(users).values({
  name: 'John Doe',
  email: 'john@example.com'
}).returning();
```

**Update**:
```typescript
import { updateById } from '../../server/db/sqlHelpers';

// Using SQL helpers (recommended)
const updatedUser = await updateById(db, users, 'id', 123, {
  name: 'Updated Name'
});

// Using Drizzle directly
const result = await db.update(users)
  .set({ name: 'Updated Name' })
  .where(eq(users.id, 123))
  .returning();
```

**Delete**:
```typescript
import { deleteById } from '../../server/db/sqlHelpers';

// Using SQL helpers (recommended)
const deletedUser = await deleteById(db, users, 'id', 123);

// Using Drizzle directly
const result = await db.delete(users)
  .where(eq(users.id, 123))
  .returning();
```

#### Advanced Queries

**Pagination**:
```typescript
import { findMany, paginationClause } from '../../server/db/sqlHelpers';

// Using SQL helpers (recommended)
const usersPage = await findMany(db, users, eq(users.isActive, true), {
  page: 2,
  limit: 10
});

// Using Drizzle directly
const result = await db.select()
  .from(users)
  .where(eq(users.isActive, true))
  .limit(10)
  .offset(10); // Page 2 with 10 items per page
```

**Joins**:
```typescript
import { orders } from './schema';
import { joinTables } from '../../server/db/sqlHelpers';

// Using SQL helpers (recommended)
const userOrders = await joinTables(
  db,
  users,
  orders,
  'id',
  'userId',
  eq(users.id, 123)
);

// Using Drizzle directly
const result = await db.select()
  .from(users)
  .innerJoin(orders, eq(users.id, orders.userId))
  .where(eq(users.id, 123));
```

**Transactions**:
```typescript
import { withTransaction } from '../../server/db/sqlHelpers';

// Using SQL helpers (recommended)
const result = await withTransaction(db, async (tx) => {
  const user = await findById(tx, users, 'id', 123);
  if (!user) throw new Error('User not found');
  
  const updatedUser = await updateById(tx, users, 'id', 123, {
    name: 'Transaction Update'
  });
  
  const newOrder = await insertOne(tx, orders, {
    userId: 123,
    amount: 100
  });
  
  return { user: updatedUser, order: newOrder };
}, 'createOrderForUser');

// Using Drizzle directly
const result = await db.transaction(async (tx) => {
  const [user] = await tx.select()
    .from(users)
    .where(eq(users.id, 123))
    .limit(1);
  
  if (!user) throw new Error('User not found');
  
  const [updatedUser] = await tx.update(users)
    .set({ name: 'Transaction Update' })
    .where(eq(users.id, 123))
    .returning();
  
  const [newOrder] = await tx.insert(orders)
    .values({ userId: 123, amount: 100 })
    .returning();
  
  return { user: updatedUser, order: newOrder };
});
```

## SQL Helper Utilities

The SQL Helper Library (`server/db/sqlHelpers.ts`) provides standardized functions for common database operations. Always use these helpers when possible to ensure consistent patterns and error handling.

### Key Helper Functions

- `findById`: Find a record by ID
- `findMany`: Find multiple records with filtering and pagination
- `insertOne`: Insert a single record
- `updateById`: Update a record by ID
- `deleteById`: Delete a record by ID
- `joinTables`: Perform a join between two tables
- `withTransaction`: Execute operations within a transaction
- `executeRawQuery`: Execute a raw SQL query
- `validateDbResponse`: Validate a database response against a Zod schema
- `safeIdentifier`: Create a safe SQL identifier for table or column names
- `paginationClause`: Create a pagination clause for SQL queries
- `orderByClause`: Create an order by clause for SQL queries

## Schema Definition

Define database schemas in dedicated schema files using Drizzle's schema definition syntax:

```typescript
// server/db/schema.ts
import { mysqlTable, int, varchar, text, boolean, datetime } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

export const users = mysqlTable('users', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at')
});

export const orders = mysqlTable('orders', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id').notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at')
});
```

## Query Operations

### Safe Dynamic Queries

Always use parameterized queries and avoid string concatenation to prevent SQL injection:

```typescript
// UNSAFE - DO NOT DO THIS
const unsafe = await db.execute(sql`SELECT * FROM users WHERE name = '${userName}'`);

// SAFE - Always do this
const safe = await db.execute(sql`SELECT * FROM users WHERE name = ${userName}`);

// EVEN SAFER - Use the SQL helpers
const safest = await executeRawQuery(
  db,
  sql`SELECT * FROM users WHERE name = ${userName}`,
  'getUserByName'
);
```

### Dynamic Table/Column Names

For dynamic table or column names, use the `safeIdentifier` function:

```typescript
import { safeIdentifier } from '../../server/db/sqlHelpers';

// Safely reference a dynamic column name
const columnName = 'status';
const result = await executeRawQuery(
  db,
  sql`SELECT * FROM orders WHERE ${safeIdentifier(columnName)} = ${status}`,
  'getOrdersByStatus'
);
```

## Error Handling

Always use the `withDbTryCatch` utility to handle database errors consistently:

```typescript
import { withDbTryCatch } from '../../server/db/sqlHelpers';

const result = await withDbTryCatch(
  db,
  async (client) => {
    return await client.select().from(users).where(eq(users.id, 123));
  },
  'getUserById'
);
```

The `withDbTryCatch` function provides:
- Standardized error handling
- Automatic logging of errors
- Performance metrics (query duration)
- Consistent error format with context information

## Validation

Validate database responses using Zod schemas to ensure type safety and data integrity:

```typescript
import { z } from 'zod';
import { validateDbResponse } from '../../server/db/sqlHelpers';

// Define a validation schema
const userSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date().nullable()
});

// Use the validation helper
const user = await findById(db, users, 'id', 123);
const validatedUser = validateDbResponse(user, userSchema);
```

## Migrations

### Creating Migrations

1. Define your schema changes in a migration file:

```typescript
// server/db/migrations/001_create_users.ts
import { db } from '../../db';
import { sql } from 'drizzle-orm';

export async function up() {
  await db.execute(sql`
    CREATE TABLE users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME
    )
  `);
}

export async function down() {
  await db.execute(sql`DROP TABLE users`);
}
```

2. Register the migration in the migrations index:

```typescript
// server/db/migrations/index.ts
import * as migration001 from './001_create_users';
import * as migration002 from './002_add_orders';

export const migrations = [
  migration001,
  migration002
];
```

3. Run migrations using the migration utility:

```typescript
// scripts/migrate.ts
import { runMigrations } from '../server/db/migrations/runner';

async function main() {
  await runMigrations();
  console.log('Migrations completed successfully');
  process.exit(0);
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
```

## Performance Optimization

### Query Optimization

- Use indexes for frequently queried columns
- Limit result sets with pagination
- Use transactions for related operations
- Include only necessary columns in select statements

### Monitoring and Metrics

The SQL Helper Library automatically tracks query performance metrics:

- Query duration
- Error rates
- Transaction success/failure
- Connection pool utilization

Access these metrics through the database manager:

```typescript
import { dbManager } from '../../db';

const metrics = dbManager.getMetrics();
console.log('Average query time:', metrics.avgQueryTime);
console.log('Slow queries:', metrics.slowQueries);
```

## Best Practices

1. **Always use the SQL helper utilities** for database operations
2. **Validate database responses** with Zod schemas
3. **Use transactions** for operations that require consistency
4. **Handle errors** with the `withDbTryCatch` utility
5. **Limit result sets** with pagination
6. **Use appropriate indexes** for frequently queried columns
7. **Avoid raw SQL queries** when possible
8. **Use parameterized queries** to prevent SQL injection
9. **Test database operations** with unit and integration tests
10. **Document database schema changes** in migration files
