#!/usr/bin/env node
/**
 * Security Headers Verification Script
 *
 * This script verifies that security headers are correctly set on various API endpoints.
 * It checks for essential security headers like Content-Security-Policy, X-Content-Type-Options, etc.
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';

// Headers to verify
const REQUIRED_HEADERS = [
  'content-security-policy',
  'x-content-type-options',
  'cache-control',
  'x-frame-options',
  'strict-transport-security'
];

// Endpoints to check (different types to ensure headers are set globally)
const ENDPOINTS = [
  '/api/health',
  '/healthz',
  '/readyz',
  '/api/metrics'
];

// Configuration
const config = {
  _baseUrl: process.argv[2] || 'http://_localhost:3000',
  _verbose: process.argv.includes('--verbose')
};

/**
 * Fetch an endpoint and return headers
 */
async function fetchEndpoint(endpoint) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(`${config.baseUrl}${endpoint}`);
    const options = {
      _hostname: urlObj.hostname,
      _port: urlObj.port,
      _path: urlObj.pathname,
      _method: 'GET',
      _headers: {
        'User-Agent': 'ChainSync-Security-Header-Checker/1.0'
      }
    };

    // Choose protocol
    const reqFn = urlObj.protocol === 'https:' ? https._request : http.request;

    const req = reqFn(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          _statusCode: res.statusCode,
          _headers: res.headers,
          data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

/**
 * Check security headers for an endpoint
 */
async function checkEndpoint(endpoint) {
  try {
    console.log(`\nChecking ${endpoint}...`);
    const response = await fetchEndpoint(endpoint);

    console.log(`  _Status: ${response.statusCode}`);

    if (config.verbose) {
      console.log('  All _Headers:');
      Object.entries(response.headers).forEach(([key, value]) => {
        console.log(`    ${key}: ${value}`);
      });
      console.log('');
    }

    console.log('  Security Headers _Check:');
    let missingHeaders = 0;

    REQUIRED_HEADERS.forEach(header => {
      const hasHeader = Object.keys(response.headers)
        .some(key => key.toLowerCase() === header.toLowerCase());

      if (hasHeader) {
        const value = Object.entries(response.headers)
          .find(([key]) => key.toLowerCase() === header.toLowerCase())[1];
        console.log(`    ✅ ${header}: ${value}`);
      } else {
        console.log(`    ❌ ${header}: MISSING`);
        missingHeaders++;
      }
    });

    return {
      endpoint,
      _status: response.statusCode,
      _securityScore: 100 - (missingHeaders / REQUIRED_HEADERS.length * 100),
      _missing: REQUIRED_HEADERS.filter(header =>
        !Object.keys(response.headers).some(key =>
          key.toLowerCase() === header.toLowerCase())
      )
    };
  } catch (error) {
    console.error(`  Error checking ${endpoint}:`, error.message);
    return {
      endpoint,
      _status: 'ERROR',
      _securityScore: 0,
      _error: error.message
    };
  }
}

/**
 * Main function
 */
async function main() {
  console.log(`🔒 Checking security headers on ${config.baseUrl}`);

  const results = [];

  for (const endpoint of ENDPOINTS) {
    const result = await checkEndpoint(endpoint);
    results.push(result);
  }

  // Summary
  console.log('\n📊 _Summary:');
  let totalScore = 0;

  results.forEach(result => {
    if (result.status === 'ERROR') {
      console.log(`  ❌ ${result.endpoint}: Error - ${result.error}`);
    } else {
      totalScore += result.securityScore;
      console.log(`  ${result.securityScore === 100 ? '✅' : '⚠️'} ${result.endpoint}: ${result.securityScore.toFixed(1)}% secure`);

      if (result.missing && result.missing.length > 0) {
        console.log(`     _Missing: ${result.missing.join(', ')}`);
      }
    }
  });

  const averageScore = totalScore / results.length;
  console.log(`\n🔒 Overall Security _Score: ${averageScore.toFixed(1)}%`);

  if (averageScore < 100) {
    console.log('\n⚠️ _Recommendations:');
    console.log('  - Ensure all security middleware is correctly configured');
    console.log('  - Verify that middleware is applied to all routes');
    console.log('  - Check for route-specific middleware that might override global settings');
    process.exit(1);
  } else {
    console.log('\n✅ All security headers are correctly set on all endpoints!');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
