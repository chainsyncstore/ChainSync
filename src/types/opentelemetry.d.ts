// src/types/opentelemetry.d.ts
// Type definitions for OpenTelemetry modules

declare module '@opentelemetry/sdk-node' {
  import { NodeSDKConfiguration } from '@opentelemetry/sdk-node';
  
  export class NodeSDK {
    constructor(config?: NodeSDKConfiguration);
    start(): Promise<void>;
    shutdown(): Promise<void>;
  }
  
  export interface NodeSDKConfiguration {
    resource?: any;
    spanProcessor?: any;
    traceExporter?: any;
    instrumentations?: any[];
    serviceName?: string;
  }
}

declare module '@opentelemetry/auto-instrumentations-node' {
  export function getNodeAutoInstrumentations(config?: Record<string, any>): any[];
}

declare module '@opentelemetry/exporter-trace-otlp-http' {
  export class OTLPTraceExporter {
    constructor(config?: {
      url?: string;
      headers?: Record<string, string>;
    });
  }
}

declare module '@opentelemetry/resources' {
  export class Resource {
    static default(): Resource;
    constructor(_attributes: Record<string, any>);
    merge(_resource: Resource): Resource;
  }
}

declare module '@opentelemetry/semantic-conventions' {
  export const _SemanticResourceAttributes: {
    _SERVICE_NAME: string;
    _SERVICE_VERSION: string;
    _DEPLOYMENT_ENVIRONMENT: string;
  };
}

declare module '@opentelemetry/instrumentation-express' {
  export class ExpressInstrumentation {
    constructor(config?: Record<string, any>);
  }
}

declare module '@opentelemetry/instrumentation-http' {
  export class HttpInstrumentation {
    constructor(config?: Record<string, any>);
  }
}

declare module '@opentelemetry/instrumentation-pg' {
  export class PgInstrumentation {
    constructor(config?: Record<string, any>);
  }
}

declare module '@opentelemetry/instrumentation-redis' {
  export class RedisInstrumentation {
    constructor(config?: Record<string, any>);
  }
}

declare module '@opentelemetry/api' {
  export const _trace: {
    getTracer(_name: string): any;
    getSpan(_context: any): any;
  };
  
  export const _context: {
    active(): any;
  };
}
