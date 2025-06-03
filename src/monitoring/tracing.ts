// src/monitoring/tracing.ts
import * as opentelemetry from '@opentelemetry/sdk-node';
import { Span, trace, context as apiContext } from '@opentelemetry/api'; // Import trace and context here, alias context
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import * as otelResources from '@opentelemetry/resources'; // Changed to namespace import
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis';
import { AppError } from '@shared/types/errors';
import { getLogger } from '../logging';
import { Request, Response, NextFunction } from 'express';
import type { Logger } from '../logging/Logger'; // Import Logger type for lazy init

let logger: Logger; // Declare logger
const getModuleLogger = () => { // Lazy getter for the logger
  if (!logger) {
    logger = getLogger().child({ component: 'tracing' });
  }
  return logger;
};

// OpenTelemetry SDK instance
let sdk: opentelemetry.NodeSDK | null = null;

// Configuration
const OTEL_CONFIG = {
  serviceName: process.env.OTEL_SERVICE_NAME || 'chainsync-api',
  environment: process.env.NODE_ENV || 'development',
  endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
  sampleRate: process.env.OTEL_TRACE_SAMPLER_ARG ? 
    parseFloat(process.env.OTEL_TRACE_SAMPLER_ARG) : 1.0
};

/**
 * Initialize OpenTelemetry tracing
 * This should be called as early as possible in the application lifecycle
 */
export function initTracing() {
  try {
    const exporter = new OTLPTraceExporter({
      url: OTEL_CONFIG.endpoint
    });

    const resource = new otelResources.Resource({}).merge( // Changed to otelResources.Resource
      new otelResources.Resource({                         // Changed to otelResources.Resource
        [SemanticResourceAttributes.SERVICE_NAME]: OTEL_CONFIG.serviceName,
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: OTEL_CONFIG.environment,
      })
    );

    // Create and configure SDK
    sdk = new opentelemetry.NodeSDK({
      resource,
      traceExporter: exporter,
      instrumentations: [
        // Auto-instrument common Node.js modules
        getNodeAutoInstrumentations({
          // Only enable specific instrumentations we need
          '@opentelemetry/instrumentation-fs': {
            enabled: false, // Can generate a lot of noise
          },
          '@opentelemetry/instrumentation-express': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-http': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-pg': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-redis': {
            enabled: true,
          }
        }),
        // Add additional instrumentations as needed
        new ExpressInstrumentation(),
        new HttpInstrumentation(),
        new PgInstrumentation(),
        new RedisInstrumentation(),
      ],
    });

    // Initialize SDK
    sdk.start()
      .then(() => {
        getModuleLogger().info('OpenTelemetry tracing initialized successfully', {
          serviceName: OTEL_CONFIG.serviceName,
          environment: OTEL_CONFIG.environment,
          endpoint: OTEL_CONFIG.endpoint,
          sampleRate: OTEL_CONFIG.sampleRate
        });
      })
      .catch((err: unknown) => {
        if (err instanceof Error) {
          getModuleLogger().error('Failed to start OpenTelemetry SDK', err);
        } else {
          getModuleLogger().error('Failed to start OpenTelemetry SDK', { meta: err });
        }
      });

    // Register shutdown handler
    process.on('SIGTERM', () => {
      shutdownTracing()
        .catch((err: unknown) => {
          if (err instanceof Error) {
            getModuleLogger().error('Error shutting down OpenTelemetry SDK', err);
          } else {
            getModuleLogger().error('Error shutting down OpenTelemetry SDK', { meta: err });
          }
        });
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      getModuleLogger().error('Failed to initialize OpenTelemetry tracing', error);
    } else {
      getModuleLogger().error('Failed to initialize OpenTelemetry tracing', { meta: error });
    }
  }
}

/**
 * Properly shutdown OpenTelemetry SDK
 */
export async function shutdownTracing() {
  if (sdk) {
    await sdk.shutdown();
    getModuleLogger().info('OpenTelemetry tracing shut down');
  }
}

/**
 * Get the current active trace context
 * This can be used to correlate logs with traces
 * @returns Trace ID and Span ID if available, or undefined
 */
export function getCurrentTraceContext() {
  try {
    const activeSpan = trace.getSpan(apiContext.active()); // Use imported trace and apiContext
    
    if (activeSpan) {
      const spanContext = activeSpan.spanContext();
      return {
        traceId: spanContext.traceId,
        spanId: spanContext.spanId
      };
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      getModuleLogger().error('Error getting trace context', error);
    } else {
      getModuleLogger().error('Error getting trace context', { meta: error });
    }
  }
  
  return undefined;
}

/**
 * Express middleware to add trace context to logs
 */
export function traceContextMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const traceContext = getCurrentTraceContext();
    
    if (traceContext) {
      // Add trace context to request for logging
      (req as any).traceContext = traceContext;
      
      // Add trace ID to response headers for debugging
      res.setHeader('X-Trace-ID', traceContext.traceId);
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      getModuleLogger().error('Error in trace context middleware', error);
    } else {
      getModuleLogger().error('Error in trace context middleware', { meta: error });
    }
  }
  
  next();
}

/**
 * Create a child span for a specific operation
 * @param name Name of the operation
 * @param fn Function to execute within the span
 * @returns Result of the function
 */
export async function withSpan<T>(name: string, fn: () => Promise<T>): Promise<T> {
  try {
    const tracer = trace.getTracer('chainsync-app'); // Use imported trace
    
    return await tracer.startActiveSpan(name, async (span: Span) => {
      try {
        const result = await fn();
        span.end();
        return result;
      } catch (error: unknown) {
        span.recordException(error as Error); // Cast to Error for recordException
        span.setStatus({ code: 2 }); // ERROR
        span.end();
        throw error instanceof AppError ? error : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });
  } catch (error: unknown) {
    getModuleLogger().debug(`Error creating span for ${name}`, { error });
    return await fn();
  }
}
