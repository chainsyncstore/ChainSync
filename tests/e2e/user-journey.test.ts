import { test, expect } from '@playwright/test';
import { setupTestDatabase, teardownTestDatabase } from '../setup/e2e-setup';

test.describe('User Journey E2E Tests', () => {
  let _testDb: any;

  test.beforeAll(async() => {
    testDb = await setupTestDatabase();
  });

  test.afterAll(async() => {
    await teardownTestDatabase(testDb);
  });

  test('Complete customer purchase journey', async({ page }) => {
    // 1. User registration
    await page.goto('/register');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'TestPassword123!');
    await page.fill('[data-testid="name"]', 'Test User');
    await page.fill('[data-testid="phone"]', '+1234567890');
    await page.click('[data-testid="register-button"]');

    // Verify registration success
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="welcome-message"]')).toContainText('Test User');

    // 2. Browse products
    await page.goto('/products');
    await expect(page.locator('[data-testid="product-grid"]')).toBeVisible();

    // 3. Add items to cart
    const firstProduct = page.locator('[data-testid="product-card"]').first();
    await firstProduct.locator('[data-testid="add-to-cart"]').click();

    // Verify item added to cart
    await expect(page.locator('[data-testid="cart-count"]')).toHaveText('1');

    // 4. View cart
    await page.click('[data-testid="cart-icon"]');
    await expect(page.locator('[data-testid="cart-items"]')).toBeVisible();
    await expect(page.locator('[data-testid="cart-total"]')).toBeVisible();

    // 5. Proceed to checkout
    await page.click('[data-testid="checkout-button"]');
    await expect(page).toHaveURL('/checkout');

    // 6. Fill shipping information
    await page.fill('[data-testid="shipping-name"]', 'Test User');
    await page.fill('[data-testid="shipping-address"]', '123 Test St');
    await page.fill('[data-testid="shipping-city"]', 'Test City');
    await page.fill('[data-testid="shipping-state"]', 'Test State');
    await page.fill('[data-testid="shipping-zip"]', '12345');

    // 7. Fill payment information
    await page.fill('[data-testid="card-number"]', '4242424242424242');
    await page.fill('[data-testid="card-expiry"]', '12/25');
    await page.fill('[data-testid="card-cvv"]', '123');

    // 8. Complete purchase
    await page.click('[data-testid="place-order-button"]');

    // 9. Verify order confirmation
    await expect(page).toHaveURL(/\/order-confirmation/);
    await expect(page.locator('[data-testid="order-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="order-number"]')).toBeVisible();

    // 10. View order history
    await page.goto('/orders');
    await expect(page.locator('[data-testid="order-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="order-item"]')).toHaveCount(1);
  });

  test('Inventory management journey', async({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'admin@example.com');
    await page.fill('[data-testid="password"]', 'AdminPassword123!');
    await page.click('[data-testid="login-button"]');

    await expect(page).toHaveURL('/admin/dashboard');

    // 1. View inventory
    await page.goto('/admin/inventory');
    await expect(page.locator('[data-testid="inventory-table"]')).toBeVisible();

    // 2. Add new product
    await page.click('[data-testid="add-product-button"]');
    await page.fill('[data-testid="product-name"]', 'Test Product');
    await page.fill('[data-testid="product-sku"]', 'TEST-001');
    await page.fill('[data-testid="product-price"]', '29.99');
    await page.fill('[data-testid="product-quantity"]', '100');
    await page.selectOption('[data-testid="product-category"]', 'electronics');
    await page.click('[data-testid="save-product-button"]');

    // Verify product added
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Product added successfully');

    // 3. Update inventory
    const productRow = page.locator('[data-testid="product-row"]').filter({ _hasText: 'Test Product' });
    await productRow.locator('[data-testid="edit-button"]').click();
    await page.fill('[data-testid="product-quantity"]', '95');
    await page.click('[data-testid="save-button"]');

    // Verify update
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Product updated successfully');

    // 4. Import inventory
    await page.click('[data-testid="import-button"]');
    await page.setInputFiles('[data-testid="file-input"]', 'test-data/inventory-import.csv');
    await page.click('[data-testid="upload-button"]');

    // Verify import
    await expect(page.locator('[data-testid="import-results"]')).toBeVisible();
  });

  test('Analytics and reporting journey', async({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'admin@example.com');
    await page.fill('[data-testid="password"]', 'AdminPassword123!');
    await page.click('[data-testid="login-button"]');

    // 1. View dashboard analytics
    await page.goto('/admin/analytics');
    await expect(page.locator('[data-testid="sales-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="revenue-metric"]')).toBeVisible();
    await expect(page.locator('[data-testid="orders-metric"]')).toBeVisible();

    // 2. Generate sales report
    await page.click('[data-testid="generate-report-button"]');
    await page.selectOption('[data-testid="report-type"]', 'sales');
    await page.fill('[data-testid="start-date"]', '2024-01-01');
    await page.fill('[data-testid="end-date"]', '2024-12-31');
    await page.click('[data-testid="generate-button"]');

    // Verify report generation
    await expect(page.locator('[data-testid="report-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="download-report"]')).toBeVisible();

    // 3. View inventory analytics
    await page.click('[data-testid="inventory-tab"]');
    await expect(page.locator('[data-testid="inventory-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="low-stock-alert"]')).toBeVisible();

    // 4. Export data
    await page.click('[data-testid="export-button"]');
    await page.selectOption('[data-testid="export-format"]', 'csv');
    await page.click('[data-testid="export-data-button"]');

    // Verify download
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="download-link"]');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
  });

  test('Customer support journey', async({ page }) => {
    // Login as customer
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'customer@example.com');
    await page.fill('[data-testid="password"]', 'CustomerPassword123!');
    await page.click('[data-testid="login-button"]');

    // 1. Create support ticket
    await page.goto('/support');
    await page.click('[data-testid="new-ticket-button"]');
    await page.selectOption('[data-testid="ticket-category"]', 'order-issue');
    await page.fill('[data-testid="ticket-subject"]', 'Order not received');
    await page.fill('[data-testid="ticket-description"]', 'I placed an order but haven\'t received it yet.');
    await page.click('[data-testid="submit-ticket-button"]');

    // Verify ticket created
    await expect(page.locator('[data-testid="ticket-created"]')).toBeVisible();
    const ticketNumber = await page.locator('[data-testid="ticket-number"]').textContent();

    // 2. View ticket status
    await page.goto('/support/tickets');
    await expect(page.locator('[data-testid="ticket-list"]')).toBeVisible();
    await expect(page.locator(`[data-testid="ticket-${ticketNumber}"]`)).toBeVisible();

    // 3. Add comment to ticket
    await page.click(`[data-testid="ticket-${ticketNumber}"]`);
    await page.fill('[data-testid="comment-input"]', 'Please provide tracking information.');
    await page.click('[data-testid="add-comment-button"]');

    // Verify comment added
    await expect(page.locator('[data-testid="comment-list"]')).toContainText('Please provide tracking information.');
  });

  test('Mobile responsive journey', async({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ _width: 375, _height: 667 });

    // 1. Mobile navigation
    await page.goto('/');
    await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
    await page.click('[data-testid="mobile-menu-button"]');
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();

    // 2. Mobile product browsing
    await page.goto('/products');
    await expect(page.locator('[data-testid="mobile-product-grid"]')).toBeVisible();

    // Test touch interactions
    await page.locator('[data-testid="product-card"]').first().tap();
    await expect(page.locator('[data-testid="product-details"]')).toBeVisible();

    // 3. Mobile checkout
    await page.goto('/checkout');
    await expect(page.locator('[data-testid="mobile-checkout-form"]')).toBeVisible();

    // Test form inputs on mobile
    await page.fill('[data-testid="mobile-email"]', 'mobile@example.com');
    await page.fill('[data-testid="mobile-card-number"]', '4242424242424242');

    // Test mobile keyboard
    await page.locator('[data-testid="mobile-card-expiry"]').tap();
    await page.keyboard.type('12/25');
  });

  test('Offline functionality journey', async({ page }) => {
    // 1. Enable offline mode
    await page.goto('/');
    await page.evaluate(() => {
      // Simulate offline mode
      Object.defineProperty(navigator, 'onLine', {
        _writable: true,
        _value: false
      });
      window.dispatchEvent(new Event('offline'));
    });

    // 2. Verify offline indicator
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();

    // 3. Test offline cart functionality
    await page.goto('/products');
    await page.locator('[data-testid="add-to-cart"]').first().click();

    // Verify item saved to local storage
    const cartData = await page.evaluate(() => {
      return localStorage.getItem('offline-cart');
    });
    expect(cartData).toBeTruthy();

    // 4. Test offline form caching
    await page.goto('/checkout');
    await page.fill('[data-testid="customer-name"]', 'Offline User');
    await page.fill('[data-testid="customer-email"]', 'offline@example.com');

    // Navigate away and back
    await page.goto('/products');
    await page.goto('/checkout');

    // Verify form data persisted
    await expect(page.locator('[data-testid="customer-name"]')).toHaveValue('Offline User');
    await expect(page.locator('[data-testid="customer-email"]')).toHaveValue('offline@example.com');

    // 5. Test sync when back online
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'onLine', {
        _writable: true,
        _value: true
      });
      window.dispatchEvent(new Event('online'));
    });

    await expect(page.locator('[data-testid="sync-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="sync-complete"]')).toBeVisible();
  });
});
