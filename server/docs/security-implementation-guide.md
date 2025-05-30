# Security Implementation Guide

This guide provides practical steps for developers to implement the security improvements throughout the ChainSync codebase.

## 1. Using the Unified Authentication Service

Replace the existing authentication logic with the new `UnifiedAuthService`:

```typescript
import { UnifiedAuthService } from '../services/auth/unified-auth-service';

// Create singleton instance
const authService = new UnifiedAuthService();

// Use in your route handlers
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const metadata = { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
  
  const result = await authService.login(email, password, metadata);
  
  if (!result) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }
  
  // Return tokens and user data
  res.json({
    success: true,
    data: {
      user: result.user,
      token: result.tokens.accessToken
    }
  });
});
```

## 2. Implementing Secure Authentication Middleware

Replace existing middleware with the secure version:

```typescript
import { authenticateJWT, requireAuth, requireRole } from '../middleware/secure-auth';

// Apply middleware to routes
app.use('/api', authenticateJWT); // Parse token for all API routes
app.use('/api/admin', requireAuth, requireRole(['admin'])); // Protected admin routes
app.use('/api/manager', requireAuth, requireRole(['admin', 'manager'])); // Protected manager routes
```

## 3. Preventing SQL Injection

When working with database queries, always use parameterized queries:

```typescript
// BAD - Vulnerable to SQL injection
const result = await db.execute(
  'SELECT * FROM users WHERE id = ' + userId
);

// GOOD - Safe from SQL injection
const result = await db.query(
  'SELECT * FROM users WHERE id = $1',
  [userId]
);
```

If the database library doesn't support parameterized queries, sanitize inputs:

```typescript
function sanitizeSqlInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Escape single quotes
  return input.replace(/'/g, "''");
}

const safeUserId = sanitizeSqlInput(userId);
const result = await db.execute(
  `SELECT * FROM users WHERE id = '${safeUserId}'`
);
```

## 4. Using SecureXlsx for File Processing

Replace direct xlsx usage with the secure wrapper:

```typescript
import { SecureXlsx } from '../utils/secure-xlsx';

// Process Excel files safely
app.post('/api/import', upload.single('file'), async (req, res) => {
  try {
    // Use the secure wrapper instead of xlsx directly
    const workbook = await SecureXlsx.read(req.file.path, {
      maxSize: 5 * 1024 * 1024, // 5MB limit
      maxSheets: 10,
      maxRows: 1000,
      trustLevel: 'low' // Only allow basic data
    });
    
    // Process the data...
    
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});
```

## 5. Secure Error Handling

Implement consistent error handling that doesn't leak sensitive information:

```typescript
// Centralized error handler middleware
app.use((err, req, res, next) => {
  // Log detailed error for debugging
  logger.error('API Error', {
    error: err,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });
  
  // Return sanitized error to client
  if (err instanceof AppError) {
    return res.status(err.statusCode || 400).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details // Only include safe details
      }
    });
  }
  
  // For all other errors, return a generic message
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }
  });
});
```

## 6. Secrets Management

Use the updated SecretsManager for sensitive data:

```typescript
import { SecretsManager } from '../config/secrets';

// Initialize with encryption key from environment
const secretsManager = new SecretsManager();

// Encrypt sensitive data
const encrypted = await secretsManager.encrypt('sensitive data');

// Decrypt when needed
const decrypted = await secretsManager.decrypt(encrypted);
```

## 7. File Validation

Use enhanced file validation for uploads:

```typescript
import { FileUtils } from '../utils/file-utils';

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    // Validate the file
    const validationResult = await FileUtils.validateFile(
      req.file.path,
      req.file.mimetype,
      'high' // Trust level
    );
    
    if (!validationResult.valid) {
      return res.status(400).json({
        success: false,
        message: validationResult.message
      });
    }
    
    // Process the file...
    
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});
```

## Migration Strategy

To safely implement these security improvements:

1. **Start with authentication**: Replace the authentication system first since it's a critical security component
2. **Audit SQL queries**: Systematically review and update all database queries to use parameterized queries
3. **File handling**: Update all file upload and processing code to use the secure implementations
4. **Error handling**: Standardize error handling across the application
5. **Testing**: Thoroughly test each change in a staging environment before deploying to production

## Monitoring and Verification

After implementation:

1. **Logging**: Ensure comprehensive logging is in place for security events
2. **Alerting**: Set up alerts for suspicious activity (failed logins, unusual file uploads)
3. **Penetration testing**: Conduct penetration testing to verify the security improvements
4. **Regular audits**: Schedule regular code reviews and security audits
