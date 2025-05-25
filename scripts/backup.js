#!/usr/bin/env node
/**
 * Database backup script for ChainSync
 * 
 * This script creates a full backup of the PostgreSQL database
 * and uploads it to an S3 bucket for secure storage.
 * 
 * Usage:
 *   node backup.js [--upload]
 * 
 * Options:
 *   --upload  Upload the backup to S3 (requires AWS credentials)
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Backup configuration
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
    retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '7', 10),
  }
};

// Create backup directory if it doesn't exist
if (!fs.existsSync(config.local.backupDir)) {
  fs.mkdirSync(config.local.backupDir, { recursive: true });
}

// Generate backup filename with timestamp
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFilename = `chainsync-backup-${timestamp}.sql`;
const backupFilePath = path.join(config.local.backupDir, backupFilename);

// Compression options
const compressedFilename = `${backupFilename}.gz`;
const compressedFilePath = path.join(config.local.backupDir, compressedFilename);

/**
 * Create a database backup using pg_dump
 */
async function createBackup() {
  console.log(`Creating database backup: ${backupFilename}`);
  
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
    // Set up pg_dump command
    const pgDumpArgs = [
      '-h', dbConfig.host,
      '-p', dbConfig.port,
      '-U', dbConfig.user,
      '-F', 'p', // plain text format
      '-b', // include large objects
      '-v', // verbose
      '-f', backupFilePath,
      dbConfig.name
    ];
    
    // Set up environment for pg_dump
    const env = { ...process.env, PGPASSWORD: dbConfig.password };
    
    // Execute pg_dump
    const pgDump = spawn('pg_dump', pgDumpArgs, { env });
    
    pgDump.stdout.on('data', (data) => {
      console.log(`pg_dump: ${data}`);
    });
    
    pgDump.stderr.on('data', (data) => {
      console.log(`pg_dump stderr: ${data}`);
    });
    
    pgDump.on('close', (code) => {
      if (code === 0) {
        console.log(`Database backup created successfully: ${backupFilePath}`);
        resolve(backupFilePath);
      } else {
        reject(new Error(`pg_dump process exited with code ${code}`));
      }
    });
  });
}

/**
 * Compress the backup file using gzip
 */
async function compressBackup() {
  console.log(`Compressing backup: ${backupFilename}`);
  
  return new Promise((resolve, reject) => {
    const gzip = spawn('gzip', ['-9', '-f', backupFilePath]);
    
    gzip.on('close', (code) => {
      if (code === 0) {
        console.log(`Backup compressed successfully: ${compressedFilePath}`);
        resolve(compressedFilePath);
      } else {
        reject(new Error(`gzip process exited with code ${code}`));
      }
    });
  });
}

/**
 * Upload the compressed backup to S3
 */
async function uploadToS3() {
  if (!config.s3.bucket) {
    console.warn('S3 bucket not configured, skipping upload');
    return null;
  }
  
  console.log(`Uploading backup to S3: ${config.s3.bucket}`);
  
  try {
    // Create S3 client
    const s3Client = new S3Client({ region: config.s3.region });
    
    // Read the compressed file
    const fileContent = fs.readFileSync(compressedFilePath);
    
    // S3 key with path prefix if configured
    const s3Key = config.s3.path 
      ? `${config.s3.path.replace(/\/$/, '')}/${compressedFilename}`
      : compressedFilename;
    
    // Upload command
    const command = new PutObjectCommand({
      Bucket: config.s3.bucket,
      Key: s3Key,
      Body: fileContent,
      ContentType: 'application/gzip',
      ServerSideEncryption: 'AES256',
    });
    
    // Execute upload
    const response = await s3Client.send(command);
    
    console.log(`Backup uploaded successfully to s3://${config.s3.bucket}/${s3Key}`);
    return s3Key;
  } catch (error) {
    console.error('Error uploading backup to S3:', error);
    throw error;
  }
}

/**
 * Clean up old backup files based on retention policy
 */
function cleanupOldBackups() {
  console.log(`Cleaning up backups older than ${config.local.retentionDays} days`);
  
  try {
    const files = fs.readdirSync(config.local.backupDir);
    const now = new Date();
    
    let deletedCount = 0;
    
    files.forEach(file => {
      if (!file.startsWith('chainsync-backup-')) {
        return; // Skip non-backup files
      }
      
      const filePath = path.join(config.local.backupDir, file);
      const stats = fs.statSync(filePath);
      const fileAge = (now - stats.mtime) / (1000 * 60 * 60 * 24); // Age in days
      
      if (fileAge > config.local.retentionDays) {
        fs.unlinkSync(filePath);
        deletedCount++;
        console.log(`Deleted old backup: ${file}`);
      }
    });
    
    console.log(`Cleanup complete. Deleted ${deletedCount} old backup files.`);
  } catch (error) {
    console.error('Error cleaning up old backups:', error);
    // Continue with other operations even if cleanup fails
  }
}

/**
 * Main backup process
 */
async function runBackup() {
  try {
    // Create database backup
    await createBackup();
    
    // Compress the backup
    await compressBackup();
    
    // Upload to S3 if requested
    if (process.argv.includes('--upload')) {
      await uploadToS3();
    }
    
    // Clean up old backups
    cleanupOldBackups();
    
    console.log('Backup process completed successfully');
  } catch (error) {
    console.error('Backup process failed:', error);
    process.exit(1);
  }
}

// Run the backup process
runBackup();
