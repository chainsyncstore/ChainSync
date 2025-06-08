import { test, expect } from '@playwright/test';
import { loginAs, logout, TEST_USERS, UserRole } from './utils/auth';

/**
 * E2E Tests for authentication and access control
 *
 * These tests verify that authentication works properly and that
 * different user roles have appropriate access to different parts of the system.
 */

test.describe('Authentication and Access Control', () => {
  // Test successful login for each role
  test.describe('Authentication', () => {
    for (const role of Object.keys(TEST_USERS) as UserRole[]) {
      test(`should allow login as ${role}`, async ({ page }) => {
        await loginAs(page, role);

        // Verify dashboard is loaded
        await expect(page).toHaveURL(/.*dashboard.*/);

        // Verify role-specific elements are visible
        const roleIndicator = await page.locator('[data-testid="user-role"]').textContent();
        expect(roleIndicator?.toLowerCase()).toContain(role);
      });
    }

    test('should reject login with invalid credentials', async ({ page }) => {
      await page.goto('/login');

      // Fill the login form with invalid credentials
      await page.fill('input[name="email"]', 'invalid@example.com');
      await page.fill('input[name="password"]', 'wrongpassword');

      // Click login button
      await page.click('button[type="submit"]');

      // Verify error message appears
      const errorMessage = await page.locator('[data-testid="login-error"]').textContent();
      expect(errorMessage).toContain('Invalid email or password');

      // Verify we remain on login page
      await expect(page).toHaveURL(/.*login.*/);
    });

    test('should log out successfully', async ({ page }) => {
      // Login first
      await loginAs(page, 'cashier');

      // Logout
      await logout(page);

      // Verify we are on login page
      await expect(page).toHaveURL(/.*login.*/);

      // Verify protected route redirects back to login
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/.*login.*/);
    });
  });

  // Test access control for different pages based on roles
  test.describe('Access Control', () => {
    // Pages that should be accessible by specific roles
    const accessControlMap = {
      '/dashboard': ['admin', 'manager', 'cashier'],
      '/reports': ['admin', 'manager'],
      '/customers': ['admin', 'manager', 'cashier'],
      '/inventory': ['admin', 'manager', 'cashier'],
      '/transactions': ['admin', 'manager', 'cashier'],
      '/settings': ['admin'],
      '/users': ['admin'],
    };

    for (const [page, allowedRoles] of Object.entries(accessControlMap)) {
      for (const role of Object.keys(TEST_USERS) as UserRole[]) {
        const shouldHaveAccess = allowedRoles.includes(role);

        test(`${role} ${shouldHaveAccess ? 'should' : 'should not'} have access to ${page}`, async ({
          page: browserPage,
        }) => {
          // Login as the specific role
          await loginAs(browserPage, role);

          // Navigate to the page
          await browserPage.goto(page);

          if (shouldHaveAccess) {
            // Verify access is granted
            await expect(browserPage).toHaveURL(new RegExp(`.*${page.replace('/', '')}`));
            // Verify page content is loaded
            await expect(browserPage.locator('h1')).toBeVisible();
          } else {
            // Verify access is denied - either redirected or shown access denied
            const currentUrl = browserPage.url();
            const accessDenied = await browserPage
              .locator('[data-testid="access-denied"]')
              .isVisible();

            expect(currentUrl.includes(page.replace('/', '')) && !accessDenied).toBeFalsy();
          }
        });
      }
    }

    // Test specific action access (e.g., creating/editing/deleting resources)
    test('only admin should be able to create new users', async ({ page }) => {
      // Login as admin
      await loginAs(page, 'admin');

      // Navigate to users page
      await page.goto('/users');

      // Verify create button is visible
      await expect(page.locator('[data-testid="create-user"]')).toBeVisible();

      // Logout and login as manager
      await logout(page);
      await loginAs(page, 'manager');

      // Navigate to users page
      await page.goto('/users');

      // Verify either redirected or create button not visible
      const createButton = page.locator('[data-testid="create-user"]');
      const isVisible = await createButton.isVisible().catch(() => false);
      expect(isVisible).toBeFalsy();
    });

    test('only manager or admin should be able to view sales reports', async ({ page }) => {
      // Login as manager
      await loginAs(page, 'manager');

      // Navigate to reports page
      await page.goto('/reports');

      // Verify reports are visible
      await expect(page.locator('[data-testid="sales-report"]')).toBeVisible();

      // Logout and login as cashier
      await logout(page);
      await loginAs(page, 'cashier');

      // Try to navigate to reports page
      await page.goto('/reports');

      // Verify either redirected or reports not visible
      const reportsSection = page.locator('[data-testid="sales-report"]');
      const isVisible = await reportsSection.isVisible().catch(() => false);
      expect(isVisible).toBeFalsy();
    });
  });
});
