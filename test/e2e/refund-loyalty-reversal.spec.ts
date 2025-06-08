import { test, expect } from '@playwright/test';
import { loginAs } from './utils/auth';
import {
  createTransaction,
  refundTransaction,
  getLoyaltyPointsForTransaction,
  getTransactionStatus,
} from './utils/transactions';

/**
 * E2E Tests for refund and loyalty reversal flow
 *
 * These tests verify the complete refund process and ensure that
 * loyalty points are properly reversed when a transaction is refunded.
 */

test.describe('Refund and Loyalty Reversal Flow', () => {
  // Store the transaction ID for verification
  let transactionId: string;
  let initialLoyaltyPoints: number;

  // Setup: Create a transaction that we'll refund
  test.beforeEach(async ({ page }) => {
    // Login as a cashier
    await loginAs(page, 'cashier');

    // Create a transaction for a customer with loyalty enabled
    transactionId = await createTransaction(page, {
      customerEmail: 'loyalty@test.com',
      amount: 1000, // $10.00
      paymentMethod: 'card',
      notes: 'E2E test purchase for refund',
    });

    // Verify transaction was created
    expect(transactionId).toBeTruthy();

    // Get initial loyalty points from this transaction
    initialLoyaltyPoints = await getLoyaltyPointsForTransaction(page, transactionId);

    // Verify initial points were accrued
    expect(initialLoyaltyPoints).toBeGreaterThan(0);
  });

  // Test full refund with loyalty reversal
  test('should process a full refund and reverse loyalty points', async ({ page }) => {
    // Login as a manager (assuming only managers can process refunds)
    await loginAs(page, 'manager');

    // Process a full refund
    await refundTransaction(page, transactionId, true);

    // Verify transaction status is "Refunded"
    const status = await getTransactionStatus(page, transactionId);
    expect(status).toContain('Refunded');

    // Verify loyalty points were reversed (should be zero)
    const loyaltyPoints = await getLoyaltyPointsForTransaction(page, transactionId);
    expect(loyaltyPoints).toEqual(0);

    // Navigate to customer loyalty history
    await page.goto('/customers');
    await page.fill('[data-testid="customer-search"]', 'loyalty@test.com');
    await page.click('[data-testid="customer-view"]:first-child');
    await page.click('[data-testid="loyalty-history-tab"]');

    // Verify a reversal entry exists in the loyalty history
    const historyText = await page.locator('[data-testid="loyalty-history-list"]').textContent();
    expect(historyText).toContain('Reversal');
    expect(historyText).toContain(transactionId);
  });

  // Test partial refund with partial loyalty reversal
  test('should process a partial refund and partially reverse loyalty points', async ({ page }) => {
    // Login as a manager
    await loginAs(page, 'manager');

    // Calculate a partial refund amount (50% of original)
    const refundAmount = 500; // $5.00

    // Process a partial refund
    await refundTransaction(page, transactionId, false, refundAmount);

    // Verify transaction status is "Partially Refunded"
    const status = await getTransactionStatus(page, transactionId);
    expect(status).toContain('Partially Refunded');

    // Verify loyalty points were partially reversed (should be half of initial)
    const loyaltyPoints = await getLoyaltyPointsForTransaction(page, transactionId);
    expect(loyaltyPoints).toEqual(initialLoyaltyPoints / 2);

    // Navigate to customer loyalty history
    await page.goto('/customers');
    await page.fill('[data-testid="customer-search"]', 'loyalty@test.com');
    await page.click('[data-testid="customer-view"]:first-child');
    await page.click('[data-testid="loyalty-history-tab"]');

    // Verify a partial reversal entry exists in the loyalty history
    const historyText = await page.locator('[data-testid="loyalty-history-list"]').textContent();
    expect(historyText).toContain('Partial Reversal');
    expect(historyText).toContain(transactionId);
  });

  // Test that cashiers cannot process refunds (access control)
  test('should not allow cashiers to process refunds', async ({ page }) => {
    // Login as a cashier
    await loginAs(page, 'cashier');

    // Navigate to transaction details
    await page.goto(`/transactions/${transactionId}`);

    // Verify refund button is either not visible or disabled
    const refundButtonVisible = await page.isVisible('[data-testid="refund-transaction"]');

    if (refundButtonVisible) {
      // If visible, it should be disabled
      const isDisabled = await page.getAttribute('[data-testid="refund-transaction"]', 'disabled');
      expect(isDisabled).not.toBeNull();
    } else {
      // If not visible, test passes
      expect(refundButtonVisible).toBeFalsy();
    }
  });
});
