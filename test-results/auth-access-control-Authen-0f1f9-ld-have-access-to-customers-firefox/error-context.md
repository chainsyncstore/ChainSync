# Test info

- Name: Authentication and Access Control >> Access Control >> admin should have access to /customers
- Location: C:\Users\USER\Downloads\ChainSync Directory\ChainSyncManager\test\e2e\auth-access-control.spec.ts:78:9

# Error details

```
Error: page.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('input[name="email"]')

    at loginAs (C:\Users\USER\Downloads\ChainSync Directory\ChainSyncManager\test\e2e\utils\auth.ts:49:14)
    at C:\Users\USER\Downloads\ChainSync Directory\ChainSyncManager\test\e2e\auth-access-control.spec.ts:80:11
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
   1 | import { Page } from '@playwright/test';
   2 |
   3 | /**
   4 |  * Auth utilities for E2E tests
   5 |  */
   6 |
   7 | export type UserRole = 'admin' | 'manager' | 'cashier' | 'customer';
   8 |
   9 | export interface TestUser {
  10 |   email: string;
  11 |   password: string;
  12 |   role: UserRole;
  13 | }
  14 |
  15 | // Test users for different roles
  16 | export const TEST_USERS: Record<UserRole, TestUser> = {
  17 |   admin: {
  18 |     email: 'admin@chainsync.test',
  19 |     password: 'Test@123456',
  20 |     role: 'admin'
  21 |   },
  22 |   manager: {
  23 |     email: 'manager@chainsync.test',
  24 |     password: 'Test@123456',
  25 |     role: 'manager'
  26 |   },
  27 |   cashier: {
  28 |     email: 'cashier@chainsync.test',
  29 |     password: 'Test@123456',
  30 |     role: 'cashier'
  31 |   },
  32 |   customer: {
  33 |     email: 'customer@chainsync.test',
  34 |     password: 'Test@123456',
  35 |     role: 'customer'
  36 |   }
  37 | };
  38 |
  39 | /**
  40 |  * Login with a specific user role
  41 |  */
  42 | export async function loginAs(page: Page, role: UserRole): Promise<void> {
  43 |   const user = TEST_USERS[role];
  44 |   
  45 |   await page.goto('/login');
  46 |   await page.waitForLoadState('networkidle');
  47 |   
  48 |   // Fill the login form
> 49 |   await page.fill('input[name="email"]', user.email);
     |              ^ Error: page.fill: Test timeout of 30000ms exceeded.
  50 |   await page.fill('input[name="password"]', user.password);
  51 |   
  52 |   // Click login button
  53 |   await page.click('button[type="submit"]');
  54 |   
  55 |   // Wait for navigation to complete
  56 |   await page.waitForURL('**/dashboard');
  57 | }
  58 |
  59 | /**
  60 |  * Logout the current user
  61 |  */
  62 | export async function logout(page: Page): Promise<void> {
  63 |   // Click on user menu
  64 |   await page.click('[data-testid="user-menu"]');
  65 |   
  66 |   // Click logout
  67 |   await page.click('[data-testid="logout"]');
  68 |   
  69 |   // Wait for navigation to login page
  70 |   await page.waitForURL('**/login');
  71 | }
  72 |
```