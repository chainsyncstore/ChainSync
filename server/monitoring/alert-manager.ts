/**
 * Minimal stub for AlertManager to satisfy TypeScript.
 * Replace with real implementation when monitoring is integrated.
 */
export class AlertManager {
  private static _instance: AlertManager;
  static getInstance() {
    if (!this._instance) this._instance = new AlertManager();
    return this._instance;
  }
  triggerAlert(_msg: string) {
    console.warn('[AlertManager] alert triggered:', _msg);
  }
}
