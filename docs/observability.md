# ChainSync Observability and Monitoring

This document provides an overview of the observability and monitoring features implemented in the ChainSync application. These features are designed to improve system reliability, facilitate debugging, and enable proactive issue detection.

## Table of Contents
1. [Health Checks](#health-checks)
2. [Metrics Collection](#metrics-collection)
3. [Alerting System](#alerting-system)
4. [Distributed Tracing](#distributed-tracing)
5. [Health Dashboard](#health-dashboard)
6. [Security Monitoring](#security-monitoring)
7. [Usage and Configuration](#usage-and-configuration)

## Health Checks

Health check endpoints provide real-time status of system components:

- **`/healthz`**: Kubernetes liveness probe - indicates if the application is running
- **`/readyz`**: Kubernetes readiness probe - indicates if the application is ready to accept traffic
- **`/health`**: Detailed health check - provides status of all system components

Each health check monitors critical dependencies:

| Component | Description | Failure Impact |
|-----------|-------------|----------------|
| Database  | Verifies PostgreSQL connectivity | Critical - Application cannot function without database |
| Redis     | Checks Redis server connection | High - Caching and session management affected |
| Message Queue | Validates job queue health | Medium - Background processing delayed |

## Metrics Collection

The metrics system collects and exposes various performance indicators:

- **HTTP Metrics**: Request counts, duration, status codes
- **Database Metrics**: Query duration, connection pool stats
- **System Metrics**: Memory usage, CPU utilization
- **Business Metrics**: Transaction counts, active users, etc.

Metrics are exposed via the `/metrics` endpoint in Prometheus-compatible format for easy integration with monitoring systems.

## Alerting System

The alerting system monitors metrics and health checks to detect issues:

- **Thresholds**: Configurable warning and critical thresholds
- **Notification Channels**: Email, Slack, and console alerts
- **Alert Levels**: Info, Warning, Error, Critical
- **De-duplication**: Prevents alert storms for the same issue

Alert thresholds include:

| Metric | Warning | Critical |
|--------|---------|----------|
| CPU Usage | 70% | 90% |
| Memory Usage | 80% | 90% |
| DB Response Time | 500ms | 2000ms |
| HTTP Error Rate | 5% | 15% |

## Distributed Tracing

Distributed tracing provides end-to-end visibility into request processing:

- **OpenTelemetry Integration**: Standards-based tracing instrumentation
- **Trace Context Propagation**: Maintains request context across services
- **Automatic Instrumentation**: Database, HTTP, Redis, and queue operations
- **Custom Spans**: Business logic and custom operations

Trace data includes:

- Request path and duration
- Component-level performance metrics
- Error details and stack traces
- Business context (user IDs, transaction IDs, etc.)

## Health Dashboard

The admin dashboard provides a visual interface for monitoring system health:

- **Component Status**: Real-time status of all system components
- **Metrics Visualization**: Key performance indicators
- **Health History**: Historical health check results
- **Alert History**: Recent alerts and resolutions

Access the dashboard at `/api/v1/admin/dashboard` (admin authorization required).

## Security Monitoring

Security monitoring features include:

- **Header Audits**: Automatic verification of security headers
- **Rate Limiting**: Protection against abuse of health and monitoring endpoints
- **Access Control**: Role-based access to sensitive monitoring data
- **Audit Logging**: Tracks access to monitoring endpoints

## Usage and Configuration

### Environment Variables

Key environment variables for observability features:

```
# Health Check Configuration
HEALTH_CHECK_INTERVAL=60000    # Health check interval in milliseconds
HEALTH_CHECK_PATH=/health      # Custom health check endpoint path

# Monitoring Thresholds
CPU_WARNING_THRESHOLD=70       # CPU usage warning threshold percentage
MEMORY_WARNING_THRESHOLD=80    # Memory usage warning threshold percentage
DB_RESPONSE_WARNING_MS=500     # Database response time warning threshold
HTTP_ERROR_WARNING_RATE=5      # HTTP error rate warning threshold percentage

# Alert Configuration
ALERT_CHANNELS=slack,email     # Comma-separated list of alert channels
SLACK_WEBHOOK_URL=             # Slack webhook URL for alerts
ALERT_EMAIL=                   # Email address for alerts
ALERT_CHECK_INTERVAL=60000     # Alert check interval in milliseconds

# OpenTelemetry Distributed Tracing
OTEL_ENABLED=true              # Enable OpenTelemetry distributed tracing
OTEL_SERVICE_NAME=chainsync-api # Service name for tracing
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces  # OTLP exporter endpoint
OTEL_TRACE_SAMPLER_ARG=1.0     # Sampling rate (0.0-1.0, 1.0 = 100% of traces)
```

### Monitoring Scripts

The repository includes several monitoring scripts:

1. **Health Check Script**: `scripts/health-check.js` - Performs one-time health check
   ```
   node scripts/health-check.js --endpoint=http://localhost:3000/health
   ```

2. **Monitor Health Script**: `scripts/monitor-health.js` - Continuous monitoring with alerts
   ```
   node scripts/monitor-health.js --interval=60 --notify=slack,email
   ```

3. **Security Headers Check**: `scripts/check-security-headers.js` - Verifies security headers
   ```
   node scripts/check-security-headers.js
   ```

### Integration with External Monitoring

The implemented features are designed to integrate with common monitoring tools:

- **Prometheus** for metrics collection
- **Grafana** for metrics visualization
- **Jaeger/Zipkin** for distributed tracing visualization
- **PagerDuty** for advanced alerting (via webhooks)

## Troubleshooting

Common issues and their solutions:

1. **False positives in health checks**: Adjust thresholds in `.env` file
2. **Missing metrics**: Ensure `metrics.ts` is properly imported in all required modules
3. **Tracing not working**: Verify OpenTelemetry configuration and ensure `OTEL_ENABLED=true`
4. **Dashboard not accessible**: Check admin role permissions and route registration
