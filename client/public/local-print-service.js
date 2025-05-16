/**
 * ChainSync Local Print Service
 * 
 * This script monitors localStorage for print jobs and sends them to a connected
 * ESC/POS thermal printer. To use:
 * 
 * 1. Save this file on your POS terminal
 * 2. Install Node.js if not already installed
 * 3. Install dependencies: npm install serialport escpos escpos-usb escpos-network
 * 4. Run with: node local-print-service.js
 * 
 * This service will run in the background and automatically print receipts
 * when triggered from the ChainSync web application.
 */

// This is a sample implementation of a local print service.
// In production, consider packaging this as a standalone application.

const { SerialPort } = require('serialport');
const escpos = require('escpos');
escpos.USB = require('escpos-usb');
escpos.Network = require('escpos-network');

// Supported printer connection types
const CONNECTION_TYPES = {
  USB: 'usb',
  SERIAL: 'serial',
  NETWORK: 'network',
};

// Default configuration
const config = {
  connectionType: CONNECTION_TYPES.USB,
  serialPort: 'COM1',  // Windows default, use '/dev/ttyUSB0' for Linux
  baudRate: 9600,
  networkHost: '192.168.1.100',
  networkPort: 9100,
  checkInterval: 2000,  // Check for new print jobs every 2 seconds
  debug: true
};

// Storage for processed job IDs to avoid duplicate printing
const processedJobs = new Set();

/**
 * Log message with timestamp if debug mode is enabled
 */
function log(message) {
  if (config.debug) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
  }
}

/**
 * Connect to the printer based on configured connection type
 */
async function connectToPrinter() {
  try {
    let device;
    let printer;

    switch (config.connectionType) {
      case CONNECTION_TYPES.USB:
        // Find USB printer devices
        const devices = escpos.USB.findPrinter();
        if (devices.length === 0) {
          throw new Error('No USB printers found');
        }
        
        // Use the first printer found
        device = new escpos.USB(devices[0]);
        break;
        
      case CONNECTION_TYPES.SERIAL:
        device = new escpos.Serial(config.serialPort, {
          baudRate: config.baudRate
        });
        break;
        
      case CONNECTION_TYPES.NETWORK:
        device = new escpos.Network(
          config.networkHost,
          config.networkPort
        );
        break;
        
      default:
        throw new Error(`Unsupported connection type: ${config.connectionType}`);
    }
    
    // Create printer instance
    printer = new escpos.Printer(device);
    
    log(`Successfully connected to printer using ${config.connectionType}`);
    return { device, printer };
  } catch (error) {
    log(`Error connecting to printer: ${error.message}`);
    return null;
  }
}

/**
 * Monitor localStorage for print jobs
 */
function startMonitoring() {
  log('Starting ChainSync Print Service');
  log('Monitoring for print jobs...');
  
  // In a real implementation, this would use a browser extension or a native app
  // that can access both localStorage and the printer. For this sample script,
  // we're demonstrating the concept.
  
  setInterval(async () => {
    try {
      // In a real implementation, this would fetch from localStorage
      // For this demo, we'll check a mock localStorage
      const printJob = mockCheckLocalStorage();
      
      if (printJob && !processedJobs.has(printJob.timestamp)) {
        log(`New print job detected: ${printJob.timestamp}`);
        
        // Process the print job
        await processPrintJob(printJob);
        
        // Mark this job as processed
        processedJobs.add(printJob.timestamp);
        
        // Clean up processed jobs (keep only the last 100 jobs)
        if (processedJobs.size > 100) {
          const iterator = processedJobs.values();
          processedJobs.delete(iterator.next().value);
        }
      }
    } catch (error) {
      log(`Error in monitoring loop: ${error.message}`);
    }
  }, config.checkInterval);
}

/**
 * Process a print job
 */
async function processPrintJob(printJob) {
  log(`Processing print job for printer: ${printJob.printerId}`);
  
  // Decode the base64 commands
  const commands = Buffer.from(printJob.commands, 'base64');
  
  try {
    // Connect to printer
    const connection = await connectToPrinter();
    if (!connection) {
      throw new Error('Failed to connect to printer');
    }
    
    const { device, printer } = connection;
    
    // Open device
    device.open(function(error) {
      if (error) {
        log(`Error opening device: ${error.message}`);
        return;
      }
      
      // Send raw commands directly to the printer
      printer.raw(commands);
      
      // Close the connection
      printer.close();
      
      log('Print job sent successfully');
    });
  } catch (error) {
    log(`Error processing print job: ${error.message}`);
    throw error;
  }
}

/**
 * Mock function to simulate checking localStorage (for the sample script)
 * In a real implementation, this would access the browser's localStorage
 */
function mockCheckLocalStorage() {
  // This simulates checking localStorage for a print job
  // In a real implementation, this would be:
  // const printJob = JSON.parse(localStorage.getItem('chainsync_print_job'));
  // localStorage.removeItem('chainsync_print_job');
  
  // For testing, we'll return null most of the time (no new jobs)
  // and occasionally return a mock print job
  if (Math.random() < 0.05) { // 5% chance of a new job
    return {
      timestamp: new Date().toISOString(),
      printerId: 'default',
      commands: Buffer.from('\x1B@Hello World\n\x1D\x56\x01', 'utf8').toString('base64')
    };
  }
  
  return null;
}

/**
 * Main function
 */
function main() {
  log('ChainSync Local Print Service starting...');
  log(`Using ${config.connectionType} connection`);
  
  // Start monitoring for print jobs
  startMonitoring();
}

// Run the main function
main();