/**
 * Minimal stub for MetricsCollector to satisfy TypeScript.
 */
export class MetricsCollector {
  private static _instance: MetricsCollector;
  static getInstance() {
    if (!this._instance) this._instance = new MetricsCollector();
    return this._instance;
  }
  recordMetric(_name: string, _value: number) {
    console.info('[MetricsCollector] metric', _name, _value);
  }
}
