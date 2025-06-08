// server-entry.js - Fallback entry point for Render deployment
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check if the compiled server file exists
const serverIndexPath = join(__dirname, 'dist', 'server', 'index.js');

console.log('Current directory:', __dirname);
console.log('Looking for server file at:', serverIndexPath);

// Check if the expected server entry point exists
try {
  if (fs.existsSync(serverIndexPath)) {
    console.log('✅ Found server entry point. Starting application...');
    // Import and run the compiled server
    import('./dist/server/index.js')
      .then(() => {
        console.log('Server started successfully');
      })
      .catch(err => {
        console.error('Error starting server from compiled entry point:', err);
        // If import fails, try to run with direct ts-node
        tryDirectStart();
      });
  } else {
    console.warn('⚠️ Could not find compiled server entry point');
    tryDirectStart();
  }
} catch (error) {
  console.error('Error checking for server entry point:', error);
  tryDirectStart();
}

// Fallback to running with ts-node directly if compiled version isn't available
function tryDirectStart() {
  console.log('Attempting to start server directly with ts-node...');

  const serverSourcePath = join(__dirname, 'server', 'index.ts');

  if (fs.existsSync(serverSourcePath)) {
    console.log('✅ Found source server entry point:', serverSourcePath);

    try {
      // Use dynamic import with ts-node
      import('ts-node/register')
        .then(() => {
          console.log('ts-node registered successfully');
          return import('./server/index.ts');
        })
        .then(() => {
          console.log('Server started successfully using ts-node');
        })
        .catch(err => {
          console.error('Failed to start server with ts-node:', err);
          process.exit(1);
        });
    } catch (error) {
      console.error('Critical error starting server:', error);
      process.exit(1);
    }
  } else {
    console.error('❌ Could not find server source entry point either. Cannot start server.');
    process.exit(1);
  }
}
