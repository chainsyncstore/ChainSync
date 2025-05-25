# ChainSync E2E Testing

This directory contains end-to-end tests for the ChainSync system using Playwright.

## Test Structure

- `utils/` - Helper functions and utilities for tests
- `*.spec.ts` - Test specs organized by feature/flow

## Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui

# Run with debugging
npm run test:e2e:debug

# View test report
npm run test:e2e:report
```

## Test Data Requirements

For these tests to run successfully, the following test data should exist in the system:

1. User accounts with the following roles:
   - `admin@chainsync.test` (Admin role)
   - `manager@chainsync.test` (Manager role)
   - `cashier@chainsync.test` (Cashier role)
   - `customer@chainsync.test` (Customer role)

2. Customers:
   - `loyalty@test.com` - A customer with loyalty enabled
   - `no-loyalty@test.com` - A customer with loyalty disabled

## CI Integration

These tests are configured to run in CI environments. The Playwright configuration automatically detects CI environments and adjusts settings accordingly (retries, reporter, etc.).

## Test Coverage

Current E2E test coverage includes:

- **Purchase + Loyalty Accrual Flow**
  - Transaction creation
  - Loyalty point accrual verification
  - Loyalty calculation validation
  - Loyalty history

- **Refund + Loyalty Reversal Flow**
  - Full refund with loyalty reversal
  - Partial refund with partial loyalty reversal
  - Access control for refund operations

- **Authentication and Access Control**
  - Login/logout flows
  - Role-based access to pages
  - Role-based access to actions
