#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load production environment variables
function loadProductionEnv() {
  const envPath = path.join(__dirname, '..', 'deploy', 'config', 'production.env');
  
  if (!fs.existsSync(envPath)) {
    console.error('Production environment file not found:', envPath);
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');

  lines.forEach(line => {
    line = line.trim();
    
    // Skip comments and empty lines
    if (line.startsWith('#') || line === '') {
      return;
    }

    // Parse environment variable
    const equalIndex = line.indexOf('=');
    if (equalIndex > 0) {
      const key = line.substring(0, equalIndex);
      const value = line.substring(equalIndex + 1);
      
      // Remove quotes if present
      const cleanValue = value.replace(/^["']|["']$/g, '');
      
      process.env[key] = cleanValue;
    }
  });

  console.log('Production environment variables loaded successfully');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
  console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Not set');
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { loadProductionEnv };
}

// Run if called directly
if (require.main === module) {
  loadProductionEnv();
} 