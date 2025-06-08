# ChainSync Production Readiness Implementation Plan

## Overview

This document provides a detailed, actionable implementation plan to take ChainSync from its current production readiness score of 72/100 to 90+ within 8-10 weeks.

## Phase 1: Critical Security & Infrastructure (Weeks 1-2)

### Week 1: Security Foundation

#### Day 1-2: Authentication & Authorization System

```typescript
// server/middleware/auth-enhanced.ts
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';

interface JWTPayload {
  userId: string;
  role: string;
  permissions: string[];
  sessionId: string;
}

class AuthenticationService {
  private refreshTokens = new Map<string, string>();

  async generateTokenPair(user: User): Promise<{ accessToken: string; refreshToken: string }> {
    const sessionId = crypto.randomUUID();

    const accessToken = jwt.sign(
      { userId: user.id, role: user.role, permissions: user.permissions, sessionId },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign({ userId: user.id, sessionId }, process.env.JWT_REFRESH_SECRET!, {
      expiresIn: '7d',
    });

    this.refreshTokens.set(sessionId, refreshToken);
    return { accessToken, refreshToken };
  }

  async validateToken(token: string): Promise<JWTPayload | null> {
    try {
      return jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    } catch {
      return null;
    }
  }
}

// Role-based access control middleware
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as JWTPayload;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// Rate limiting for auth endpoints
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many authentication attempts',
  standardHeaders: true,
  legacyHeaders: false,
});
```

#### Day 3-4: Input Validation & Sanitization

```typescript
// server/middleware/validation-enhanced.ts
import { body, param, query, validationResult } from 'express-validator';
import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';

export class InputValidator {
  static sanitizeString(input: string): string {
    return DOMPurify.sanitize(validator.escape(input));
  }

  static validateEmail(email: string): boolean {
    return validator.isEmail(email) && !this.containsSQLInjection(email);
  }

  static containsSQLInjection(input: string): boolean {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
      /(--|\/\*|\*\/|;|'|"|`)/,
      /(\bOR\b|\bAND\b).*?[=<>]/i,
    ];
    return sqlPatterns.some(pattern => pattern.test(input));
  }

  static validateTransaction() {
    return [
      body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be positive'),
      body('customerId').isUUID().withMessage('Invalid customer ID'),
      body('items').isArray({ min: 1 }).withMessage('Items array required'),
      body('items.*.productId').isUUID().withMessage('Invalid product ID'),
      body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be positive'),
      this.handleValidationErrors,
    ];
  }

  static handleValidationErrors(req: Request, res: Response, next: NextFunction) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
    }
    next();
  }
}

// SQL injection prevention for raw queries
export const sanitizeQuery = (query: string, params: any[]): { query: string; params: any[] } => {
  // Use parameterized queries only
  if (InputValidator.containsSQLInjection(query)) {
    throw new Error('Potential SQL injection detected');
  }

  const sanitizedParams = params.map(param => {
    if (typeof param === 'string') {
      return InputValidator.sanitizeString(param);
    }
    return param;
  });

  return { query, params: sanitizedParams };
};
```

#### Day 5: Security Headers & CSRF Protection

```typescript
// server/middleware/security-enhanced.ts
import helmet from 'helmet';
import csrf from 'csurf';
import cors from 'cors';

export const securityMiddleware = [
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }),

  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  }),

  csrf({
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    },
  }),
];

// Rate limiting by endpoint type
export const createRateLimit = (windowMs: number, max: number) => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil(windowMs / 1000),
      });
    },
  });
};

export const rateLimits = {
  general: createRateLimit(15 * 60 * 1000, 100), // 100 requests per 15 minutes
  auth: createRateLimit(15 * 60 * 1000, 5), // 5 auth attempts per 15 minutes
  api: createRateLimit(60 * 1000, 60), // 60 API calls per minute
  admin: createRateLimit(60 * 1000, 20), // 20 admin actions per minute
};
```

### Week 2: Infrastructure & Monitoring

#### Day 1-2: Health Check System

```typescript
// server/routes/health-enhanced.ts
import { Router } from 'express';
import { Pool } from 'pg';
import Redis from 'ioredis';

interface HealthCheck {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  details?: any;
}

class HealthMonitor {
  constructor(
    private db: Pool,
    private redis: Redis,
    private dependencies: Map<string, () => Promise<boolean>>
  ) {}

  async checkDatabase(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      await this.db.query('SELECT 1');
      return {
        service: 'database',
        status: 'healthy',
        responseTime: Date.now() - start,
      };
    } catch (error) {
      return {
        service: 'database',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        details: error.message,
      };
    }
  }

  async checkRedis(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      await this.redis.ping();
      return {
        service: 'redis',
        status: 'healthy',
        responseTime: Date.now() - start,
      };
    } catch (error) {
      return {
        service: 'redis',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        details: error.message,
      };
    }
  }

  async checkExternalDependencies(): Promise<HealthCheck[]> {
    const checks: HealthCheck[] = [];

    for (const [name, checkFn] of this.dependencies) {
      const start = Date.now();
      try {
        const isHealthy = await checkFn();
        checks.push({
          service: name,
          status: isHealthy ? 'healthy' : 'unhealthy',
          responseTime: Date.now() - start,
        });
      } catch (error) {
        checks.push({
          service: name,
          status: 'unhealthy',
          responseTime: Date.now() - start,
          details: error.message,
        });
      }
    }

    return checks;
  }

  async getOverallHealth(): Promise<{
    status: 'healthy' | 'unhealthy' | 'degraded';
    checks: HealthCheck[];
    timestamp: string;
  }> {
    const checks = [
      await this.checkDatabase(),
      await this.checkRedis(),
      ...(await this.checkExternalDependencies()),
    ];

    const unhealthyCount = checks.filter(c => c.status === 'unhealthy').length;
    const degradedCount = checks.filter(c => c.status === 'degraded').length;

    let overallStatus: 'healthy' | 'unhealthy' | 'degraded';
    if (unhealthyCount > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedCount > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    return {
      status: overallStatus,
      checks,
      timestamp: new Date().toISOString(),
    };
  }
}

export const createHealthRouter = (healthMonitor: HealthMonitor) => {
  const router = Router();

  // Liveness probe - basic server health
  router.get('/live', (req, res) => {
    res.status(200).json({ status: 'alive', timestamp: new Date().toISOString() });
  });

  // Readiness probe - ready to serve traffic
  router.get('/ready', async (req, res) => {
    const health = await healthMonitor.getOverallHealth();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  });

  // Detailed health check
  router.get('/health', async (req, res) => {
    const health = await healthMonitor.getOverallHealth();
    res.json(health);
  });

  return router;
};
```

#### Day 3-4: Secrets Management & Environment Configuration

```typescript
// server/config/secrets-manager.ts
import { SecretsManager } from 'aws-sdk';
import { readFileSync } from 'fs';

interface SecretConfig {
  name: string;
  required: boolean;
  defaultValue?: string;
}

class SecretsService {
  private secrets = new Map<string, string>();
  private secretsManager?: SecretsManager;

  constructor() {
    if (process.env.AWS_REGION) {
      this.secretsManager = new SecretsManager({
        region: process.env.AWS_REGION,
      });
    }
  }

  async loadSecrets(configs: SecretConfig[]): Promise<void> {
    for (const config of configs) {
      let value: string | undefined;

      // Try environment variable first
      value = process.env[config.name];

      // Try AWS Secrets Manager
      if (!value && this.secretsManager) {
        try {
          const result = await this.secretsManager
            .getSecretValue({
              SecretId: config.name,
            })
            .promise();
          value = result.SecretString;
        } catch (error) {
          console.warn(`Failed to load secret ${config.name} from AWS:`, error.message);
        }
      }

      // Try local file (for development)
      if (!value && process.env.NODE_ENV === 'development') {
        try {
          value = readFileSync(`/run/secrets/${config.name}`, 'utf8').trim();
        } catch {
          // File doesn't exist, continue
        }
      }

      // Use default value
      if (!value) {
        value = config.defaultValue;
      }

      // Check if required secret is missing
      if (!value && config.required) {
        throw new Error(`Required secret ${config.name} is not available`);
      }

      if (value) {
        this.secrets.set(config.name, value);
      }
    }
  }

  get(name: string): string | undefined {
    return this.secrets.get(name);
  }

  getRequired(name: string): string {
    const value = this.secrets.get(name);
    if (!value) {
      throw new Error(`Required secret ${name} is not available`);
    }
    return value;
  }
}

// Environment-specific configuration
export const secretConfigs: SecretConfig[] = [
  { name: 'DATABASE_URL', required: true },
  { name: 'REDIS_URL', required: true },
  { name: 'JWT_SECRET', required: true },
  { name: 'JWT_REFRESH_SECRET', required: true },
  { name: 'ENCRYPTION_KEY', required: true },
  { name: 'SENTRY_DSN', required: false },
  { name: 'STRIPE_SECRET_KEY', required: false },
  { name: 'SENDGRID_API_KEY', required: false },
];

export const secretsService = new SecretsService();
```

#### Day 5: Audit Logging System

```typescript
// server/utils/audit-logger.ts
import { Pool } from 'pg';

interface AuditEvent {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
}

class AuditLogger {
  constructor(private db: Pool) {}

  async log(event: Omit<AuditEvent, 'timestamp'>): Promise<void> {
    const auditEvent: AuditEvent = {
      ...event,
      timestamp: new Date(),
    };

    try {
      await this.db.query(
        `
        INSERT INTO audit_logs (
          user_id, action, resource, resource_id, details,
          ip_address, user_agent, timestamp, success, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
        [
          auditEvent.userId,
          auditEvent.action,
          auditEvent.resource,
          auditEvent.resourceId,
          JSON.stringify(auditEvent.details),
          auditEvent.ipAddress,
          auditEvent.userAgent,
          auditEvent.timestamp,
          auditEvent.success,
          auditEvent.errorMessage,
        ]
      );
    } catch (error) {
      console.error('Failed to write audit log:', error);
      // Don't throw - audit logging shouldn't break the main flow
    }
  }

  async logTransaction(
    userId: string,
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    transactionId: string,
    details: any,
    req: Request
  ): Promise<void> {
    await this.log({
      userId,
      action: `TRANSACTION_${action}`,
      resource: 'transaction',
      resourceId: transactionId,
      details,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success: true,
    });
  }

  async logAuthEvent(
    action: 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED',
    userId?: string,
    req?: Request,
    error?: string
  ): Promise<void> {
    await this.log({
      userId,
      action: `AUTH_${action}`,
      resource: 'authentication',
      ipAddress: req?.ip,
      userAgent: req?.get('User-Agent'),
      success: !error,
      errorMessage: error,
    });
  }
}

// Middleware to automatically log API calls
export const auditMiddleware = (auditLogger: AuditLogger) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;

    res.send = function (data) {
      // Log the API call after response
      setImmediate(() => {
        auditLogger.log({
          userId: req.user?.userId,
          action: `API_${req.method}`,
          resource: req.route?.path || req.path,
          details: {
            method: req.method,
            path: req.path,
            query: req.query,
            statusCode: res.statusCode,
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          success: res.statusCode < 400,
        });
      });

      return originalSend.call(this, data);
    };

    next();
  };
};

export const auditLogger = new AuditLogger(/* db pool */);
```

## Phase 2: Performance & Monitoring (Weeks 3-4)

### Week 3: Caching & Database Optimization

#### Day 1-2: Redis Caching Implementation

```typescript
// server/cache/redis-enhanced.ts
import Redis from 'ioredis';
import { promisify } from 'util';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // For cache invalidation
  compress?: boolean; // Compress large values
}

class CacheService {
  private redis: Redis;
  private defaultTTL = 3600; // 1 hour

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.redis.on('error', error => {
      console.error('Redis error:', error);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (!value) return null;

      const parsed = JSON.parse(value);
      return parsed.compressed ? JSON.parse(await this.decompress(parsed.data)) : parsed.data;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, options: CacheOptions = {}): Promise<void> {
    try {
      const ttl = options.ttl || this.defaultTTL;
      const serialized = JSON.stringify(value);

      let cacheValue: any;
      if (options.compress && serialized.length > 1024) {
        cacheValue = {
          compressed: true,
          data: await this.compress(serialized),
        };
      } else {
        cacheValue = {
          compressed: false,
          data: value,
        };
      }

      await this.redis.setex(key, ttl, JSON.stringify(cacheValue));

      // Add to tag sets for invalidation
      if (options.tags) {
        for (const tag of options.tags) {
          await this.redis.sadd(`tag:${tag}`, key);
          await this.redis.expire(`tag:${tag}`, ttl);
        }
      }
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async invalidateByTag(tag: string): Promise<void> {
    try {
      const keys = await this.redis.smembers(`tag:${tag}`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        await this.redis.del(`tag:${tag}`);
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('Cache pattern invalidation error:', error);
    }
  }

  // Cache-aside pattern helper
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    let value = await this.get<T>(key);

    if (value === null) {
      value = await fetchFn();
      await this.set(key, value, options);
    }

    return value;
  }

  private async compress(data: string): Promise<string> {
    const zlib = await import('zlib');
    const gzip = promisify(zlib.gzip);
    const compressed = await gzip(Buffer.from(data));
    return compressed.toString('base64');
  }

  private async decompress(data: string): Promise<string> {
    const zlib = await import('zlib');
    const gunzip = promisify(zlib.gunzip);
    const decompressed = await gunzip(Buffer.from(data, 'base64'));
    return decompressed.toString();
  }
}

// Caching decorators for services
export const cached = (options: CacheOptions & { keyGenerator?: (...args: any[]) => string }) => {
  return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = options.keyGenerator
        ? options.keyGenerator(...args)
        : `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;

      return cacheService.getOrSet(cacheKey, () => method.apply(this, args), options);
    };
  };
};

export const cacheService = new CacheService(process.env.REDIS_URL!);
```

#### Day 3-4: Database Query Optimization

```typescript
// server/utils/query-optimizer.ts
import { Pool } from 'pg';
import { queryMonitor } from './database-optimization';

class QueryOptimizer {
  constructor(private db: Pool) {}

  // Analyze and optimize common queries
  async analyzeSlowQueries(): Promise<
    {
      query: string;
      avgDuration: number;
      callCount: number;
      optimization: string;
    }[]
  > {
    const slowQueries = queryMonitor.getSlowQueries(20);
    const analysis = [];

    for (const query of slowQueries) {
      const optimization = await this.suggestOptimization(query.query);
      analysis.push({
        query: query.query,
        avgDuration: query.duration,
        callCount: 1, // Would need to aggregate in real implementation
        optimization,
      });
    }

    return analysis;
  }

  private async suggestOptimization(query: string): Promise<string> {
    // Analyze query patterns and suggest optimizations
    const suggestions = [];

    if (query.includes('SELECT *')) {
      suggestions.push('Use specific column names instead of SELECT *');
    }

    if (query.includes('WHERE') && !query.includes('INDEX')) {
      suggestions.push('Consider adding indexes on WHERE clause columns');
    }

    if (query.includes('ORDER BY') && !query.includes('LIMIT')) {
      suggestions.push('Consider adding LIMIT to ORDER BY queries');
    }

    if (query.includes('JOIN') && query.split('JOIN').length > 3) {
      suggestions.push('Consider breaking complex JOINs into smaller queries');
    }

    return suggestions.join('; ') || 'No specific optimizations suggested';
  }

  // Batch operations for better performance
  async batchInsert(table: string, records: any[], batchSize = 1000): Promise<void> {
    const batches = [];
    for (let i = 0; i < records.length; i += batchSize) {
      batches.push(records.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      const columns = Object.keys(batch[0]);
      const values = batch.map(record => columns.map(col => record[col]));

      const placeholders = values
        .map((_, i) => `(${columns.map((_, j) => `$${i * columns.length + j + 1}`).join(', ')})`)
        .join(', ');

      const query = `
        INSERT INTO ${table} (${columns.join(', ')})
        VALUES ${placeholders}
      `;

      await this.db.query(query, values.flat());
    }
  }

  // Connection pool optimization
  async optimizeConnectionPool(): Promise<void> {
    const stats = await this.getPoolStats();

    if (stats.avgWaitTime > 100) {
      // ms
      console.warn('High connection wait time detected. Consider increasing pool size.');
    }

    if (stats.idleConnections / stats.totalConnections > 0.8) {
      console.warn('High idle connection ratio. Consider decreasing pool size.');
    }
  }

  private async getPoolStats() {
    return {
      totalConnections: this.db.totalCount,
      idleConnections: this.db.idleCount,
      waitingClients: this.db.waitingCount,
      avgWaitTime: 0, // Would need to track this
    };
  }
}

export const queryOptimizer = new QueryOptimizer(/* db pool */);
```

### Week 4: Application Performance Monitoring

#### Day 1-2: APM Integration

```typescript
// server/monitoring/apm.ts
import * as Sentry from '@sentry/node';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

class APMService {
  private sdk?: NodeSDK;

  initialize(): void {
    // Initialize Sentry for error tracking
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.Express({ app: /* express app */ }),
        new Sentry.Integrations.Postgres()
      ]
    });

    // Initialize OpenTelemetry
    this.sdk = new NodeSDK({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: 'chainsync',
        [SemanticResourceAttributes.SERVICE_VERSION]: process.env.APP_VERSION || '1.0.0',
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV
      }),
      instrumentations: [
        // Auto-instrumentation for common libraries
      ]
    });

    this.sdk.start();
  }

  // Custom metrics
  recordMetric(name: string, value: number, tags: Record<string, string> = {}): void {
    // Implementation depends on your metrics backend (Prometheus, DataDog, etc.)
    console.log(`Metric: ${name} = ${value}`, tags);
  }

  // Performance tracking
  async trackPerformance<T>(
    operation: string,
    fn: () => Promise<T>,
    tags: Record<string, string> = {}
  ): Promise<T> {
    const start = Date.now();
    const span = Sentry.startTransaction({ name: operation, ...tags });

    try {
      const result = await fn();
      const duration = Date.now() - start;

      this.recordMetric(`operation.duration`, duration, { operation, ...tags });
      span.setStatus({ code: 1 }); // OK

      return result;
    } catch (error) {
      const duration = Date.now() - start;

      this.recordMetric(`operation.error`, 1, { operation, ...tags });
      this.recordMetric(`operation.duration`, duration, { operation, status: 'error', ...tags });

      span.setStatus({ code: 2, message: error.message }); // ERROR
      Sentry.captureException(error);

      throw error;
    } finally {
      span.finish();
    }
  }

  // Business metrics
  recordBusinessMetric(metric: string, value: number, metadata?: any): void {
    this.recordMetric(`business.${metric}`, value, metadata);

    // Also log to audit trail for important business events
    if (['transaction.created', 'payment.processed', 'inventory.updated'].includes(metric)) {
      console.log(`Business Event: ${metric}`, { value, metadata, timestamp: new Date() });
    }
  }
}

export const apmService = new APMService();

// Middleware for automatic request tracking
export const apmMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const transaction = Sentry.startTransaction({
    op: 'http.server',
    name: `${req.method} ${req.route?.path || req.path}`,
    data: {
      method: req.method,
      url: req.url,
      headers: req.headers
    }
  });

  res.on('finish', () => {
    transaction.setHttpStatus(res.statusCode);
    transaction.finish();
  });

  next();
};
```

## Phase 3: Data Protection & Compliance (Weeks 5-6)

### Week 5: Data Encryption & Security

#### Day 1-2: Data Encryption Implementation

```typescript
// server/utils/encryption.ts
import crypto from 'crypto';
import bcrypt from 'bcrypt';

class Encrypt
```
