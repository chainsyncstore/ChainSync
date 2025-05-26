#!/usr/bin/env node
/**
 * Database restore script for ChainSync
 * 
 * This script restores a PostgreSQL database from a backup file.
 * It restores the database using a local backup file only.
 * 
 * Usage:
 *   node restore.js [--file=<path>]
 * 
 * Options:
 *   --file=<path>  Path to local backup file
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const dotenv = require('dotenv');
const readline = require('readline');

// Load environment variables
dotenv.config();

// Restore configuration
const config = {
  database: {
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || '5432',
    name: process.env.DB_NAME || 'chainsync',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
  },

  local: {
    backupDir: process.env.BACKUP_DIR || path.join(__dirname, '../backups'),
    tempDir: path.join(__dirname, '../tmp'),
  }
};

// Create temp directory if it doesn't exist
if (!fs.existsSync(config.local.tempDir)) {
  fs.mkdirSync(config.local.tempDir, { recursive: true });
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = {
    file: null,

    latest: false,
  };
  
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--file=')) {
      args.file = arg.substring(7);

    }
  });
  
  return args;
}

/**
 * Ask for confirmation before proceeding
 */
async function confirmRestore() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question('\n⚠️ WARNING: This will overwrite the existing database. Are you sure you want to proceed? (yes/no): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Decompress a gzipped backup file
 */
async function decompressBackup(filePath) {
  console.log(`Decompressing backup file: ${filePath}`);
  
  // Extract base filename without .gz
  const outputPath = filePath.replace(/\.gz$/, '');
  
  return new Promise((resolve, reject) => {
    const gunzip = spawn('gunzip', ['-c', filePath]);
    const writeStream = fs.createWriteStream(outputPath);
    
    gunzip.stdout.pipe(writeStream);
    
    gunzip.on('error', (err) => {
      reject(new Error(`Decompression failed: ${err.message}`));
    });
    
    writeStream.on('finish', () => {
      console.log(`Backup decompressed to: ${outputPath}`);
      resolve(outputPath);
    });
    
    writeStream.on('error', (err) => {
      reject(new Error(`Failed to write decompressed file: ${err.message}`));
    });
  });
}

/**
 * Restore database from a SQL backup file
 */
async function restoreDatabase(filePath) {
  console.log(`Restoring database from: ${filePath}`);
  
  // Parse connection string if available
  let dbConfig = { ...config.database };
  if (dbConfig.url) {
    try {
      const url = new URL(dbConfig.url);
      dbConfig = {
        host: url.hostname,
        port: url.port,
        name: url.pathname.substring(1),
        user: url.username,
        password: url.password,
      };
    } catch (error) {
      console.warn('Failed to parse DATABASE_URL, using individual settings', error);
    }
  }
  
  return new Promise((resolve, reject) => {
    // Set up psql command
    const psqlArgs = [
      '-h', dbConfig.host,
      '-p', dbConfig.port,
      '-U', dbConfig.user,
      '-d', dbConfig.name,
      '-f', filePath
    ];
    
    // Set up environment for psql
    const env = { ...process.env, PGPASSWORD: dbConfig.password };
    
    // Execute psql
    const psql = spawn('psql', psqlArgs, { env });
    
    psql.stdout.on('data', (data) => {
      console.log(`psql: ${data}`);
    });
    
    psql.stderr.on('data', (data) => {
      console.log(`psql stderr: ${data}`);
    });
    
    psql.on('close', (code) => {
      if (code === 0) {
        console.log('Database restore completed successfully');
        resolve();
      } else {
        reject(new Error(`psql process exited with code ${code}`));
      }
    });
  });
}

/**
 * Clean up temporary files
 */
function cleanupTempFiles(filePath) {
  try {
    // Remove decompressed SQL file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Removed temporary file: ${filePath}`);
    }
    
    // Remove compressed file if it's in the temp directory
    const gzipPath = `${filePath}.gz`;
    if (gzipPath.includes(config.local.tempDir) && fs.existsSync(gzipPath)) {
      fs.unlinkSync(gzipPath);
      console.log(`Removed temporary file: ${gzipPath}`);
    }
  } catch (error) {
    console.warn('Error cleaning up temporary files:', error);
    // Continue even if cleanup fails
  }
}

/**
 * Main restore process
 */
async function runRestore() {
  try {
    // Parse command line arguments
    const args = parseArgs();
    
    // Determine which backup to restore
    let backupFilePath;
    
    if (args.file) {
      // Use local file
      backupFilePath = args.file;
      console.log(`Using local backup file: ${backupFilePath}`);
    } else {
      console.error('Error: No backup source specified. Use --file');
      process.exit(1);
    }
    
    // Confirm before proceeding
    const confirmed = await confirmRestore();
    if (!confirmed) {
      console.log('Restore cancelled');
      process.exit(0);
    }
    
    // Decompress if it's a gzipped file
    let sqlFilePath = backupFilePath;
    if (backupFilePath.endsWith('.gz')) {
      sqlFilePath = await decompressBackup(backupFilePath);
    }
    
    // Restore the database
    await restoreDatabase(sqlFilePath);
    
    // Clean up temporary files
    cleanupTempFiles(sqlFilePath);
    
    console.log('Restore process completed successfully');
  } catch (error) {
    console.error('Restore process failed:', error);
    process.exit(1);
  }
}

// Run the restore process
runRestore();
