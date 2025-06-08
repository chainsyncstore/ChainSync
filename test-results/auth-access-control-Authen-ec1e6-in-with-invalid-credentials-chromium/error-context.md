# Test info

- Name: Authentication and Access Control >> Authentication >> should reject login with invalid credentials
- Location: C:\Users\USER\Downloads\ChainSync Directory\ChainSyncManager\test\e2e\auth-access-control.spec.ts:27:5

# Error details

```
Error: page.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('input[name="email"]')

    at C:\Users\USER\Downloads\ChainSync Directory\ChainSyncManager\test\e2e\auth-access-control.spec.ts:31:18
```

# Page snapshot

```yaml
- img
- heading "Application Initialization Failed" [level=1]
- paragraph: We're sorry, but the application failed to initialize.
- img
- paragraph: global is not defined
- group: View technical details
- button "Reload Application"
- paragraph: If the problem persists, please contact support.
```

# Test source

```ts
   1 | import { test, expect } from '@playwright/test';
   2 | import { loginAs, logout, TEST_USERS, UserRole } from './utils/auth';
   3 |
   4 | /**
   5 |  * E2E Tests for authentication and access control
   6 |  *
   7 |  * These tests verify that authentication works properly and that
   8 |  * different user roles have appropriate access to different parts of the system.
   9 |  */
   10 |
   11 | test.describe('Authentication and Access Control', () => {
   12 |   // Test successful login for each role
   13 |   test.describe('Authentication', () => {
   14 |     for (const role of Object.keys(TEST_USERS) as UserRole[]) {
   15 |       test(`should allow login as ${role}`, async ({ page }) => {
   16 |         await loginAs(page, role);
   17 |
   18 |         // Verify dashboard is loaded
   19 |         await expect(page).toHaveURL(/.*dashboard.*/);
   20 |
   21 |         // Verify role-specific elements are visible
   22 |         const roleIndicator = await page.locator('[data-testid="user-role"]').textContent();
   23 |         expect(roleIndicator?.toLowerCase()).toContain(role);
   24 |       });
   25 |     }
   26 |
   27 |     test('should reject login with invalid credentials', async ({ page }) => {
   28 |       await page.goto('/login');
   29 |
   30 |       // Fill the login form with invalid credentials
>  31 |       await page.fill('input[name="email"]', 'invalid@example.com');
      |                  ^ Error: page.fill: Test timeout of 30000ms exceeded.
   32 |       await page.fill('input[name="password"]', 'wrongpassword');
   33 |
   34 |       // Click login button
   35 |       await page.click('button[type="submit"]');
   36 |
   37 |       // Verify error message appears
   38 |       const errorMessage = await page.locator('[data-testid="login-error"]').textContent();
   39 |       expect(errorMessage).toContain('Invalid email or password');
   40 |
   41 |       // Verify we remain on login page
   42 |       await expect(page).toHaveURL(/.*login.*/);
   43 |     });
   44 |
   45 |     test('should log out successfully', async ({ page }) => {
   46 |       // Login first
   47 |       await loginAs(page, 'cashier');
   48 |
   49 |       // Logout
   50 |       await logout(page);
   51 |
   52 |       // Verify we are on login page
   53 |       await expect(page).toHaveURL(/.*login.*/);
   54 |
   55 |       // Verify protected route redirects back to login
   56 |       await page.goto('/dashboard');
   57 |       await expect(page).toHaveURL(/.*login.*/);
   58 |     });
   59 |   });
   60 |
   61 |   // Test access control for different pages based on roles
   62 |   test.describe('Access Control', () => {
   63 |     // Pages that should be accessible by specific roles
   64 |     const accessControlMap = {
   65 |       '/dashboard': ['admin', 'manager', 'cashier'],
   66 |       '/reports': ['admin', 'manager'],
   67 |       '/customers': ['admin', 'manager', 'cashier'],
   68 |       '/inventory': ['admin', 'manager', 'cashier'],
   69 |       '/transactions': ['admin', 'manager', 'cashier'],
   70 |       '/settings': ['admin'],
   71 |       '/users': ['admin'],
   72 |     };
   73 |
   74 |     for (const [page, allowedRoles] of Object.entries(accessControlMap)) {
   75 |       for (const role of Object.keys(TEST_USERS) as UserRole[]) {
   76 |         const shouldHaveAccess = allowedRoles.includes(role);
   77 |
   78 |         test(`${role} ${shouldHaveAccess ? 'should' : 'should not'} have access to ${page}`, async ({ page: browserPage }) => {
   79 |           // Login as the specific role
   80 |           await loginAs(browserPage, role);
   81 |
   82 |           // Navigate to the page
   83 |           await browserPage.goto(page);
   84 |
   85 |           if (shouldHaveAccess) {
   86 |             // Verify access is granted
   87 |             await expect(browserPage).toHaveURL(new RegExp(`.*${page.replace('/', '')}`));
   88 |             // Verify page content is loaded
   89 |             await expect(browserPage.locator('h1')).toBeVisible();
   90 |           } else {
   91 |             // Verify access is denied - either redirected or shown access denied
   92 |             const currentUrl = browserPage.url();
   93 |             const accessDenied = await browserPage.locator('[data-testid="access-denied"]').isVisible();
   94 |
   95 |             expect(currentUrl.includes(page.replace('/', '')) && !accessDenied).toBeFalsy();
   96 |           }
   97 |         });
   98 |       }
   99 |     }
  100 |
  101 |     // Test specific action access (e.g., creating/editing/deleting resources)
  102 |     test('only admin should be able to create new users', async ({ page }) => {
  103 |       // Login as admin
  104 |       await loginAs(page, 'admin');
  105 |
  106 |       // Navigate to users page
  107 |       await page.goto('/users');
  108 |
  109 |       // Verify create button is visible
  110 |       await expect(page.locator('[data-testid="create-user"]')).toBeVisible();
  111 |
  112 |       // Logout and login as manager
  113 |       await logout(page);
  114 |       await loginAs(page, 'manager');
  115 |
  116 |       // Navigate to users page
  117 |       await page.goto('/users');
  118 |
  119 |       // Verify either redirected or create button not visible
  120 |       const createButton = page.locator('[data-testid="create-user"]');
  121 |       const isVisible = await createButton.isVisible().catch(() => false);
  122 |       expect(isVisible).toBeFalsy();
  123 |     });
  124 |
  125 |     test('only manager or admin should be able to view sales reports', async ({ page }) => {
  126 |       // Login as manager
  127 |       await loginAs(page, 'manager');
  128 |
  129 |       // Navigate to reports page
  130 |       await page.goto('/reports');
  131 |
```
