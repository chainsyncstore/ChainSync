import { initializeGlobals } from '@shared/db/types';

interface InitializationResult {
  success: boolean;
  error?: Error;
}

/**
 * Initialize the application by setting up global references and required services
 * @returns Promise that resolves with the initialization result
 */
export async function initializeApp(): Promise<InitializationResult> {
  try {
    // Initialize global database references
    await initializeGlobals();

    // Add any other initialization logic here
    // For example:
    // - Initialize authentication
    // - Load user preferences
    // - Fetch initial data

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred during initialization';

    console.error('Initialization error:', error);

    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

export default initializeApp;
