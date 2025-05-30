# ChainSync Testing Guide

This document outlines our testing strategy, patterns, and best practices for ensuring code quality and reliability in the ChainSync application.

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Types of Tests](#types-of-tests)
3. [Writing Effective Tests](#writing-effective-tests)
4. [Mocking](#mocking)
5. [Database Testing](#database-testing)
6. [Validation and Error Handling](#validation-and-error-handling)
7. [Test Coverage Requirements](#test-coverage-requirements)
8. [CI/CD Integration](#cicd-integration)

## Testing Philosophy

Our testing approach is designed to:

- **Prevent regressions**: Catch bugs before they reach production
- **Document behavior**: Tests serve as executable documentation
- **Enable refactoring**: Safely modify code with confidence
- **Validate business rules**: Ensure system correctness
- **Improve developer experience**: Make testing easy and effective

## Types of Tests

### Unit Tests

Unit tests verify isolated components of the system, typically individual functions or methods.

**When to use**: For testing business logic, utility functions, and isolated components.

```typescript
// Example unit test for a utility function
describe('formatCurrency', () => {
  it('should format USD correctly', () => {
    expect(formatCurrency(1234.56, 'USD')).toBe('$1,234.56');
  });
  
  it('should handle zero values', () => {
    expect(formatCurrency(0, 'USD')).toBe('$0.00');
  });
  
  it('should handle negative values', () => {
    expect(formatCurrency(-99.99, 'USD')).toBe('-$99.99');
  });
});
```

### Integration Tests

Integration tests verify that multiple components work together correctly.

**When to use**: For testing service interactions, API endpoints, or database operations.

```typescript
// Example integration test for a service that interacts with the database
describe('ProductService', () => {
  beforeAll(async () => {
    // Set up test database
    await setupTestDatabase();
  });
  
  afterAll(async () => {
    // Clean up test database
    await cleanupTestDatabase();
  });
  
  it('should retrieve a product by ID', async () => {
    // Create test data
    const testProduct = await createTestProduct();
    
    // Test the service
    const productService = new ProductService();
    const result = await productService.getProductById(testProduct.id);
    
    // Assertions
    expect(result).toBeDefined();
    expect(result.id).toBe(testProduct.id);
    expect(result.name).toBe(testProduct.name);
  });
  
  it('should handle product not found', async () => {
    const productService = new ProductService();
    await expect(productService.getProductById('non-existent')).rejects.toThrow();
  });
});
```

### End-to-End Tests

End-to-end tests validate complete user flows from UI to database and back.

**When to use**: For critical business workflows and user journeys.

```typescript
// Example E2E test using Playwright
test('user can add a product to cart and checkout', async ({ page }) => {
  await page.goto('/products');
  
  // Add product to cart
  await page.click('[data-testid="product-card"]');
  await page.click('[data-testid="add-to-cart"]');
  
  // Go to cart and checkout
  await page.click('[data-testid="cart-icon"]');
  await expect(page.locator('[data-testid="cart-items"]')).toContainText('Product Name');
  
  await page.click('[data-testid="checkout-button"]');
  
  // Fill checkout form
  await page.fill('[data-testid="customer-name"]', 'Test User');
  await page.fill('[data-testid="customer-email"]', 'test@example.com');
  // ... more form filling
  
  await page.click('[data-testid="submit-order"]');
  
  // Verify success
  await expect(page.locator('[data-testid="order-confirmation"]')).toBeVisible();
});
```

## Writing Effective Tests

### Test Structure (AAA Pattern)

Follow the Arrange-Act-Assert pattern:

1. **Arrange**: Set up the test data and conditions
2. **Act**: Perform the action being tested
3. **Assert**: Verify the results

```typescript
it('should calculate order total with discount', () => {
  // Arrange
  const order = {
    items: [
      { price: 10, quantity: 2 },
      { price: 15, quantity: 1 }
    ],
    discountPercent: 10
  };
  
  // Act
  const total = calculateOrderTotal(order);
  
  // Assert
  expect(total).toBe(31.5); // (10*2 + 15) * 0.9
});
```

### Test Naming

Use descriptive test names that clearly indicate:
1. The unit being tested
2. The scenario or condition
3. The expected outcome

Pattern: `it('should [expected behavior] when [condition]')`

### Test Independence

Each test should be independent and not rely on the state from other tests:

- Use `beforeEach` to set up fresh test data
- Avoid test ordering dependencies
- Clean up after tests when necessary

## Mocking

### When to Mock

- External services (API calls, third-party integrations)
- Database operations in unit tests
- Time-dependent functionality
- Random or non-deterministic behavior

### Mocking Strategies

#### Mock Service Dependencies

```typescript
// Original service with dependency
class OrderService {
  constructor(private paymentGateway: PaymentGateway) {}
  
  async processOrder(order: Order): Promise<OrderResult> {
    // ... processing logic
    const paymentResult = await this.paymentGateway.processPayment(order.payment);
    // ... more logic
    return result;
  }
}

// In tests
it('should process order successfully', async () => {
  // Create mock payment gateway
  const mockPaymentGateway = {
    processPayment: jest.fn().mockResolvedValue({ success: true, id: 'payment-123' })
  };
  
  // Use mock in service
  const orderService = new OrderService(mockPaymentGateway);
  const result = await orderService.processOrder(testOrder);
  
  // Verify mock was called correctly
  expect(mockPaymentGateway.processPayment).toHaveBeenCalledWith(testOrder.payment);
  
  // Verify result
  expect(result.success).toBe(true);
});
```

#### Mock Database with Test Doubles

```typescript
// Create a mock database module
jest.mock('../db/connection', () => ({
  db: {
    query: jest.fn(),
    execute: jest.fn()
  }
}));

// Import the mocked module
import { db } from '../db/connection';

// Now configure the mock for your test
(db.query as jest.Mock).mockResolvedValue([{ id: 1, name: 'Test Product' }]);
```

## Database Testing

### Test Database Setup

For integration tests involving the database, use:

1. A separate test database
2. Transactions that roll back after each test
3. Proper test data seeding

```typescript
// Setting up transaction for test
beforeEach(async () => {
  // Start transaction
  await db.execute(sql`BEGIN`);
});

afterEach(async () => {
  // Roll back transaction
  await db.execute(sql`ROLLBACK`);
});
```

### Database Fixtures

Create reusable fixtures for common test data:

```typescript
// Product fixture
export async function createTestProduct(overrides = {}) {
  const defaultProduct = {
    name: 'Test Product',
    description: 'A product for testing',
    price: 9.99,
    sku: `TEST-${Date.now()}`,
    isActive: true
  };
  
  const productData = { ...defaultProduct, ...overrides };
  
  const result = await insertOne(db, products, productData);
  return result;
}
```

## Validation and Error Handling

### Testing Input Validation

```typescript
it('should validate product input', async () => {
  const invalidProduct = {
    name: '', // Empty name should fail validation
    price: -10 // Negative price should fail validation
  };
  
  await expect(productService.createProduct(invalidProduct))
    .rejects
    .toThrow(/validation/i);
});
```

### Testing Error Scenarios

Always test both happy paths and error cases:

```typescript
describe('UserService.getUser', () => {
  it('should return user when found', async () => {
    // Happy path test
  });
  
  it('should throw NotFoundError when user does not exist', async () => {
    // Error case test
  });
  
  it('should handle database errors gracefully', async () => {
    // Mock database to throw error
    (db.query as jest.Mock).mockRejectedValue(new Error('DB connection lost'));
    
    // Expect service to handle error properly
    await expect(userService.getUser('123'))
      .rejects
      .toThrow('Unable to retrieve user');
  });
});
```

## Test Coverage Requirements

- Minimum coverage: 80% for all services, utilities, and API routes
- Critical business logic: 90%+ coverage
- Error handling paths must be tested

Check coverage with:

```bash
npm run test -- --coverage
```

## CI/CD Integration

Our tests run automatically in CI/CD pipeline:

1. **Pull Request**: Unit and integration tests
2. **Merge to Main**: All tests including E2E
3. **Pre-Deploy**: Schema validation and security checks

Tests must pass for deployments to proceed.

## Using SQL Helpers in Tests

When testing database operations, use our SQL helpers for type safety and security:

```typescript
import { findById, insertOne, withDbTryCatch } from '../../db/sqlHelpers';
import { products } from '../../db/schema';

it('should retrieve product by ID', async () => {
  // Insert test data using helpers
  const testProduct = await insertOne(db, products, {
    name: 'Test Product',
    price: 9.99
  });
  
  // Use helpers to query
  const result = await findById(db, products, testProduct.id);
  
  expect(result).toEqual(testProduct);
});
```

## Test-Driven Development

Consider using TDD for complex features:

1. Write a failing test for the required behavior
2. Implement the minimum code to make the test pass
3. Refactor while keeping tests green

This approach helps ensure code is testable and meets requirements.

---

Remember that tests are an investment in code quality and maintainability. Take the time to write good tests, and they will save you time in the long run by preventing bugs and making refactoring safer.
