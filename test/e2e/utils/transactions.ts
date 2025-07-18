import { Page } from '@playwright/test';

/**
 * Transaction utility functions for E2E tests
 */

export interface TransactionData {
  customerId?: number;
  customerEmail?: string;
  amount: number;
  items?: Array<{
    id: number;
    name: string;
    quantity: number;
    price: number;
  }>;
  paymentMethod: 'cash' | 'card' | 'transfer';
  notes?: string;
}

/**
 * Create a new transaction
 */
export async function createTransaction(page: Page, data: TransactionData): Promise<string> {
  // Navigate to transactions page
  await page.goto('/transactions/new');
  await page.waitForLoadState('networkidle');

  // Select customer if provided
  if (data.customerId || data.customerEmail) {
    await page.click('[data-testid="customer-select"]');
    if (data.customerId) {
      await page.fill('[data-testid="customer-search"]', data.customerId.toString());
    } else if (data.customerEmail) {
      await page.fill('[data-testid="customer-search"]', data.customerEmail);
    }
    await page.click('[data-testid="customer-option"]:first-child');
  }

  // Add items if provided
  if (data.items && data.items.length > 0) {
    for (const item of data.items) {
      await page.click('[data-testid="add-item"]');
      await page.fill('[data-testid="item-search"]', item.name);
      await page.click(`[data-testid="item-option"][data-item-id="${item.id}"]`);
      await page.fill('[data-testid="item-quantity"]', item.quantity.toString());
      await page.click('[data-testid="add-item-confirm"]');
    }
  } else {
    // Just use amount field
    await page.fill('[data-testid="transaction-amount"]', data.amount.toString());
  }

  // Select payment method
  await page.click(`[data-testid="payment-method-${data.paymentMethod}"]`);

  // Add notes if provided
  if (data.notes) {
    await page.fill('[data-testid="transaction-notes"]', data.notes);
  }

  // Complete transaction
  await page.click('[data-testid="complete-transaction"]');
  
  // Wait for confirmation and extract transaction ID
  await page.waitForSelector('[data-testid="transaction-success"]');
  
  // Extract transaction ID from the success message or UI
  const transactionId = await page.getAttribute('[data-testid="transaction-id"]', 'data-id');
  
  return transactionId || '';
}

/**
 * Process a refund for a transaction
 */
export async function refundTransaction(page: Page, transactionId: string, fullRefund: boolean = true, amount?: number): Promise<void> {
  // Navigate to transaction details
  await page.goto(`/transactions/${transactionId}`);
  await page.waitForLoadState('networkidle');
  
  // Click refund button
  await page.click('[data-testid="refund-transaction"]');
  
  if (!fullRefund && amount) {
    // Select partial refund
    await page.click('[data-testid="partial-refund"]');
    await page.fill('[data-testid="refund-amount"]', amount.toString());
  }
  
  // Confirm refund
  await page.click('[data-testid="confirm-refund"]');
  
  // Wait for refund confirmation
  await page.waitForSelector('[data-testid="refund-success"]');
}

/**
 * Check transaction status
 */
export async function getTransactionStatus(page: Page, transactionId: string): Promise<string> {
  await page.goto(`/transactions/${transactionId}`);
  await page.waitForLoadState('networkidle');
  
  const statusElement = await page.locator('[data-testid="transaction-status"]');
  return (await statusElement.textContent()) || '';
}

/**
 * Verify loyalty points for a transaction
 */
export async function getLoyaltyPointsForTransaction(page: Page, transactionId: string): Promise<number> {
  await page.goto(`/transactions/${transactionId}`);
  await page.waitForLoadState('networkidle');
  
  const pointsElement = await page.locator('[data-testid="loyalty-points"]');
  const pointsText = await pointsElement.textContent() || '0';
  
  return parseInt(pointsText.replace(/[^0-9]/g, ''), 10);
}
