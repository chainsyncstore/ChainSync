"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertManager = void 0;
/**
 * Minimal stub for AlertManager to satisfy TypeScript.
 * Replace with real implementation when monitoring is integrated.
 */
class AlertManager {
    static getInstance() {
        if (!this._instance)
            this._instance = new AlertManager();
        return this._instance;
    }
    triggerAlert(_msg) {
        console.warn('[AlertManager] alert triggered:', _msg);
    }
}
exports.AlertManager = AlertManager;
