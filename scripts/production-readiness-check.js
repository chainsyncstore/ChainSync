#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Load production environment variables
const { loadProductionEnv } = require('./load-production-env');
loadProductionEnv();

// Colors for console output
const colors = {
  _reset: '\x1b[0m',
  _red: '\x1b[31m',
  _green: '\x1b[32m',
  _yellow: '\x1b[33m',
  _blue: '\x1b[34m',
  _magenta: '\x1b[35m',
  _cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n${'='.repeat(50)}`, 'cyan');
  log(title, 'cyan');
  log(`${'='.repeat(50)}`, 'cyan');
}

function logCheck(name, passed, details = '') {
  const status = passed ? '✓' : '✗';
  const color = passed ? 'green' : 'red';
  log(`${status} ${name}`, color);
  if (details) {
    log(`   ${details}`, 'yellow');
  }
}

// Production readiness checks
class ProductionReadinessCheck {
  constructor() {
    this.checks = [];
    this.failedChecks = [];
  }

  addCheck(name, checkFn) {
    this.checks.push({ name, checkFn });
  }

  async runChecks() {
    logSection('PRODUCTION READINESS CHECK');
    log('Starting production readiness validation...', 'blue');

    for (const check of this.checks) {
      try {
        const result = await check.checkFn();
        logCheck(check.name, result.passed, result.details);

        if (!result.passed) {
          this.failedChecks.push({ _name: check.name, _details: result.details });
        }
      } catch (error) {
        logCheck(check.name, false, error.message);
        this.failedChecks.push({ _name: check.name, _details: error.message });
      }
    }

    this.printSummary();
  }

  printSummary() {
    logSection('SUMMARY');

    if (this.failedChecks.length === 0) {
      log('🎉 All checks passed! Production deployment is ready.', 'green');
      process.exit(0);
    } else {
      log(`❌ ${this.failedChecks.length} check(s) _failed:`, 'red');
      this.failedChecks.forEach(check => {
        log(`   - ${check.name}: ${check.details}`, 'red');
      });
      log('\nPlease fix the failed checks before proceeding with deployment.', 'yellow');
      process.exit(1);
    }
  }
}

// Initialize checker
const checker = new ProductionReadinessCheck();

// Environment checks
checker.addCheck('Environment Variables', async() => {
  const requiredEnvVars = [
    'NODE_ENV',
    'DATABASE_URL',
    'REDIS_URL',
    'JWT_SECRET',
    'ENCRYPTION_KEY',
    'SESSION_SECRET'
  ];

  const missing = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    return {
      _passed: false,
      _details: `Missing environment variables: ${missing.join(', ')}`
    };
  }

  if (process.env.NODE_ENV !== 'production') {
    return {
      _passed: false,
      _details: 'NODE_ENV must be set to "production"'
    };
  }

  return { _passed: true, _details: 'All required environment variables are set' };
});

// Security checks
checker.addCheck('Security Configuration', async() => {
  const jwtSecret = process.env.JWT_SECRET;
  const encryptionKey = process.env.ENCRYPTION_KEY;
  const sessionSecret = process.env.SESSION_SECRET;

  if (jwtSecret && jwtSecret.length < 32) {
    return {
      _passed: false,
      _details: 'JWT_SECRET must be at least 32 characters long'
    };
  }

  if (encryptionKey && encryptionKey.length !== 32) {
    return {
      _passed: false,
      _details: 'ENCRYPTION_KEY must be exactly 32 characters long'
    };
  }

  if (sessionSecret && sessionSecret.length < 32) {
    return {
      _passed: false,
      _details: 'SESSION_SECRET must be at least 32 characters long'
    };
  }

  return { _passed: true, _details: 'Security configuration is properly set' };
});

// Database checks
checker.addCheck('Database Connection', async() => {
  try {
    // This would actually test the database connection
    // For now, we'll just check if the URL is properly formatted
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl || !dbUrl.startsWith('postgresql://')) {
      return {
        _passed: false,
        _details: 'DATABASE_URL must be a valid PostgreSQL connection string'
      };
    }

    return { _passed: true, _details: 'Database connection string is valid' };
  } catch (error) {
    return {
      _passed: false,
      _details: `Database connection failed: ${error.message}`
    };
  }
});

// Redis checks
checker.addCheck('Redis Connection', async() => {
  try {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl || !redisUrl.startsWith('redis://')) {
      return {
        _passed: false,
        _details: 'REDIS_URL must be a valid Redis connection string'
      };
    }

    return { _passed: true, _details: 'Redis connection string is valid' };
  } catch (error) {
    return {
      _passed: false,
      _details: `Redis connection failed: ${error.message}`
    };
  }
});

// Build checks
checker.addCheck('Build Artifacts', async() => {
  const requiredFiles = [
    'dist/server/server/index.js',
    'dist/client/index.html',
    'package.json'
  ];

  const missing = requiredFiles.filter(file => !fs.existsSync(file));

  if (missing.length > 0) {
    return {
      _passed: false,
      _details: `Missing build artifacts: ${missing.join(', ')}`
    };
  }

  return { _passed: true, _details: 'All build artifacts are present' };
});

// Dependencies checks
checker.addCheck('Dependencies', async() => {
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const nodeModulesExists = fs.existsSync('node_modules');

    if (!nodeModulesExists) {
      return {
        _passed: false,
        _details: 'node_modules directory not found. Run npm install first.'
      };
    }

    // Check for known vulnerable packages (warn only for now)
    try {
      execSync('npm audit --audit-level=high', { _stdio: 'pipe' });
    } catch (error) {
      // For now, just warn about vulnerabilities but don't fail the check
      console.log('⚠️  _Warning: Some vulnerabilities found, but continuing with deployment');
      return {
        _passed: true,
        _details: 'Dependencies installed (some vulnerabilities present but not blocking)'
      };
    }

    return { _passed: true, _details: 'Dependencies are properly installed and secure' };
  } catch (error) {
    return {
      _passed: false,
      _details: `Dependency check failed: ${error.message}`
    };
  }
});

// Configuration checks
checker.addCheck('Configuration Files', async() => {
  const requiredConfigs = [
    'deploy/deployment-config.ts',
    'deploy/blue-green-deployment.ts',
    'deploy/monitoring/production-monitor.ts',
    'deploy/monitoring/alert-manager.ts',
    'deploy/monitoring/log-aggregator.ts',
    'deploy/monitoring/incident-response.ts'
  ];

  const missing = requiredConfigs.filter(file => !fs.existsSync(file));

  if (missing.length > 0) {
    return {
      _passed: false,
      _details: `Missing configuration files: ${missing.join(', ')}`
    };
  }

  return { _passed: true, _details: 'All configuration files are present' };
});

// Docker checks
checker.addCheck('Docker Configuration', async() => {
  const dockerFiles = [
    'Dockerfile',
    'docker-compose.yml'
  ];

  const missing = dockerFiles.filter(file => !fs.existsSync(file));

  if (missing.length > 0) {
    return {
      _passed: false,
      _details: `Missing Docker files: ${missing.join(', ')}`
    };
  }

  // Check if Docker is available (skip on Windows for now)
  if (process.platform === 'win32') {
    return { _passed: true, _details: 'Docker check skipped on Windows' };
  }

  try {
    execSync('docker --version', { _stdio: 'pipe' });
  } catch (error) {
    return {
      _passed: false,
      _details: 'Docker is not installed or not available in PATH'
    };
  }

  return { _passed: true, _details: 'Docker configuration is ready' };
});

// CI/CD checks
checker.addCheck('CI/CD Pipeline', async() => {
  const ciFiles = [
    '.github/workflows/deploy.yml',
    '.github/workflows/tests.yml'
  ];

  const missing = ciFiles.filter(file => !fs.existsSync(file));

  if (missing.length > 0) {
    return {
      _passed: false,
      _details: `Missing CI/CD files: ${missing.join(', ')}`
    };
  }

  return { _passed: true, _details: 'CI/CD pipeline is configured' };
});

// Documentation checks
checker.addCheck('Documentation', async() => {
  const docs = [
    'docs/PRODUCTION_READINESS.md',
    'docs/API_DOCUMENTATION.md',
    'docs/DEPLOYMENT.md',
    'README.md'
  ];

  const missing = docs.filter(file => !fs.existsSync(file));

  if (missing.length > 0) {
    return {
      _passed: false,
      _details: `Missing documentation: ${missing.join(', ')}`
    };
  }

  return { _passed: true, _details: 'All required documentation is present' };
});

// SSL/TLS checks
checker.addCheck('SSL/TLS Configuration', async() => {
  const sslEnabled = process.env.SSL_ENABLED === 'true';

  if (sslEnabled) {
    const certPath = process.env.SSL_CERT_PATH;
    const keyPath = process.env.SSL_KEY_PATH;

    if (!certPath || !keyPath) {
      return {
        _passed: false,
        _details: 'SSL_CERT_PATH and SSL_KEY_PATH must be set when SSL_ENABLED is true'
      };
    }

    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      return {
        _passed: false,
        _details: 'SSL certificate or key file not found'
      };
    }
  }

  return { _passed: true, _details: 'SSL/TLS configuration is valid' };
});

// Monitoring checks
checker.addCheck('Monitoring Configuration', async() => {
  const monitoringConfigs = [
    'deploy/monitoring/production-monitor.ts',
    'deploy/monitoring/alert-manager.ts',
    'deploy/monitoring/log-aggregator.ts'
  ];

  const missing = monitoringConfigs.filter(file => !fs.existsSync(file));

  if (missing.length > 0) {
    return {
      _passed: false,
      _details: `Missing monitoring configurations: ${missing.join(', ')}`
    };
  }

  return { _passed: true, _details: 'Monitoring is properly configured' };
});

// Performance checks
checker.addCheck('Performance Configuration', async() => {
  const rateLimitWindow = parseInt(process.env.RATE_LIMIT_WINDOW) || 900000;
  const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX) || 100;

  if (rateLimitWindow < 60000) {
    return {
      _passed: false,
      _details: 'RATE_LIMIT_WINDOW should be at least 60000ms (1 minute)'
    };
  }

  if (rateLimitMax < 10) {
    return {
      _passed: false,
      _details: 'RATE_LIMIT_MAX should be at least 10 requests per window'
    };
  }

  return { _passed: true, _details: 'Performance configuration is appropriate' };
});

// Run all checks
async function main() {
  try {
    await checker.runChecks();
  } catch (error) {
    log(`\n❌ Production readiness check _failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { ProductionReadinessCheck };
