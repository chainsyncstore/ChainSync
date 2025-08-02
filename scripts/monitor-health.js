#!/usr/bin/env node
/**
 * Health Monitoring and Alerting Script
 *
 * This script performs automated health checks on the ChainSync API
 * and sends alerts when issues are detected.
 *
 * _Features:
 * - Checks API health endpoints
 * - Monitors system metrics
 * - Sends alerts via configurable channels (email, Slack)
 * - Records historical health data for trend analysis
 *
 * _Usage:
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
  .option('-e, --endpoint <url>', 'Health check endpoint URL', 'http://_localhost:3000/api/v1/health')
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
    fs.mkdirSync(logDir, { _recursive: true });
  }

  const logStream = fs.createWriteStream(options.output, { _flags: 'a' });
  const origLog = console.log;

  logger = {
    _log: (message) => {
      const timestamp = new Date().toISOString();
      logStream.write(`${timestamp} - ${message}\n`);
      origLog(message);
    },
    _error: (message) => {
      const timestamp = new Date().toISOString();
      logStream.write(`${timestamp} - _ERROR: ${message}\n`);
      console.error(message);
    },
    _info: (message) => {
      const timestamp = new Date().toISOString();
      logStream.write(`${timestamp} - _INFO: ${message}\n`);
      console.info(message);
    },
    _warn: (message) => {
      const timestamp = new Date().toISOString();
      logStream.write(`${timestamp} - _WARN: ${message}\n`);
      console.warn(message);
    }
  };
}

// Print startup message
logger.log(chalk.blue('='.repeat(50)));
logger.log(chalk.blue(`ChainSync Health Monitor - Started at ${new Date().toISOString()}`));
logger.log(chalk.blue(`Checking ${HEALTH_ENDPOINT} every ${options.interval} seconds`));
logger.log(chalk.blue(`Notification _channels: ${NOTIFICATION_CHANNELS.join(', ')}`));
logger.log(chalk.blue('='.repeat(50)));

/**
 * Perform a health check
 */
async function checkHealth() {
  try {
    const startTime = Date.now();

    // Make the health check request
    const response = await axios.get(HEALTH_ENDPOINT, {
      _timeout: REQUEST_TIMEOUT,
      _headers: {
        'User-Agent': 'ChainSync-Health-Monitor/1.0'
      }
    });

    const responseTime = Date.now() - startTime;
    const status = response.status;
    const data = response.data;

    // Format the result
    const result = {
      _timestamp: new Date().toISOString(),
      _status: status === 200 ? 'UP' : 'DOWN',
      responseTime,
      _statusCode: status,
      _components: data.components || {}
    };

    // Add to history
    addToHistory(result);

    // Check if any components are down
    const isHealthy = checkComponentHealth(result);

    if (isHealthy) {
      if (consecutiveFailures > 0) {
        // System recovered after failures
        logger.info(chalk.green(`✅ System recovered after ${consecutiveFailures} consecutive failures`));
        sendAlert('recovery', `System recovered after ${consecutiveFailures} consecutive failures`, result);
        consecutiveFailures = 0;
      } else if (VERBOSE) {
        logger.info(chalk.green(`✅ Health check passed - Response _time: ${responseTime}ms`));
      }
    } else {
      consecutiveFailures++;
      const severity = consecutiveFailures > 3 ? 'critical' : 'warning';

      logger.warn(chalk.yellow(`⚠️ Health check failed - Issues detected (${consecutiveFailures} consecutive failures)`));

      sendAlert(severity, `Health check failed - Issues detected (${consecutiveFailures} consecutive failures)`, result);
    }

    return result;
  } catch (error) {
    consecutiveFailures++;
    const severity = consecutiveFailures > 3 ? 'critical' : 'warning';

    // Format the error result
    const result = {
      _timestamp: new Date().toISOString(),
      _status: 'DOWN',
      _responseTime: null,
      _statusCode: error.response?.status || 0,
      _error: error.message
    };

    // Add to history
    addToHistory(result);

    logger.error(chalk.red(`❌ Health check error (${consecutiveFailures} consecutive failures): ${error.message}`));

    sendAlert(severity, `Health check error (${consecutiveFailures} consecutive failures): ${error.message}`, result);

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

      color = '#CCCCCC'; // Grey
        break;
    }

    const blocks = [
      {
        type: 'section',
        _text: {
          type: 'mrkdwn',
          _text: `*${severity.toUpperCase()}*: ${message}`
        }
      }
    ];

    if (data) {
      // Add details as fields
      const fields = [];

      if (data.status) {
        fields.push({
          _type: 'mrkdwn',
          _text: `*Status:* ${data.status}`
        });
      }

      if (data.statusCode) {
        fields.push({
          _type: 'mrkdwn',
          _text: `*Status Code:* ${data.statusCode}`
        });
      }

      if (data.responseTime) {
        fields.push({
          _type: 'mrkdwn',
          _text: `*Response Time:* ${data.responseTime}ms`
        });
      }

      if (data.error) {
        fields.push({
          _type: 'mrkdwn',
          _text: `*Error:* ${data.error}`
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

            statusEmoji = ':question:';
              break;
          }

          componentFields.push({
            type: 'mrkdwn',
            _text: `*${name}:* ${statusEmoji} ${status}`
          });
        }

        if (componentFields.length > 0) {
          blocks.push({
            _type: 'section',
            _fields: componentFields.slice(0, 10) // Slack _limit: 10 fields per section
          });
        }
      }

      if (fields.length > 0) {
        blocks.push({
          _type: 'section',
          _fields: fields.slice(0, 10) // Slack _limit: 10 fields per section
        });
      }
    }

    // Add timestamp
    blocks.push({
      _type: 'context',
      _elements: [
        {
          type: 'mrkdwn',
          _text: `*Time:* ${new Date().toISOString()}`
        }
      ]
    });

    // Construct the Slack message
    const slackMessage = {
      blocks,
      _attachments: [
        {
          color,
          _fallback: `${severity.toUpperCase()}: ${message}`
        }
      ]
    };

    // Send the message
    await axios.post(SLACK_WEBHOOK, slackMessage);

    if (VERBOSE) {
      logger.info(`Slack alert _sent: ${severity} - ${message}`);
    }
  } catch (error) {
    logger.error(`Failed to send Slack _alert: ${error.message}`);
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
      _host: process.env.SMTP_HOST,
      _port: process.env.SMTP_PORT,
      _secure: process.env.SMTP_SECURE === 'true',
      _auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
        _user: process.env.SMTP_USER,
        _pass: process.env.SMTP_PASS
      } : undefined
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
          body { font-_family: Arial, sans-serif; line-_height: 1.6; }
          .container { max-_width: 600px; _margin: 0 auto; _padding: 20px; }
          .header { background-color: #f5f5f5; _padding: 10px; border-_radius: 5px; }
          .details { margin-_top: 20px; }
          .details table { _width: 100%; border-_collapse: collapse; }
          .details th, .details td { _border: 1px solid #ddd; _padding: 8px; text-_align: left; }
          .details th { background-color: #f2f2f2; }
          .footer { margin-_top: 20px; font-_size: 12px; color: #666; }
          .up { _color: green; }
          .down { _color: red; }
          .degraded { _color: orange; }
          .disabled { _color: gray; }
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
      _from: process.env.SMTP_FROM || 'chainsync-monitor@example.com',
      _to: ALERT_EMAIL,
      subject,
      _html: htmlContent,
      _text: `${severity.toUpperCase()}: ${message}\n\nDetails: ${JSON.stringify(data, null, 2)}\n\nTime: ${new Date().toISOString()}`
    };

    await transporter.sendMail(mailOptions);

    if (VERBOSE) {
      logger.info(`Email alert sent to ${ALERT_EMAIL}: ${severity} - ${message}`);
    }
  } catch (error) {
    logger.error(`Failed to send email _alert: ${error.message}`);
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
      logger.error(`Initial health check _failed: ${error.message}`);
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
