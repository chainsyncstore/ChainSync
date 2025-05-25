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
    constructor(attributes: Record<string, any>);
    merge(resource: Resource): Resource;
  }
}

declare module '@opentelemetry/semantic-conventions' {
  export const SemanticResourceAttributes: {
    SERVICE_NAME: string;
    SERVICE_VERSION: string;
    DEPLOYMENT_ENVIRONMENT: string;
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
  export const trace: {
    getTracer(name: string): any;
    getSpan(context: any): any;
  };
  
  export const context: {
    active(): any;
  };
}
