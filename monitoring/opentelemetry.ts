import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { getLogger } from '../src/logging';

const logger = getLogger().child({ component: 'opentelemetry' });

/**
 * Initialize OpenTelemetry SDK with exporters for traces and metrics
 */
export function initializeOpenTelemetry(): NodeSDK | null {
  const OTEL_ENABLED = process.env.OTEL_ENABLED === 'true';
  const OTEL_EXPORTER_OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';
  
  if (!OTEL_ENABLED) {
    logger.info('OpenTelemetry is disabled. Set OTEL_ENABLED=true to enable monitoring.');
    return null;
  }
  
  try {
    logger.info('Initializing OpenTelemetry', { endpoint: OTEL_EXPORTER_OTLP_ENDPOINT });
    
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'chainsync-service',
      [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '0.0.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
    });

    // Configure trace exporter
    const traceExporter = new OTLPTraceExporter({
      url: `${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
    });
    
    // Configure metrics exporter
    const metricExporter = new OTLPMetricExporter({
      url: `${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/metrics`,
    });
    
    // Create SDK instance
    const sdk = new NodeSDK({
      resource,
      traceExporter,
      metricReader: new PeriodicExportingMetricReader({
        exporter: metricExporter,
        exportIntervalMillis: 15000, // export metrics every 15 seconds
      }),
      spanProcessor: new BatchSpanProcessor(traceExporter, {
        scheduledDelayMillis: 5000, // process batches every 5 seconds
        maxExportBatchSize: 100,    // maximum batch size
      }),
      instrumentations: [
        // Auto-instrument popular frameworks and libraries
        getNodeAutoInstrumentations({
          // Disable redis instrumentation if it's causing issues
          '@opentelemetry/instrumentation-redis': {
            enabled: false,
          },
        }),
        // Explicitly add instrumentations for important frameworks
        new ExpressInstrumentation(),
        new HttpInstrumentation(),
      ],
    });
    
    // Register event handlers for SDK errors
    process.on('SIGTERM', () => {
      sdk.shutdown()
        .then(() => logger.info('OpenTelemetry SDK shut down successfully'))
        .catch(error => logger.error('Error shutting down OpenTelemetry SDK', { error }))
        .finally(() => process.exit(0));
    });
    
    // Start the SDK
    sdk.start();
    logger.info('OpenTelemetry SDK started successfully');
    
    return sdk;
  } catch (error) {
    logger.error('Failed to initialize OpenTelemetry', { error });
    return null;
  }
}

/**
 * Custom trace utility for manual instrumentation
 */
export function createCustomSpan(
  name: string, 
  fn: () => Promise<any>, 
  attributes: Record<string, string | number | boolean> = {}
): Promise<any> {
  // If OpenTelemetry is not enabled, just execute the function
  if (process.env.OTEL_ENABLED !== 'true') {
    return fn();
  }
  
  const { trace, context } = require('@opentelemetry/api');
  const tracer = trace.getTracer('chainsync-custom-tracer');
  
  return tracer.startActiveSpan(name, async (span: any) => {
    try {
      // Set attributes
      Object.entries(attributes).forEach(([key, value]) => {
        span.setAttribute(key, value);
      });
      
      // Execute the function
      const result = await fn();
      
      // End the span
      span.end();
      
      return result;
    } catch (error) {
      // Record error and end span
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message }); // 2 = ERROR
      span.end();
      
      // Re-throw the error
      throw error;
    }
  });
}

/**
 * Initialize performance monitoring
 */
export function initializeMonitoring(): void {
  // Initialize OpenTelemetry
  initializeOpenTelemetry();
  
  // Add unhandled rejection and exception handlers
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Promise Rejection', { reason, promise });
  });
  
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', { error });
    // Give time for logs to flush, then exit
    setTimeout(() => process.exit(1), 1000);
  });
  
  logger.info('Performance monitoring initialized');
}
