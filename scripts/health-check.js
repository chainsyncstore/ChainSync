#!/usr/bin/env node
/**
 * Health Check Script for ChainSync
 * 
 * This script performs a comprehensive health check of the ChainSync application.
 * It verifies that all required services are available and responsive.
 * 
 * Usage:
 *   node health-check.js [--url=<base-url>] [--timeout=<ms>] [--exit]
 * 
 * Options:
 *   --url=<base-url>  Base URL of the application (default: http://localhost:3000)
 *   --timeout=<ms>    Request timeout in milliseconds (default: 5000)
 *   --exit            Exit with non-zero code if health check fails
 *   --json            Output results in JSON format
 */

import http from 'http';
import https from 'https';
import url from 'url';
import { execSync } from 'child_process';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Default configuration
const config = {
  baseUrl: 'http://localhost:3000',
  timeout: 5000,
  exitOnFailure: false,
  jsonOutput: false
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
  { path: '/api/health', name: 'Basic Health Check', critical: true },
  { path: '/api/health/details', name: 'Detailed Health Check', critical: true },
  { path: '/api/metrics', name: 'Metrics Endpoint', critical: false },
  { path: '/api/v1/status', name: 'API Status', critical: false },
  
  // Kubernetes-style health check endpoints
  { path: '/healthz', name: 'Kubernetes Liveness Probe', critical: true },
  { path: '/readyz', name: 'Kubernetes Readiness Probe', critical: true }
];

// Results tracker
const results = {
  timestamp: new Date().toISOString(),
  baseUrl: config.baseUrl,
  timeout: config.timeout,
  endpoints: [],
  system: {},
  overall: 'UNKNOWN'
};

/**
 * Make a HTTP/HTTPS request to the specified endpoint
 */
function makeRequest(endpoint) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const endpointUrl = config.baseUrl + endpoint.path;
    const parsedUrl = new URL(endpointUrl);
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.path,
      method: 'GET',
      timeout: config.timeout,
      headers: {
        'User-Agent': 'ChainSync-Health-Check/1.0'
      }
    };
    
    // Determine if HTTP or HTTPS
    const client = parsedUrl.protocol === 'https:' ? https : http;
    
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
            endpoint: endpoint.path,
            name: endpoint.name,
            status: statusOk ? 'UP' : 'DOWN',
            statusCode: res.statusCode,
            responseTime: duration,
            data: jsonData,
            error: null
          });
        } catch (error) {
          resolve({
            endpoint: endpoint.path,
            name: endpoint.name,
            status: 'ERROR',
            statusCode: res.statusCode,
            responseTime: duration,
            data: null,
            error: `Failed to parse response: ${error.message}`
          });
        }
      });
    });
    
    req.on('error', (error) => {
      const duration = Date.now() - startTime;
      resolve({
        endpoint: endpoint.path,
        name: endpoint.name,
        status: 'DOWN',
        statusCode: 0,
        responseTime: duration,
        data: null,
        error: error.message
      });
    });
    
    req.on('timeout', () => {
      req.abort();
      resolve({
        endpoint: endpoint.path,
        name: endpoint.name,
        status: 'TIMEOUT',
        statusCode: 0,
        responseTime: config.timeout,
        data: null,
        error: 'Request timed out'
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
      memoryUsage: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`
      }
    };
  } catch (error) {
    results.system = {
      error: `Failed to check system health: ${error.message}`
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
      critical: endpoint.critical
    });
    
    // Print result to console if not in JSON mode
    if (!config.jsonOutput) {
      const statusSymbol = result.status === 'UP' ? '✅' : result.status === 'DOWN' ? '❌' : '⚠️';
      const criticalText = endpoint.critical ? ' (CRITICAL)' : '';
      
      console.log(`${statusSymbol} ${result.name}${criticalText}: ${result.status}`);
      console.log(`  URL: ${config.baseUrl}${endpoint.path}`);
      console.log(`  Response: ${result.statusCode} (${result.responseTime}ms)`);
      
      if (result.error) {
        console.log(`  Error: ${result.error}`);
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
    console.log(`${overallSymbol} Overall Status: ${results.overall}`);
    
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
