// Stub for '@opentelemetry/exporter-trace-otlp-http'
// Provides a no-op OTLPTraceExporter class so that tracing import doesn’t break in Jest.
class OTLPTraceExporter {
  constructor() {}
  shutdown() {}
  export() {}
}

module.exports = {
  OTLPTraceExporter,
  default: OTLPTraceExporter,
};
