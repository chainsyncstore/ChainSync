import { test, expect } from '@playwright/test';
import { loginAs, UserRole } from './utils/auth';
import { createTransaction, getLoyaltyPointsForTransaction } from './utils/transactions';

/**
 * E2E Tests for full purchase and loyalty accrual flow
 *
 * These tests verify the complete flow from login to transaction creation
 * and ensure that loyalty points are properly accrued.
 */

test.describe('Purchase and Loyalty Flow', () => {
  // Store the transaction ID for verification
  let transactionId: string;

  // Test the full purchase flow as a cashier
  test('should create a transaction and accrue loyalty points', async ({ page }) => {
    // Login as a cashier
    await loginAs(page, 'cashier');

    // Create a transaction for a customer with loyalty enabled
    transactionId = await createTransaction(page, {
      customerEmail: 'loyalty@test.com', // Assuming this customer has loyalty enabled
      amount: 500,
      paymentMethod: 'cash',
      notes: 'E2E test purchase with loyalty',
    });

    // Verify transaction was created
    expect(transactionId).toBeTruthy();

    // Navigate to transaction details
    await page.goto(`/transactions/${transactionId}`);

    // Verify transaction status
    const status = await page.locator('[data-testid="transaction-status"]').textContent();
    expect(status).toContain('Completed');

    // Verify loyalty points were accrued
    const loyaltyPoints = await getLoyaltyPointsForTransaction(page, transactionId);
    expect(loyaltyPoints).toBeGreaterThan(0);
  });

  // Test that loyalty points are correctly calculated based on purchase amount
  test('should accrue correct number of loyalty points based on transaction amount', async ({
    page,
  }) => {
    // Login as a cashier
    await loginAs(page, 'cashier');

    // Create a transaction with a specific amount
    const amount = 1000; // $10.00 for example
    transactionId = await createTransaction(page, {
      customerEmail: 'loyalty@test.com',
      amount,
      paymentMethod: 'card',
      notes: 'E2E test purchase with precise amount',
    });

    // Verify transaction was created
    expect(transactionId).toBeTruthy();

    // Get loyalty points
    const loyaltyPoints = await getLoyaltyPointsForTransaction(page, transactionId);

    // Calculate expected points (this will depend on your loyalty points formula)
    // Assuming 1 point per $1 spent as an example
    const expectedPoints = Math.floor(amount / 100);

    // Verify points match expected calculation
    expect(loyaltyPoints).toEqual(expectedPoints);
  });

  // Test that loyalty is not accrued for a customer with loyalty disabled
  test('should not accrue loyalty points for customer with loyalty disabled', async ({ page }) => {
    // Login as a cashier
    await loginAs(page, 'cashier');

    // Create a transaction for a customer with loyalty disabled
    transactionId = await createTransaction(page, {
      customerEmail: 'no-loyalty@test.com', // Assuming this customer has loyalty disabled
      amount: 500,
      paymentMethod: 'cash',
      notes: 'E2E test purchase without loyalty',
    });

    // Verify transaction was created
    expect(transactionId).toBeTruthy();

    // Navigate to transaction details
    await page.goto(`/transactions/${transactionId}`);

    // Verify transaction status
    const status = await page.locator('[data-testid="transaction-status"]').textContent();
    expect(status).toContain('Completed');

    // Verify no loyalty points were accrued
    const loyaltyPoints = await getLoyaltyPointsForTransaction(page, transactionId);
    expect(loyaltyPoints).toEqual(0);
  });

  // Test that cashiers can view loyalty history
  test('should allow viewing customer loyalty history', async ({ page }) => {
    // Login as a cashier
    await loginAs(page, 'cashier');

    // Navigate to customer details
    await page.goto('/customers');
    await page.fill('[data-testid="customer-search"]', 'loyalty@test.com');
    await page.click('[data-testid="customer-view"]:first-child');

    // Click on loyalty history tab
    await page.click('[data-testid="loyalty-history-tab"]');

    // Verify loyalty history is displayed
    const historyItems = await page.locator('[data-testid="loyalty-history-item"]').count();
    expect(historyItems).toBeGreaterThan(0);

    // Verify our test transaction is in the history
    const historyText = await page.locator('[data-testid="loyalty-history-list"]').textContent();
    expect(historyText).toContain(transactionId);
  });
});
