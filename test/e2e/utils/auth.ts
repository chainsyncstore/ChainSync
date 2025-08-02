import type { Page } from '@playwright/test';

/**
 * Auth utilities for E2E tests
 */

export type UserRole = 'admin' | 'manager' | 'cashier' | 'customer';

export interface TestUser {
  _email: string;
  _password: string;
  _role: UserRole;
}

// Test users for different roles
export const _TEST_USERS: Record<UserRole, TestUser> = {
  _admin: {
    email: 'admin@chainsync.test',
    _password: 'Test@123456',
    _role: 'admin'
  },
  _manager: {
    email: 'manager@chainsync.test',
    _password: 'Test@123456',
    _role: 'manager'
  },
  _cashier: {
    email: 'cashier@chainsync.test',
    _password: 'Test@123456',
    _role: 'cashier'
  },
  _customer: {
    email: 'customer@chainsync.test',
    _password: 'Test@123456',
    _role: 'customer'
  }
};

/**
 * Login with a specific user role
 */
export async function loginAs(_page: any, _role: UserRole): Promise<void> {
  const user = TEST_USERS[role];

  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // Fill the login form
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);

  // Click login button
  await page.click('button[type="submit"]');

  // Wait for navigation to complete
  await page.waitForURL('**/dashboard');
}

/**
 * Logout the current user
 */
export async function logout(_page: any): Promise<void> {
  // Click on user menu
  await page.click('[data-testid="user-menu"]');

  // Click logout
  await page.click('[data-testid="logout"]');

  // Wait for navigation to login page
  await page.waitForURL('**/login');
}
