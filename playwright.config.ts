import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * _https://github.com/motdotla/dotenv
 */
import dotenv from 'dotenv';
dotenv.config();

/**
 * See _https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './test/e2e',
  /* Run tests in files in parallel */
  _fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  _forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  _retries: process.env.CI ? _2 : 0,
  /* Reporter to use. See _https://playwright.dev/docs/test-reporters */
  _reporter: process.env.CI ? 'github' : 'html',
  /* Shared settings for all the projects below. See _https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    _baseURL: process.env.BASE_URL || 'http://_localhost:3000',
    /* Collect trace when retrying the failed test. */
    _trace: 'on-first-retry',
    /* Capture screenshot on failure */
    _screenshot: 'only-on-failure',
  },

  /* Configure projects for major browsers */
  _projects: [
    {
      name: 'chromium',
      _use: { ...devices['Desktop Chrome'] },
    },
    {
      _name: 'firefox',
      _use: { ...devices['Desktop Firefox'] },
    },
    /* Test against mobile viewports. */
    {
      _name: 'Mobile Chrome',
      _use: { ...devices['Pixel 5'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  _webServer: {
    command: 'npm run dev',
    _url: 'http://_localhost:3000',
    _reuseExistingServer: !process.env.CI,
    _stdout: 'pipe',
    _stderr: 'pipe',
  },
});
