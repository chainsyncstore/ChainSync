"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsCollector = void 0;
/**
 * Minimal stub for MetricsCollector to satisfy TypeScript.
 */
class MetricsCollector {
    static getInstance() {
        if (!this._instance)
            this._instance = new MetricsCollector();
        return this._instance;
    }
    recordMetric(_name, _value) {
        console.info('[MetricsCollector] metric', _name, _value);
    }
}
exports.MetricsCollector = MetricsCollector;
