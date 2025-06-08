#!/usr/bin/env node
/**
 * Health Monitoring and Alerting Script
 *
 * This script performs automated health checks on the ChainSync API
 * and sends alerts when issues are detected.
 *
 * Features:
 * - Checks API health endpoints
 * - Monitors system metrics
 * - Sends alerts via configurable channels (email, Slack)
 * - Records historical health data for trend analysis
 *
 * Usage:
 *   node monitor-health.js --interval=60 --notify=slack,email
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const chalk = require('chalk');
const nodemailer = require('nodemailer');
require('dotenv').config();

// Define command-line options
program
  .option('-i, --interval <seconds>', 'Check interval in seconds', '60')
  .option('-n, --notify <channels>', 'Notification channels (comma-separated)', 'console')
  .option(
    '-e, --endpoint <url>',
    'Health check endpoint URL',
    'http://localhost:3000/api/v1/health'
  )
  .option('-t, --timeout <seconds>', 'Request timeout in seconds', '5')
  .option('-o, --output <file>', 'Log output to file')
  .option('--slack-webhook <url>', 'Slack webhook URL for notifications')
  .option('--email <address>', 'Email address for notifications')
  .option('--verbose', 'Enable verbose output')
  .parse(process.argv);

const options = program.opts();

// Configuration
const CHECK_INTERVAL = parseInt(options.interval, 10) * 1000;
const NOTIFICATION_CHANNELS = options.notify.split(',');
const HEALTH_ENDPOINT = options.endpoint;
const REQUEST_TIMEOUT = parseInt(options.timeout, 10) * 1000;
const VERBOSE = options.verbose;
const SLACK_WEBHOOK = options.slackWebhook || process.env.SLACK_WEBHOOK_URL;
const ALERT_EMAIL = options.email || process.env.ALERT_EMAIL;

// State tracking
let consecutiveFailures = 0;
const healthHistory = [];
const MAX_HISTORY = 100;

// Set up output logging
let logger = console;
if (options.output) {
  const logDir = path.dirname(options.output);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logStream = fs.createWriteStream(options.output, { flags: 'a' });
  const origLog = console.log;

  logger = {
    log: message => {
      const timestamp = new Date().toISOString();
      logStream.write(`${timestamp} - ${message}\n`);
      origLog(message);
    },
    error: message => {
      const timestamp = new Date().toISOString();
      logStream.write(`${timestamp} - ERROR: ${message}\n`);
      console.error(message);
    },
    info: message => {
      const timestamp = new Date().toISOString();
      logStream.write(`${timestamp} - INFO: ${message}\n`);
      console.info(message);
    },
    warn: message => {
      const timestamp = new Date().toISOString();
      logStream.write(`${timestamp} - WARN: ${message}\n`);
      console.warn(message);
    },
  };
}

// Print startup message
logger.log(chalk.blue('='.repeat(50)));
logger.log(chalk.blue(`ChainSync Health Monitor - Started at ${new Date().toISOString()}`));
logger.log(chalk.blue(`Checking ${HEALTH_ENDPOINT} every ${options.interval} seconds`));
logger.log(chalk.blue(`Notification channels: ${NOTIFICATION_CHANNELS.join(', ')}`));
logger.log(chalk.blue('='.repeat(50)));

/**
 * Perform a health check
 */
async function checkHealth() {
  try {
    const startTime = Date.now();

    // Make the health check request
    const response = await axios.get(HEALTH_ENDPOINT, {
      timeout: REQUEST_TIMEOUT,
      headers: {
        'User-Agent': 'ChainSync-Health-Monitor/1.0',
      },
    });

    const responseTime = Date.now() - startTime;
    const status = response.status;
    const data = response.data;

    // Format the result
    const result = {
      timestamp: new Date().toISOString(),
      status: status === 200 ? 'UP' : 'DOWN',
      responseTime,
      statusCode: status,
      components: data.components || {},
    };

    // Add to history
    addToHistory(result);

    // Check if any components are down
    const isHealthy = checkComponentHealth(result);

    if (isHealthy) {
      if (consecutiveFailures > 0) {
        // System recovered after failures
        logger.info(
          chalk.green(`✅ System recovered after ${consecutiveFailures} consecutive failures`)
        );
        sendAlert(
          'recovery',
          `System recovered after ${consecutiveFailures} consecutive failures`,
          result
        );
        consecutiveFailures = 0;
      } else if (VERBOSE) {
        logger.info(chalk.green(`✅ Health check passed - Response time: ${responseTime}ms`));
      }
    } else {
      consecutiveFailures++;
      const severity = consecutiveFailures > 3 ? 'critical' : 'warning';

      logger.warn(
        chalk.yellow(
          `⚠️ Health check failed - Issues detected (${consecutiveFailures} consecutive failures)`
        )
      );

      sendAlert(
        severity,
        `Health check failed - Issues detected (${consecutiveFailures} consecutive failures)`,
        result
      );
    }

    return result;
  } catch (error) {
    consecutiveFailures++;
    const severity = consecutiveFailures > 3 ? 'critical' : 'warning';

    // Format the error result
    const result = {
      timestamp: new Date().toISOString(),
      status: 'DOWN',
      responseTime: null,
      statusCode: error.response?.status || 0,
      error: error.message,
    };

    // Add to history
    addToHistory(result);

    logger.error(
      chalk.red(
        `❌ Health check error (${consecutiveFailures} consecutive failures): ${error.message}`
      )
    );

    sendAlert(
      severity,
      `Health check error (${consecutiveFailures} consecutive failures): ${error.message}`,
      result
    );

    return result;
  }
}

/**
 * Check component health from the health result
 */
function checkComponentHealth(result) {
  if (result.status !== 'UP') {
    return false;
  }

  if (!result.components) {
    return true;
  }

  // Check each component
  const components = result.components;
  const componentStatuses = [];

  for (const [name, component] of Object.entries(components)) {
    if (component.status !== 'UP' && component.status !== 'DISABLED') {
      if (VERBOSE) {
        logger.warn(chalk.yellow(`⚠️ Component ${name} is ${component.status}`));
      }
      componentStatuses.push(false);
    } else {
      componentStatuses.push(true);
    }
  }

  // If any component is down, system is not healthy
  return !componentStatuses.includes(false);
}

/**
 * Add health check result to history
 */
function addToHistory(result) {
  healthHistory.unshift(result);

  if (healthHistory.length > MAX_HISTORY) {
    healthHistory.pop();
  }

  // If there's an output file specified, also write the history to a JSON file
  if (options.output) {
    const historyFilePath = options.output.replace(/\.[^.]+$/, '') + '.json';
    fs.writeFileSync(historyFilePath, JSON.stringify(healthHistory, null, 2));
  }
}

/**
 * Send an alert to configured channels
 */
async function sendAlert(severity, message, data) {
  for (const channel of NOTIFICATION_CHANNELS) {
    switch (channel.trim().toLowerCase()) {
      case 'console':
        logAlert(severity, message, data);
        break;

      case 'slack':
        if (SLACK_WEBHOOK) {
          await sendSlackAlert(severity, message, data);
        } else if (VERBOSE) {
          logger.warn('Slack webhook URL not configured. Skipping Slack notification.');
        }
        break;

      case 'email':
        if (ALERT_EMAIL) {
          await sendEmailAlert(severity, message, data);
        } else if (VERBOSE) {
          logger.warn('Alert email not configured. Skipping email notification.');
        }
        break;
    }
  }
}

/**
 * Log an alert to the console
 */
function logAlert(severity, message, data) {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${severity.toUpperCase()}] ${timestamp} - ${message}`;

  switch (severity) {
    case 'critical':
      logger.error(chalk.bgRed.white(formattedMessage));
      break;

    case 'warning':
      logger.warn(chalk.yellow(formattedMessage));
      break;

    case 'recovery':
      logger.info(chalk.green(formattedMessage));
      break;

    default:
      logger.info(formattedMessage);
      break;
  }

  if (VERBOSE && data) {
    logger.log(JSON.stringify(data, null, 2));
  }
}

/**
 * Send a Slack alert
 */
async function sendSlackAlert(severity, message, data) {
  try {
    let color;

    switch (severity) {
      case 'critical':
        color = '#FF0000'; // Red
        break;

      case 'warning':
        color = '#FFA500'; // Orange
        break;

      case 'recovery':
        color = '#36A64F'; // Green
        break;

      default:
        color = '#CCCCCC'; // Grey
        break;
    }

    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${severity.toUpperCase()}*: ${message}`,
        },
      },
    ];

    if (data) {
      // Add details as fields
      const fields = [];

      if (data.status) {
        fields.push({
          type: 'mrkdwn',
          text: `*Status:* ${data.status}`,
        });
      }

      if (data.statusCode) {
        fields.push({
          type: 'mrkdwn',
          text: `*Status Code:* ${data.statusCode}`,
        });
      }

      if (data.responseTime) {
        fields.push({
          type: 'mrkdwn',
          text: `*Response Time:* ${data.responseTime}ms`,
        });
      }

      if (data.error) {
        fields.push({
          type: 'mrkdwn',
          text: `*Error:* ${data.error}`,
        });
      }

      // Add component statuses
      if (data.components) {
        const componentFields = [];

        for (const [name, component] of Object.entries(data.components)) {
          const status = component.status || 'UNKNOWN';
          let statusEmoji;

          switch (status) {
            case 'UP':
              statusEmoji = ':white_check_mark:';
              break;

            case 'DOWN':
              statusEmoji = ':x:';
              break;

            case 'DEGRADED':
              statusEmoji = ':warning:';
              break;

            case 'DISABLED':
              statusEmoji = ':no_entry_sign:';
              break;

            default:
              statusEmoji = ':question:';
              break;
          }

          componentFields.push({
            type: 'mrkdwn',
            text: `*${name}:* ${statusEmoji} ${status}`,
          });
        }

        if (componentFields.length > 0) {
          blocks.push({
            type: 'section',
            fields: componentFields.slice(0, 10), // Slack limit: 10 fields per section
          });
        }
      }

      if (fields.length > 0) {
        blocks.push({
          type: 'section',
          fields: fields.slice(0, 10), // Slack limit: 10 fields per section
        });
      }
    }

    // Add timestamp
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `*Time:* ${new Date().toISOString()}`,
        },
      ],
    });

    // Construct the Slack message
    const slackMessage = {
      blocks,
      attachments: [
        {
          color,
          fallback: `${severity.toUpperCase()}: ${message}`,
        },
      ],
    };

    // Send the message
    await axios.post(SLACK_WEBHOOK, slackMessage);

    if (VERBOSE) {
      logger.info(`Slack alert sent: ${severity} - ${message}`);
    }
  } catch (error) {
    logger.error(`Failed to send Slack alert: ${error.message}`);
  }
}

/**
 * Send an email alert
 */
async function sendEmailAlert(severity, message, data) {
  try {
    // Skip if no SMTP configuration
    if (!process.env.SMTP_HOST || !process.env.SMTP_PORT) {
      if (VERBOSE) {
        logger.warn('SMTP configuration missing. Skipping email notification.');
      }
      return;
    }

    // Create a transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            }
          : undefined,
    });

    // Construct email content
    let subject;
    let intro;

    switch (severity) {
      case 'critical':
        subject = `[CRITICAL] ChainSync Health Alert - ${message}`;
        intro = '<h1 style="color: #cc0000;">CRITICAL ALERT</h1>';
        break;

      case 'warning':
        subject = `[WARNING] ChainSync Health Alert - ${message}`;
        intro = '<h1 style="color: #ff9900;">WARNING</h1>';
        break;

      case 'recovery':
        subject = `[RECOVERED] ChainSync Health Status - ${message}`;
        intro = '<h1 style="color: #00cc00;">SYSTEM RECOVERED</h1>';
        break;

      default:
        subject = `[INFO] ChainSync Health Status - ${message}`;
        intro = '<h1 style="color: #0099cc;">INFORMATION</h1>';
        break;
    }

    // Construct the HTML content
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f5f5f5; padding: 10px; border-radius: 5px; }
          .details { margin-top: 20px; }
          .details table { width: 100%; border-collapse: collapse; }
          .details th, .details td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          .details th { background-color: #f2f2f2; }
          .footer { margin-top: 20px; font-size: 12px; color: #666; }
          .up { color: green; }
          .down { color: red; }
          .degraded { color: orange; }
          .disabled { color: gray; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            ${intro}
            <p>${message}</p>
          </div>
          <div class="details">
    `;

    if (data) {
      htmlContent += `
        <h2>Health Check Details</h2>
        <table>
          <tr>
            <th>Status</th>
            <td class="${data.status?.toLowerCase()}">${data.status || 'UNKNOWN'}</td>
          </tr>
      `;

      if (data.statusCode) {
        htmlContent += `
          <tr>
            <th>Status Code</th>
            <td>${data.statusCode}</td>
          </tr>
        `;
      }

      if (data.responseTime) {
        htmlContent += `
          <tr>
            <th>Response Time</th>
            <td>${data.responseTime}ms</td>
          </tr>
        `;
      }

      if (data.error) {
        htmlContent += `
          <tr>
            <th>Error</th>
            <td>${data.error}</td>
          </tr>
        `;
      }

      htmlContent += '</table>';

      // Add component details if available
      if (data.components && Object.keys(data.components).length > 0) {
        htmlContent += `
          <h2>Component Status</h2>
          <table>
            <tr>
              <th>Component</th>
              <th>Status</th>
              <th>Details</th>
            </tr>
        `;

        for (const [name, component] of Object.entries(data.components)) {
          htmlContent += `
            <tr>
              <td>${name}</td>
              <td class="${component.status?.toLowerCase()}">${component.status || 'UNKNOWN'}</td>
              <td>${component.message || ''}</td>
            </tr>
          `;
        }

        htmlContent += '</table>';
      }
    }

    // Close the HTML
    htmlContent += `
          </div>
          <div class="footer">
            <p>This is an automated alert from the ChainSync Health Monitor.</p>
            <p>Time: ${new Date().toISOString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send the email
    const mailOptions = {
      from: process.env.SMTP_FROM || 'chainsync-monitor@example.com',
      to: ALERT_EMAIL,
      subject,
      html: htmlContent,
      text: `${severity.toUpperCase()}: ${message}\n\nDetails: ${JSON.stringify(data, null, 2)}\n\nTime: ${new Date().toISOString()}`,
    };

    await transporter.sendMail(mailOptions);

    if (VERBOSE) {
      logger.info(`Email alert sent to ${ALERT_EMAIL}: ${severity} - ${message}`);
    }
  } catch (error) {
    logger.error(`Failed to send email alert: ${error.message}`);
  }
}

/**
 * Start the health check loop
 */
function startMonitoring() {
  // Perform an immediate check
  checkHealth()
    .then(() => {
      // Schedule recurring checks
      setInterval(checkHealth, CHECK_INTERVAL);
    })
    .catch(error => {
      logger.error(`Initial health check failed: ${error.message}`);
      // Schedule recurring checks even if initial check fails
      setInterval(checkHealth, CHECK_INTERVAL);
    });

  // Handle termination
  process.on('SIGINT', () => {
    logger.log(chalk.blue('='.repeat(50)));
    logger.log(chalk.blue(`ChainSync Health Monitor - Stopped at ${new Date().toISOString()}`));
    logger.log(chalk.blue('='.repeat(50)));
    process.exit(0);
  });
}

// Start monitoring
startMonitoring();
