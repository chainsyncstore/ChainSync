# ChainSync Manager Deployment Guide

## Overview

This guide covers the deployment of ChainSync Manager across different environments and platforms.

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+
- Redis 6+
- Docker and Docker Compose (for containerized deployment)
- Git

## Environment Configuration

### Environment Variables

Create `.env` files for each environment:

#### Development (.env.development)
```bash
# Application
NODE_ENV=development
PORT=3000
HOST=localhost

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/chainsync_dev
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chainsync_dev
DB_USER=chainsync_user
DB_PASSWORD=secure_password

# Redis
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your-super-secret-jwt-key-development
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Payment Processing
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-secret

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# File Storage
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=chainsync-uploads

# Monitoring
SENTRY_DSN=your-sentry-dsn
LOG_LEVEL=debug
```

#### Production (.env.production)
```bash
# Application
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://username:password@prod-db:5432/chainsync_prod
DB_HOST=prod-db
DB_PORT=5432
DB_NAME=chainsync_prod
DB_USER=chainsync_user
DB_PASSWORD=very_secure_production_password

# Redis
REDIS_URL=redis://prod-redis:6379
REDIS_HOST=prod-redis
REDIS_PORT=6379
REDIS_PASSWORD=redis_production_password

# JWT
JWT_SECRET=your-super-secret-jwt-key-production
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Payment Processing
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
PAYPAL_CLIENT_ID=your-paypal-client-id-prod
PAYPAL_CLIENT_SECRET=your-paypal-secret-prod

# Email
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key

# File Storage
AWS_ACCESS_KEY_ID=your-aws-access-key-prod
AWS_SECRET_ACCESS_KEY=your-aws-secret-key-prod
AWS_REGION=us-east-1
AWS_S3_BUCKET=chainsync-uploads-prod

# Monitoring
SENTRY_DSN=your-sentry-dsn-prod
LOG_LEVEL=info
```

## Local Development Setup

### 1. Clone Repository
```bash
git clone https://github.com/your-org/chainsync-manager.git
cd chainsync-manager
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Database
```bash
# Start PostgreSQL and Redis (using Docker)
docker-compose up -d postgres redis

# Run migrations
npm run db:migrate

# Seed database
npm run db:seed
```

### 4. Start Development Server
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Docker Deployment

### Dockerfile
```dockerfile
# Multi-stage build for production
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

# Create necessary directories
RUN mkdir -p /app/logs /app/uploads
RUN chown -R nodejs:nodejs /app/logs /app/uploads

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node dist/health-check.js

# Start application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server/index.js"]
```

### Docker Compose
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://chainsync_user:password@postgres:5432/chainsync
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    restart: unless-stopped
    networks:
      - chainsync-network

  postgres:
    image: postgres:14-alpine
    environment:
      - POSTGRES_DB=chainsync
      - POSTGRES_USER=chainsync_user
      - POSTGRES_PASSWORD=secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    restart: unless-stopped
    networks:
      - chainsync-network

  redis:
    image: redis:6-alpine
    command: redis-server --requirepass redis_password
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    restart: unless-stopped
    networks:
      - chainsync-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped
    networks:
      - chainsync-network

volumes:
  postgres_data:
  redis_data:

networks:
  chainsync-network:
    driver: bridge
```

### Deploy with Docker
```bash
# Build and start services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

## Cloud Deployment

### AWS Deployment

#### 1. ECS Fargate Setup
```bash
# Create ECS cluster
aws ecs create-cluster --cluster-name chainsync-cluster

# Create task definition
aws ecs register-task-definition --cli-input-json file://task-definition.json

# Create service
aws ecs create-service --cli-input-json file://service-definition.json
```

#### 2. RDS Database Setup
```bash
# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier chainsync-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username chainsync_user \
  --master-user-password secure_password \
  --allocated-storage 20 \
  --storage-type gp2
```

#### 3. ElastiCache Redis Setup
```bash
# Create Redis cluster
aws elasticache create-cache-cluster \
  --cache-cluster-id chainsync-redis \
  --engine redis \
  --cache-node-type cache.t3.micro \
  --num-cache-nodes 1
```

### Google Cloud Platform

#### 1. Cloud Run Deployment
```bash
# Build and push image
gcloud builds submit --tag gcr.io/PROJECT_ID/chainsync-manager

# Deploy to Cloud Run
gcloud run deploy chainsync-manager \
  --image gcr.io/PROJECT_ID/chainsync-manager \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production
```

#### 2. Cloud SQL Setup
```bash
# Create Cloud SQL instance
gcloud sql instances create chainsync-db \
  --database-version=POSTGRES_14 \
  --tier=db-f1-micro \
  --region=us-central1
```

### Azure Deployment

#### 1. Container Instances
```bash
# Deploy to Azure Container Instances
az container create \
  --resource-group chainsync-rg \
  --name chainsync-app \
  --image chainsync-manager:latest \
  --dns-name-label chainsync-app \
  --ports 3000
```

## CI/CD Pipeline

### GitHub Actions
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test
      - run: npm run test:coverage

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v3
        with:
          name: build-artifacts
          path: dist/

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/download-artifact@v3
        with:
          name: build-artifacts
      - name: Deploy to production
        run: |
          # Deployment commands
          echo "Deploying to production..."
```

### GitLab CI
```yaml
stages:
  - test
  - build
  - deploy

test:
  stage: test
  image: node:18
  script:
    - npm ci
    - npm run test
    - npm run test:coverage

build:
  stage: build
  image: node:18
  script:
    - npm ci
    - npm run build
  artifacts:
    paths:
      - dist/

deploy:
  stage: deploy
  image: alpine
  script:
    - echo "Deploying to production..."
  only:
    - main
```

## Monitoring and Logging

### Application Monitoring
```javascript
// Sentry integration
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});

// Prometheus metrics
import prometheus from 'prom-client';
const collectDefaultMetrics = prometheus.collectDefaultMetrics;
collectDefaultMetrics();
```

### Health Checks
```javascript
// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await db.query('SELECT 1');
    
    // Check Redis connection
    await redis.ping();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version,
      services: {
        database: 'healthy',
        redis: 'healthy'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});
```

### Logging Configuration
```javascript
// Winston logger setup
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
```

## Security Considerations

### SSL/TLS Configuration
```nginx
# Nginx SSL configuration
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    
    location / {
        proxy_pass http://app:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Security Headers
```javascript
// Helmet security middleware
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

## Backup and Recovery

### Database Backup
```bash
#!/bin/bash
# Backup script

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
DB_NAME="chainsync"

# Create backup
pg_dump $DATABASE_URL > $BACKUP_DIR/backup_$DATE.sql

# Compress backup
gzip $BACKUP_DIR/backup_$DATE.sql

# Upload to S3
aws s3 cp $BACKUP_DIR/backup_$DATE.sql.gz s3://chainsync-backups/

# Clean old backups (keep 30 days)
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete
```

### Disaster Recovery Plan
1. **Database Recovery**
   ```bash
   # Restore from backup
   gunzip -c backup_20240101_120000.sql.gz | psql $DATABASE_URL
   ```

2. **Application Recovery**
   ```bash
   # Redeploy application
   docker-compose down
   docker-compose up -d
   ```

3. **Data Validation**
   ```bash
   # Run data integrity checks
   npm run db:validate
   ```

## Performance Optimization

### Database Optimization
```sql
-- Create indexes for better performance
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_products_category ON products(category);
```

### Caching Strategy
```javascript
// Redis caching
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// Cache middleware
const cache = (duration) => async (req, res, next) => {
  const key = `cache:${req.originalUrl}`;
  const cached = await redis.get(key);
  
  if (cached) {
    return res.json(JSON.parse(cached));
  }
  
  res.sendResponse = res.json;
  res.json = (body) => {
    redis.setex(key, duration, JSON.stringify(body));
    res.sendResponse(body);
  };
  
  next();
};
```

## Troubleshooting

### Common Issues

1. **Database Connection Issues**
   ```bash
   # Check database connectivity
   psql $DATABASE_URL -c "SELECT 1"
   
   # Check connection pool
   npm run db:status
   ```

2. **Redis Connection Issues**
   ```bash
   # Test Redis connection
   redis-cli ping
   
   # Check Redis memory usage
   redis-cli info memory
   ```

3. **Application Crashes**
   ```bash
   # Check application logs
   docker-compose logs app
   
   # Check system resources
   docker stats
   ```

### Performance Monitoring
```bash
# Monitor application performance
npm run monitor

# Check database performance
npm run db:analyze

# Monitor system resources
htop
```

## Support and Maintenance

### Regular Maintenance Tasks
- [ ] Database backups (daily)
- [ ] Log rotation (weekly)
- [ ] Security updates (monthly)
- [ ] Performance monitoring (continuous)
- [ ] SSL certificate renewal (yearly)

### Contact Information
- **Technical Support**: tech-support@chainsync.com
- **Emergency Contact**: emergency@chainsync.com
- **Documentation**: https://docs.chainsync.com
- **Status Page**: https://status.chainsync.com 