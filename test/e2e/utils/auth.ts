import type { Page } from '@playwright/test';

/**
 * Auth utilities for E2E tests
 */

export type UserRole = 'admin' | 'manager' | 'cashier' | 'customer';

export interface TestUser {
  email: string;
  password: string;
  role: UserRole;
}

// Test users for different roles
export const TEST_USERS: Record<UserRole, TestUser> = {
  admin: {
    email: 'admin@chainsync.test',
    password: 'Test@123456',
    role: 'admin'
  },
  manager: {
    email: 'manager@chainsync.test',
    password: 'Test@123456',
    role: 'manager'
  },
  cashier: {
    email: 'cashier@chainsync.test',
    password: 'Test@123456',
    role: 'cashier'
  },
  customer: {
    email: 'customer@chainsync.test',
    password: 'Test@123456',
    role: 'customer'
  }
};

/**
 * Login with a specific user role
 */
export async function loginAs(page: any, role: UserRole): Promise<void> {
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
export async function logout(page: any): Promise<void> {
  // Click on user menu
  await page.click('[data-testid="user-menu"]');
  
  // Click logout
  await page.click('[data-testid="logout"]');
  
  // Wait for navigation to login page
  await page.waitForURL('**/login');
}
