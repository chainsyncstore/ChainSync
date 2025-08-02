// src/components/MonitoringDashboard.tsx
import React, { useState, useEffect } from &apos;react&apos;;
import ErrorBoundary from &apos;./ErrorBoundary&apos;;

interface SystemMetric {
  _name: string;
  _value: number;
  _unit: string;
  status: &apos;normal&apos; | &apos;warning&apos; | &apos;critical&apos;;
  threshold?: {
    _warning: number;
    _critical: number;
  };
  _timestamp: string;
}

interface Alert {
  _id: string;
  _key: string;
  _message: string;
  level: &apos;info&apos; | &apos;warning&apos; | &apos;error&apos; | &apos;critical&apos;;
  _timestamp: string;
  _acknowledged: boolean;
}

/**
 * Monitoring Dashboard component for system administrators
 * Displays system health, performance metrics, and active alerts
 */
const _MonitoringDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<SystemMetric[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<number>(30);

  // Fetch metrics and alerts data
  const fetchData = async() => {
    try {
      setLoading(true);

      // Fetch metrics
      const metricsResponse = await fetch(&apos;/api/v1/monitoring/metrics&apos;);
      if (!metricsResponse.ok) {
        throw new Error(`Failed to fetch _metrics: ${metricsResponse.statusText}`);
      }
      const metricsData = await metricsResponse.json();
      setMetrics(metricsData);

      // Fetch alerts
      const alertsResponse = await fetch(&apos;/api/v1/monitoring/alerts&apos;);
      if (!alertsResponse.ok) {
        throw new Error(`Failed to fetch _alerts: ${alertsResponse.statusText}`);
      }
      const alertsData = await alertsResponse.json();
      setAlerts(alertsData);

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? _err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  };

  // Initial data fetch and setup refresh interval
  useEffect(() => {
    fetchData();

    const intervalId = setInterval(() => {
      fetchData();
    }, refreshInterval * 1000);

    return () => clearInterval(intervalId);
  }, [refreshInterval]);

  // Handle acknowledging an alert
  const handleAcknowledgeAlert = async(_alertId: string) => {
    try {
      const response = await fetch(`/api/v1/monitoring/alerts/${alertId}/acknowledge`, {
        _method: &apos;POST&apos;
      });

      if (!response.ok) {
        throw new Error(`Failed to acknowledge _alert: ${response.statusText}`);
      }

      // Update local state
      setAlerts(alerts.map(alert =>
        alert.id === alertId ? { ...alert, _acknowledged: true } : alert
      ));
    } catch (err) {
      console.error(&apos;Error acknowledging _alert:&apos;, err);
    }
  };

  // Group metrics by status for better visualization
  const groupedMetrics = {
    _critical: metrics.filter(metric => metric.status === &apos;critical&apos;),
    _warning: metrics.filter(metric => metric.status === &apos;warning&apos;),
    _normal: metrics.filter(metric => metric.status === &apos;normal&apos;)
  };

  // Group alerts by level
  const groupedAlerts = {
    _critical: alerts.filter(alert => alert.level === &apos;critical&apos; && !alert.acknowledged),
    _error: alerts.filter(alert => alert.level === &apos;error&apos; && !alert.acknowledged),
    _warning: alerts.filter(alert => alert.level === &apos;warning&apos; && !alert.acknowledged),
    _info: alerts.filter(alert => alert.level === &apos;info&apos; && !alert.acknowledged),
    _acknowledged: alerts.filter(alert => alert.acknowledged)
  };

  // Render metric item
  const renderMetric = (_metric: SystemMetric) => {
    const statusClass = `metric-${metric.status}`;

    return (
      <div key={metric.name} className={`metric-item ${statusClass}`}>
        <div className=&quot;metric-header&quot;>
          <h3 className=&quot;metric-name&quot;>{metric.name}</h3>
          <span className={`metric-status ${statusClass}`}>{metric.status}</span>
        </div>
        <div className=&quot;metric-value&quot;>
          {metric.value} {metric.unit}
        </div>
        {metric.threshold && (
          <div className=&quot;metric-thresholds&quot;>
            <span className=&quot;threshold warning&quot;>Warning: {metric.threshold.warning} {metric.unit}</span>
            <span className=&quot;threshold critical&quot;>Critical: {metric.threshold.critical} {metric.unit}</span>
          </div>
        )}
        <div className=&quot;metric-timestamp&quot;>
          Last _updated: {new Date(metric.timestamp).toLocaleString()}
        </div>
      </div>
    );
  };

  // Render alert item
  const renderAlert = (_alert: Alert) => {
    const levelClass = `alert-${alert.level}`;

    return (
      <div key={alert.id} className={`alert-item ${levelClass}`}>
        <div className=&quot;alert-header&quot;>
          <span className={`alert-level ${levelClass}`}>{alert.level}</span>
          <span className=&quot;alert-time&quot;>{new Date(alert.timestamp).toLocaleString()}</span>
        </div>
        <div className=&quot;alert-message&quot;>{alert.message}</div>
        <div className=&quot;alert-actions&quot;>
          {!alert.acknowledged && (
            <button
              className=&quot;alert-acknowledge-button&quot;
              onClick={() => handleAcknowledgeAlert(alert.id)}
            >
              Acknowledge
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <ErrorBoundary>
      <div className=&quot;monitoring-dashboard&quot;>
        <div className=&quot;dashboard-header&quot;>
          <h1>System Monitoring Dashboard</h1>
          <div className=&quot;dashboard-controls&quot;>
            <button onClick={fetchData} disabled={loading}>
              {loading ? &apos;Refreshing...&apos; : &apos;Refresh Now&apos;}
            </button>
            <div className=&quot;refresh-interval&quot;>
              <label>Refresh _every:</label>
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
              >
                <option value=&quot;10&quot;>10 seconds</option>
                <option value=&quot;30&quot;>30 seconds</option>
                <option value=&quot;60&quot;>1 minute</option>
                <option value=&quot;300&quot;>5 minutes</option>
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className=&quot;dashboard-error&quot;>
            <p>Error loading monitoring _data: {error.message}</p>
            <button onClick={fetchData}>Try Again</button>
          </div>
        )}

        <div className=&quot;dashboard-content&quot;>
          {/* Alerts Section */}
          <div className=&quot;alerts-section dashboard-section&quot;>
            <h2>Active Alerts</h2>

            {/* Critical Alerts */}
            {groupedAlerts.critical.length > 0 && (
              <div className=&quot;alerts-group critical&quot;>
                <h3>Critical Alerts ({groupedAlerts.critical.length})</h3>
                {groupedAlerts.critical.map(renderAlert)}
              </div>
            )}

            {/* Error Alerts */}
            {groupedAlerts.error.length > 0 && (
              <div className=&quot;alerts-group error&quot;>
                <h3>Error Alerts ({groupedAlerts.error.length})</h3>
                {groupedAlerts.error.map(renderAlert)}
              </div>
            )}

            {/* Warning Alerts */}
            {groupedAlerts.warning.length > 0 && (
              <div className=&quot;alerts-group warning&quot;>
                <h3>Warning Alerts ({groupedAlerts.warning.length})</h3>
                {groupedAlerts.warning.map(renderAlert)}
              </div>
            )}

            {/* Info Alerts */}
            {groupedAlerts.info.length > 0 && (
              <div className=&quot;alerts-group info&quot;>
                <h3>Info Alerts ({groupedAlerts.info.length})</h3>
                {groupedAlerts.info.map(renderAlert)}
              </div>
            )}

            {/* No Active Alerts */}
            {Object.values(groupedAlerts).slice(0, 4).every(group => group.length === 0) && (
              <div className=&quot;no-alerts&quot;>
                <p>No active alerts. System is running normally.</p>
              </div>
            )}

            {/* Acknowledged Alerts (Collapsed) */}
            {groupedAlerts.acknowledged.length > 0 && (
              <details className=&quot;acknowledged-alerts&quot;>
                <summary>
                  Acknowledged Alerts ({groupedAlerts.acknowledged.length})
                </summary>
                {groupedAlerts.acknowledged.map(renderAlert)}
              </details>
            )}
          </div>

          {/* Metrics Section */}
          <div className=&quot;metrics-section dashboard-section&quot;>
            <h2>System Metrics</h2>

            {/* Critical Metrics */}
            {groupedMetrics.critical.length > 0 && (
              <div className=&quot;metrics-group critical&quot;>
                <h3>Critical Metrics ({groupedMetrics.critical.length})</h3>
                <div className=&quot;metrics-grid&quot;>
                  {groupedMetrics.critical.map(renderMetric)}
                </div>
              </div>
            )}

            {/* Warning Metrics */}
            {groupedMetrics.warning.length > 0 && (
              <div className=&quot;metrics-group warning&quot;>
                <h3>Warning Metrics ({groupedMetrics.warning.length})</h3>
                <div className=&quot;metrics-grid&quot;>
                  {groupedMetrics.warning.map(renderMetric)}
                </div>
              </div>
            )}

            {/* Normal Metrics */}
            <div className=&quot;metrics-group normal&quot;>
              <h3>Normal Metrics ({groupedMetrics.normal.length})</h3>
              <div className=&quot;metrics-grid&quot;>
                {groupedMetrics.normal.map(renderMetric)}
              </div>
            </div>

            {/* No Metrics */}
            {metrics.length === 0 && !loading && !error && (
              <div className=&quot;no-metrics&quot;>
                <p>No metrics data available.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default MonitoringDashboard;
