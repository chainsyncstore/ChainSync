# ChainSync Schema Style Guide

## Naming Conventions

### Table Names
- **Use plural nouns**: `users`, `products`, `transactions`
- **Use snake_case**: `loyalty_programs`, `inventory_batches`
- **Consistency for related tables**: Prefix related tables with the domain name
  - Example: `loyalty_programs`, `loyalty_members`, `loyalty_transactions`

### Column Names
- **In TypeScript code**: Use camelCase
  - Example: `userId`, `fullName`, `createdAt`
- **In Database**: Use snake_case
  - Example: `user_id`, `full_name`, `created_at`
- **Primary keys**: Use `id` as the primary key name
- **Foreign keys**: Use the pattern `entityName` + `Id`
  - Example: `userId`, `productId`, `storeId`

### Field Name Mappings
Drizzle ORM manages the mapping between TypeScript camelCase and database snake_case automatically.

```typescript
// In TypeScript schema definition
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),  // camelCase in code, snake_case in DB
  emailAddress: text("email_address"),    // camelCase in code, snake_case in DB
});

// Usage in code
const user = await db.query.users.findFirst({
  where: eq(users.fullName, "John Doe")   // Use camelCase in code
});
```

### Boolean Fields
- **Start with 'is', 'has', or 'can'**: `isActive`, `hasSubscription`, `canEdit`
- **Default value**: Always specify a default value for boolean fields

### Timestamp Fields
- All tables should include:
  - `createdAt`: When the record was created
  - `updatedAt`: When the record was last updated
- Use the `defaultNow()` function for `createdAt`

### Enum Values
- **In code**: Use PascalCase for enum types, UPPER_CASE for enum values
- **In database**: Use lowercase with underscores

## Schema Definition Rules

### Required Fields
- Use `.notNull()` for required fields
- Document any business logic constraints for fields

### Indexes
- Create indexes for fields frequently used in WHERE clauses
- Name indexes consistently: `idx_[table]_[field]`

### Relations
- Define relations explicitly using the relations helper
- Ensure foreign key constraints are properly defined

## Examples

### Good Example
```typescript
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  categoryId: integer("category_id").references(() => categories.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  nameIndex: index("idx_products_name").on(table.name),
  categoryIndex: index("idx_products_category").on(table.categoryId)
}));

export const productsRelations = relations(products, ({ one }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id]
  })
}));
```

### Bad Example
```typescript
// Avoid this approach
export const Product = pgTable("Product", {  // Incorrect: singular and PascalCase
  ID: serial("ID").primaryKey(),  // Incorrect: uppercase
  product_name: text("product_name"), // Incorrect: snake_case in code
  active: boolean("active"),  // Missing default value and notNull
});
```
