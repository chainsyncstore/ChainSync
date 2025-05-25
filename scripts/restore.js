#!/usr/bin/env node
/**
 * Database restore script for ChainSync
 * 
 * This script restores a PostgreSQL database from a backup file.
 * It can download the backup from S3 or use a local backup file.
 * 
 * Usage:
 *   node restore.js [--file=<path>] [--s3=<s3-key>] [--latest]
 * 
 * Options:
 *   --file=<path>  Path to local backup file
 *   --s3=<s3-key>  S3 key of backup to restore
 *   --latest       Restore the latest backup from S3
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { S3Client, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
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
  s3: {
    bucket: process.env.BACKUP_S3_BUCKET,
    region: process.env.AWS_REGION || 'us-east-1',
    path: process.env.BACKUP_S3_PATH || 'backups',
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
    s3Key: null,
    latest: false,
  };
  
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--file=')) {
      args.file = arg.substring(7);
    } else if (arg.startsWith('--s3=')) {
      args.s3Key = arg.substring(5);
    } else if (arg === '--latest') {
      args.latest = true;
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
 * Find the latest backup in S3
 */
async function findLatestBackup() {
  console.log('Finding latest backup in S3...');
  
  if (!config.s3.bucket) {
    throw new Error('S3 bucket not configured');
  }
  
  // Create S3 client
  const s3Client = new S3Client({ region: config.s3.region });
  
  // List objects in the bucket with the backup prefix
  const prefix = config.s3.path ? `${config.s3.path.replace(/\/$/, '')}/` : '';
  const command = new ListObjectsV2Command({
    Bucket: config.s3.bucket,
    Prefix: prefix,
  });
  
  try {
    const response = await s3Client.send(command);
    
    if (!response.Contents || response.Contents.length === 0) {
      throw new Error('No backup files found in S3');
    }
    
    // Filter for backup files and sort by last modified date
    const backups = response.Contents
      .filter(obj => obj.Key.includes('chainsync-backup-') && obj.Key.endsWith('.sql.gz'))
      .sort((a, b) => b.LastModified - a.LastModified);
    
    if (backups.length === 0) {
      throw new Error('No valid backup files found in S3');
    }
    
    const latestBackup = backups[0];
    console.log(`Latest backup found: ${latestBackup.Key} (${latestBackup.LastModified})`);
    
    return latestBackup.Key;
  } catch (error) {
    console.error('Error finding latest backup:', error);
    throw error;
  }
}

/**
 * Download backup file from S3
 */
async function downloadFromS3(s3Key) {
  console.log(`Downloading backup from S3: ${s3Key}`);
  
  if (!config.s3.bucket) {
    throw new Error('S3 bucket not configured');
  }
  
  // Create S3 client
  const s3Client = new S3Client({ region: config.s3.region });
  
  // Set up download command
  const command = new GetObjectCommand({
    Bucket: config.s3.bucket,
    Key: s3Key,
  });
  
  try {
    // Execute download
    const response = await s3Client.send(command);
    
    // Extract filename from S3 key
    const filename = path.basename(s3Key);
    const localFilePath = path.join(config.local.tempDir, filename);
    
    // Save the file
    const writeStream = fs.createWriteStream(localFilePath);
    response.Body.pipe(writeStream);
    
    return new Promise((resolve, reject) => {
      writeStream.on('finish', () => {
        console.log(`Backup downloaded to: ${localFilePath}`);
        resolve(localFilePath);
      });
      
      writeStream.on('error', (err) => {
        reject(new Error(`Failed to save backup file: ${err.message}`));
      });
    });
  } catch (error) {
    console.error('Error downloading backup from S3:', error);
    throw error;
  }
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
    } else if (args.s3Key) {
      // Download from S3 by key
      const downloadedPath = await downloadFromS3(args.s3Key);
      backupFilePath = downloadedPath;
    } else if (args.latest) {
      // Find and download latest backup from S3
      const latestKey = await findLatestBackup();
      const downloadedPath = await downloadFromS3(latestKey);
      backupFilePath = downloadedPath;
    } else {
      console.error('Error: No backup source specified. Use --file, --s3, or --latest');
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
