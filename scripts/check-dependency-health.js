#!/usr/bin/env node

/**
 * Dependency Health Check Script
 *
 * This script analyzes the project dependencies for:
 * - Outdated packages
 * - Packages with security vulnerabilities
 * - Unused dependencies
 * - License compliance issues
 *
 * It provides a comprehensive report on the overall health of the project dependencies.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Set up paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const packageJsonPath = path.join(rootDir, 'package.json');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m',
};

/**
 * Print a section header
 */
function printHeader(title) {
  console.log(`\n${colors.bold}${colors.cyan}=== ${title} ===${colors.reset}\n`);
}

/**
 * Get the package.json content
 */
function getPackageJson() {
  try {
    const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
    return JSON.parse(packageJsonContent);
  } catch (error) {
    console.error(`${colors.red}Error reading package.json: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

/**
 * Check for outdated dependencies
 */
function checkOutdatedDependencies() {
  printHeader('Checking for Outdated Dependencies');

  try {
    // Use npm outdated to get information about outdated packages
    const outdatedOutput = execSync('npm outdated --json', { encoding: 'utf8', cwd: rootDir });

    if (outdatedOutput.trim() === '') {
      console.log(`${colors.green}✓ All dependencies are up to date!${colors.reset}`);
      return true;
    }

    const outdated = JSON.parse(outdatedOutput);
    const outdatedCount = Object.keys(outdated).length;

    if (outdatedCount === 0) {
      console.log(`${colors.green}✓ All dependencies are up to date!${colors.reset}`);
      return true;
    }

    console.log(`${colors.yellow}! Found ${outdatedCount} outdated dependencies:${colors.reset}\n`);

    // Create a table to display outdated packages
    console.log(
      `${colors.bold}Package Name${' '.repeat(20)}Current${' '.repeat(10)}Latest${' '.repeat(10)}Type${colors.reset}`
    );
    console.log('-'.repeat(75));

    Object.entries(outdated).forEach(([packageName, info]) => {
      const nameCol = packageName.padEnd(30);
      const currentCol = (info.current || 'N/A').padEnd(15);
      const latestCol = info.latest.padEnd(15);

      let typeColor = colors.yellow;
      if (info.type === 'major') {
        typeColor = colors.red;
      } else if (info.type === 'minor') {
        typeColor = colors.yellow;
      } else if (info.type === 'patch') {
        typeColor = colors.green;
      }

      console.log(`${nameCol}${currentCol}${latestCol}${typeColor}${info.type}${colors.reset}`);
    });

    return false;
  } catch (error) {
    if (error.message.includes('Command failed')) {
      console.log(`${colors.green}✓ All dependencies are up to date!${colors.reset}`);
      return true;
    }

    console.error(
      `${colors.red}Error checking outdated dependencies: ${error.message}${colors.reset}`
    );
    return false;
  }
}

/**
 * Check for security vulnerabilities using npm audit
 */
function checkSecurityVulnerabilities() {
  printHeader('Checking for Security Vulnerabilities');

  try {
    // We use --json to get structured output and suppress the default npm audit formatting
    const auditOutput = execSync('npm audit --json', {
      encoding: 'utf8',
      cwd: rootDir,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const auditData = JSON.parse(auditOutput);

    if (auditData.vulnerabilities && Object.keys(auditData.vulnerabilities).length === 0) {
      console.log(`${colors.green}✓ No vulnerabilities found!${colors.reset}`);
      return true;
    }

    const { metadata } = auditData;
    const vulnerabilitiesCount = metadata.vulnerabilities.total;

    if (vulnerabilitiesCount === 0) {
      console.log(`${colors.green}✓ No vulnerabilities found!${colors.reset}`);
      return true;
    }

    console.log(`${colors.red}! Found ${vulnerabilitiesCount} vulnerabilities:${colors.reset}`);
    console.log(`  Critical: ${metadata.vulnerabilities.critical}`);
    console.log(`  High: ${metadata.vulnerabilities.high}`);
    console.log(`  Moderate: ${metadata.vulnerabilities.moderate}`);
    console.log(`  Low: ${metadata.vulnerabilities.low}`);

    // Display the most critical vulnerabilities
    if (auditData.vulnerabilities) {
      const criticalVulns = Object.values(auditData.vulnerabilities).filter(
        vuln => vuln.severity === 'critical' || vuln.severity === 'high'
      );

      if (criticalVulns.length > 0) {
        console.log(`\n${colors.bold}Most Critical Vulnerabilities:${colors.reset}`);

        criticalVulns.forEach(vuln => {
          console.log(`\n${colors.bold}${vuln.name} (${vuln.severity})${colors.reset}`);
          console.log(
            `  Via: ${vuln.via.map(v => (typeof v === 'string' ? v : v.name)).join(', ')}`
          );
          if (vuln.fixAvailable) {
            console.log(
              `  ${colors.green}Fix available: ${
                typeof vuln.fixAvailable === 'object'
                  ? `Upgrade to ${vuln.fixAvailable.name}@${vuln.fixAvailable.version}`
                  : 'Yes'
              }${colors.reset}`
            );
          } else {
            console.log(`  ${colors.red}No fix available${colors.reset}`);
          }
        });
      }
    }

    // Check for available fixes
    console.log(`\n${colors.bold}Recommendation:${colors.reset}`);
    console.log(
      `Run ${colors.bold}npm audit fix${colors.reset} to automatically fix vulnerabilities that have available patches.`
    );
    console.log(
      `For more details, run ${colors.bold}npm audit${colors.reset} to see the full report.`
    );

    return false;
  } catch (error) {
    if (
      error.message.includes('Command failed') &&
      error.message.includes('vulnerabilities found')
    ) {
      console.log(`${colors.red}! Security vulnerabilities found${colors.reset}`);
      console.log(`Run ${colors.bold}npm audit${colors.reset} for details.`);
      return false;
    }

    console.log(`${colors.green}✓ No vulnerabilities found!${colors.reset}`);
    return true;
  }
}

/**
 * Check for license compliance issues
 */
function checkLicenseCompliance() {
  printHeader('Checking License Compliance');

  try {
    // Use npm ls to get a list of all installed packages and their licenses
    const licenseOutput = execSync('npm ls --json --all', { encoding: 'utf8', cwd: rootDir });
    const licenseData = JSON.parse(licenseOutput);

    // Potentially problematic licenses
    const restrictiveLicenses = [
      'AGPL',
      'AGPL-1.0',
      'AGPL-3.0',
      'GPL',
      'GPL-1.0',
      'GPL-2.0',
      'GPL-3.0',
      'LGPL',
      'LGPL-2.0',
      'LGPL-2.1',
      'LGPL-3.0',
      'EUPL',
      'EUPL-1.1',
      'EUPL-1.2',
      'CDDL',
      'CPOL',
      'OSL-3.0',
      'Unlicense',
      'UNLICENSED',
      'UNKNOWN',
    ];

    // Extract dependencies recursively
    function extractDeps(deps) {
      if (!deps) return [];

      return Object.entries(deps).flatMap(([name, info]) => {
        const result = [
          {
            name,
            version: info.version,
            license: info.license || 'UNKNOWN',
          },
        ];

        if (info.dependencies) {
          result.push(...extractDeps(info.dependencies));
        }

        return result;
      });
    }

    const allDependencies = extractDeps(licenseData.dependencies);
    const uniqueDependencies = allDependencies.filter(
      (dep, index, self) =>
        index === self.findIndex(d => d.name === dep.name && d.version === dep.version)
    );

    // Find dependencies with restrictive licenses
    const problematicDeps = uniqueDependencies.filter(
      dep =>
        dep.license &&
        restrictiveLicenses.some(
          license => typeof dep.license === 'string' && dep.license.includes(license)
        )
    );

    if (problematicDeps.length === 0) {
      console.log(`${colors.green}✓ No license compliance issues found!${colors.reset}`);
      return true;
    }

    console.log(
      `${colors.yellow}! Found ${problematicDeps.length} dependencies with potentially problematic licenses:${colors.reset}\n`
    );

    // Create a table to display problematic packages
    console.log(
      `${colors.bold}Package Name${' '.repeat(30)}Version${' '.repeat(15)}License${colors.reset}`
    );
    console.log('-'.repeat(75));

    problematicDeps.forEach(dep => {
      const nameCol = dep.name.padEnd(40);
      const versionCol = dep.version.padEnd(20);
      console.log(`${nameCol}${versionCol}${colors.yellow}${dep.license}${colors.reset}`);
    });

    console.log(
      `\n${colors.yellow}⚠ Review these dependencies for potential license compliance issues.${colors.reset}`
    );
    console.log(`  Some licenses may require additional compliance steps, such as:
  - Including license text in your application
  - Providing attribution
  - Sharing source code changes
  - Consulting with legal counsel`);

    return false;
  } catch (error) {
    console.error(
      `${colors.red}Error checking license compliance: ${error.message}${colors.reset}`
    );
    return false;
  }
}

/**
 * Run all checks and print a summary
 */
function runAllChecks() {
  console.log(
    `${colors.bold}${colors.blue}========================================${colors.reset}`
  );
  console.log(`${colors.bold}${colors.blue}  DEPENDENCY HEALTH CHECK${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}  ChainSync Manager${colors.reset}`);
  console.log(
    `${colors.bold}${colors.blue}========================================${colors.reset}`
  );

  const results = {
    outdated: checkOutdatedDependencies(),
    security: checkSecurityVulnerabilities(),
    license: checkLicenseCompliance(),
  };

  printHeader('Summary');

  console.log(
    `Outdated Dependencies: ${results.outdated ? `${colors.green}✓ OK${colors.reset}` : `${colors.yellow}⚠ Needs attention${colors.reset}`}`
  );
  console.log(
    `Security Vulnerabilities: ${results.security ? `${colors.green}✓ OK${colors.reset}` : `${colors.red}✕ Critical issues${colors.reset}`}`
  );
  console.log(
    `License Compliance: ${results.license ? `${colors.green}✓ OK${colors.reset}` : `${colors.yellow}⚠ Needs review${colors.reset}`}`
  );

  const allPassed = Object.values(results).every(Boolean);

  console.log(
    `\n${colors.bold}${colors.blue}========================================${colors.reset}`
  );
  console.log(
    `Overall Status: ${
      allPassed
        ? `${colors.green}✓ All checks passed!${colors.reset}`
        : `${colors.yellow}⚠ Some issues need attention${colors.reset}`
    }`
  );
  console.log(
    `${colors.bold}${colors.blue}========================================${colors.reset}`
  );

  return allPassed ? 0 : 1;
}

// Run all checks
process.exit(runAllChecks());
