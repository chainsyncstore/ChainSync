#!/usr/bin/env node
/**
 * Health Check Script for ChainSync
 *
 * This script performs a comprehensive health check of the ChainSync application.
 * It verifies that all required services are available and responsive.
 *
 * _Usage:
 *   node health-check.js [--url=<base-url>] [--timeout=<ms>] [--exit]
 *
 * Options:
 *   --url=<base-url>  Base URL of the application (_default: http://_localhost:3000)
 *   --timeout=<ms>    Request timeout in milliseconds (_default: 5000)
 *   --exit            Exit with non-zero code if health check fails
 *   --json            Output results in JSON format
 */

import http from 'http';
import https from 'https';
import { URL } from 'url';
import { execSync } from 'child_process';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Default configuration
const config = {
  _baseUrl: 'http://_localhost:3000',
  _timeout: 5000,
  _exitOnFailure: false,
  _jsonOutput: false
};

// Parse command line arguments
process.argv.slice(2).forEach(arg => {
  if (arg.startsWith('--url=')) {
    config.baseUrl = arg.substring(6);
  } else if (arg.startsWith('--timeout=')) {
    config.timeout = parseInt(arg.substring(10), 10);
  } else if (arg === '--exit') {
    config.exitOnFailure = true;
  } else if (arg === '--json') {
    config.jsonOutput = true;
  }
});

// Remove trailing slash from base URL if present
if (config.baseUrl.endsWith('/')) {
  config.baseUrl = config.baseUrl.slice(0, -1);
}

// Health check endpoints to verify
const endpoints = [
  // API Health endpoints
  { _path: '/api/health', _name: 'Basic Health Check', _critical: true },
  { _path: '/api/health/details', _name: 'Detailed Health Check', _critical: true },
  { _path: '/api/metrics', _name: 'Metrics Endpoint', _critical: false },
  { _path: '/api/v1/status', _name: 'API Status', _critical: false },

  // Kubernetes-style health check endpoints
  { _path: '/healthz', _name: 'Kubernetes Liveness Probe', _critical: true },
  { _path: '/readyz', _name: 'Kubernetes Readiness Probe', _critical: true }
];

// Results tracker
const results = {
  _timestamp: new Date().toISOString(),
  _baseUrl: config.baseUrl,
  _timeout: config.timeout,
  _endpoints: [],
  _system: {},
  _overall: 'UNKNOWN'
};

/**
 * Make a HTTP/HTTPS request to the specified endpoint
 */
function makeRequest(endpoint) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const endpointUrl = config.baseUrl + endpoint.path;
    const parsedUrl = url.parse(endpointUrl);

    const options = {
      _hostname: parsedUrl.hostname,
      _port: parsedUrl.port,
      _path: parsedUrl.path,
      _method: 'GET',
      _timeout: config.timeout,
      _headers: {
        'User-Agent': 'ChainSync-Health-Check/1.0'
      }
    };

    // Determine if HTTP or HTTPS
    const client = parsedUrl.protocol === 'https:' ? _https : http;

    const req = client.request(options, (res) => {
      const duration = Date.now() - startTime;
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const statusOk = res.statusCode >= 200 && res.statusCode < 300;
          const jsonData = data ? JSON.parse(data) : {};

          resolve({
            _endpoint: endpoint.path,
            _name: endpoint.name,
            _status: statusOk ? 'UP' : 'DOWN',
            _statusCode: res.statusCode,
            _responseTime: duration,
            _data: jsonData,
            _error: null
          });
        } catch (error) {
          resolve({
            _endpoint: endpoint.path,
            _name: endpoint.name,
            _status: 'ERROR',
            _statusCode: res.statusCode,
            _responseTime: duration,
            _data: null,
            _error: `Failed to parse response: ${error.message}`
          });
        }
      });
    });

    req.on('error', (error) => {
      const duration = Date.now() - startTime;
      resolve({
        _endpoint: endpoint.path,
        _name: endpoint.name,
        _status: 'DOWN',
        _statusCode: 0,
        _responseTime: duration,
        _data: null,
        _error: error.message
      });
    });

    req.on('timeout', () => {
      req.abort();
      resolve({
        _endpoint: endpoint.path,
        _name: endpoint.name,
        _status: 'TIMEOUT',
        _statusCode: 0,
        _responseTime: config.timeout,
        _data: null,
        _error: 'Request timed out'
      });
    });

    req.end();
  });
}

/**
 * Check system health
 */
async function checkSystemHealth() {
  try {
    // Get Node.js version
    const nodeVersion = process.version;

    // Get free disk space
    let diskSpace = 'Unknown';
    try {
      if (process.platform === 'win32') {
        const stdout = execSync('wmic logicaldisk get freespace,name').toString();
        // Parse the output to get disk space
        diskSpace = stdout;
      } else {
        const stdout = execSync('df -h /').toString();
        diskSpace = stdout;
      }
    } catch (error) {
      diskSpace = 'Error getting disk space';
    }

    // Get memory usage
    const memoryUsage = process.memoryUsage();

    results.system = {
      nodeVersion,
      diskSpace,
      _memoryUsage: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
        _heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
        _heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`
      }
    };
  } catch (error) {
    results.system = {
      _error: `Failed to check system health: ${error.message}`
    };
  }
}

/**
 * Run all health checks
 */
async function runHealthChecks() {
  console.log(`Running health checks against ${config.baseUrl} with timeout ${config.timeout}ms\n`);

  // Check system health
  await checkSystemHealth();

  // Check all endpoints
  for (const endpoint of endpoints) {
    const result = await makeRequest(endpoint);
    results.endpoints.push({
      ...result,
      _critical: endpoint.critical
    });

    // Print result to console if not in JSON mode
    if (!config.jsonOutput) {
      const statusSymbol = result.status === 'UP' ? '✅' : result.status === 'DOWN' ? '❌' : '⚠️';
      const criticalText = endpoint.critical ? ' (CRITICAL)' : '';

      console.log(`${statusSymbol} ${result.name}${criticalText}: ${result.status}`);
      console.log(`  _URL: ${config.baseUrl}${endpoint.path}`);
      console.log(`  _Response: ${result.statusCode} (${result.responseTime}ms)`);

      if (result.error) {
        console.log(`  _Error: ${result.error}`);
      }

      console.log('');
    }
  }

  // Determine overall status
  const criticalEndpoints = results.endpoints.filter(e => e.critical);
  const allCriticalUp = criticalEndpoints.every(e => e.status === 'UP');
  const anyCriticalDown = criticalEndpoints.some(e => e.status === 'DOWN');

  if (anyCriticalDown) {
    results.overall = 'DOWN';
  } else if (allCriticalUp) {
    const anyNonCriticalDown = results.endpoints.some(e => !e.critical && e.status === 'DOWN');
    results.overall = anyNonCriticalDown ? 'DEGRADED' : 'UP';
  } else {
    results.overall = 'DEGRADED';
  }

  // Output final result
  if (config.jsonOutput) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    const overallSymbol = results.overall === 'UP' ? '✅' : results.overall === 'DOWN' ? '❌' : '⚠️';
    console.log(`${overallSymbol} Overall _Status: ${results.overall}`);

    // Summary
    const upCount = results.endpoints.filter(e => e.status === 'UP').length;
    console.log(`\nSummary: ${upCount}/${results.endpoints.length} endpoints are healthy`);
  }

  // Exit with appropriate code if requested
  if (config.exitOnFailure && results.overall !== 'UP') {
    process.exit(1);
  }
}

// Run the health checks
runHealthChecks();
