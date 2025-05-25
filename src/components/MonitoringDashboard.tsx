// src/components/MonitoringDashboard.tsx
import React, { useState, useEffect } from 'react';
import ErrorBoundary from './ErrorBoundary';

interface SystemMetric {
  name: string;
  value: number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
  threshold?: {
    warning: number;
    critical: number;
  };
  timestamp: string;
}

interface Alert {
  id: string;
  key: string;
  message: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  timestamp: string;
  acknowledged: boolean;
}

/**
 * Monitoring Dashboard component for system administrators
 * Displays system health, performance metrics, and active alerts
 */
const MonitoringDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<SystemMetric[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<number>(30);
  
  // Fetch metrics and alerts data
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch metrics
      const metricsResponse = await fetch('/api/v1/monitoring/metrics');
      if (!metricsResponse.ok) {
        throw new Error(`Failed to fetch metrics: ${metricsResponse.statusText}`);
      }
      const metricsData = await metricsResponse.json();
      setMetrics(metricsData);
      
      // Fetch alerts
      const alertsResponse = await fetch('/api/v1/monitoring/alerts');
      if (!alertsResponse.ok) {
        throw new Error(`Failed to fetch alerts: ${alertsResponse.statusText}`);
      }
      const alertsData = await alertsResponse.json();
      setAlerts(alertsData);
      
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
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
  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/v1/monitoring/alerts/${alertId}/acknowledge`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to acknowledge alert: ${response.statusText}`);
      }
      
      // Update local state
      setAlerts(alerts.map(alert => 
        alert.id === alertId ? { ...alert, acknowledged: true } : alert
      ));
    } catch (err) {
      console.error('Error acknowledging alert:', err);
    }
  };
  
  // Group metrics by status for better visualization
  const groupedMetrics = {
    critical: metrics.filter(metric => metric.status === 'critical'),
    warning: metrics.filter(metric => metric.status === 'warning'),
    normal: metrics.filter(metric => metric.status === 'normal')
  };
  
  // Group alerts by level
  const groupedAlerts = {
    critical: alerts.filter(alert => alert.level === 'critical' && !alert.acknowledged),
    error: alerts.filter(alert => alert.level === 'error' && !alert.acknowledged),
    warning: alerts.filter(alert => alert.level === 'warning' && !alert.acknowledged),
    info: alerts.filter(alert => alert.level === 'info' && !alert.acknowledged),
    acknowledged: alerts.filter(alert => alert.acknowledged)
  };
  
  // Render metric item
  const renderMetric = (metric: SystemMetric) => {
    const statusClass = `metric-${metric.status}`;
    
    return (
      <div key={metric.name} className={`metric-item ${statusClass}`}>
        <div className="metric-header">
          <h3 className="metric-name">{metric.name}</h3>
          <span className={`metric-status ${statusClass}`}>{metric.status}</span>
        </div>
        <div className="metric-value">
          {metric.value} {metric.unit}
        </div>
        {metric.threshold && (
          <div className="metric-thresholds">
            <span className="threshold warning">Warning: {metric.threshold.warning} {metric.unit}</span>
            <span className="threshold critical">Critical: {metric.threshold.critical} {metric.unit}</span>
          </div>
        )}
        <div className="metric-timestamp">
          Last updated: {new Date(metric.timestamp).toLocaleString()}
        </div>
      </div>
    );
  };
  
  // Render alert item
  const renderAlert = (alert: Alert) => {
    const levelClass = `alert-${alert.level}`;
    
    return (
      <div key={alert.id} className={`alert-item ${levelClass}`}>
        <div className="alert-header">
          <span className={`alert-level ${levelClass}`}>{alert.level}</span>
          <span className="alert-time">{new Date(alert.timestamp).toLocaleString()}</span>
        </div>
        <div className="alert-message">{alert.message}</div>
        <div className="alert-actions">
          {!alert.acknowledged && (
            <button
              className="alert-acknowledge-button"
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
      <div className="monitoring-dashboard">
        <div className="dashboard-header">
          <h1>System Monitoring Dashboard</h1>
          <div className="dashboard-controls">
            <button onClick={fetchData} disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh Now'}
            </button>
            <div className="refresh-interval">
              <label>Refresh every:</label>
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
              >
                <option value="10">10 seconds</option>
                <option value="30">30 seconds</option>
                <option value="60">1 minute</option>
                <option value="300">5 minutes</option>
              </select>
            </div>
          </div>
        </div>
        
        {error && (
          <div className="dashboard-error">
            <p>Error loading monitoring data: {error.message}</p>
            <button onClick={fetchData}>Try Again</button>
          </div>
        )}
        
        <div className="dashboard-content">
          {/* Alerts Section */}
          <div className="alerts-section dashboard-section">
            <h2>Active Alerts</h2>
            
            {/* Critical Alerts */}
            {groupedAlerts.critical.length > 0 && (
              <div className="alerts-group critical">
                <h3>Critical Alerts ({groupedAlerts.critical.length})</h3>
                {groupedAlerts.critical.map(renderAlert)}
              </div>
            )}
            
            {/* Error Alerts */}
            {groupedAlerts.error.length > 0 && (
              <div className="alerts-group error">
                <h3>Error Alerts ({groupedAlerts.error.length})</h3>
                {groupedAlerts.error.map(renderAlert)}
              </div>
            )}
            
            {/* Warning Alerts */}
            {groupedAlerts.warning.length > 0 && (
              <div className="alerts-group warning">
                <h3>Warning Alerts ({groupedAlerts.warning.length})</h3>
                {groupedAlerts.warning.map(renderAlert)}
              </div>
            )}
            
            {/* Info Alerts */}
            {groupedAlerts.info.length > 0 && (
              <div className="alerts-group info">
                <h3>Info Alerts ({groupedAlerts.info.length})</h3>
                {groupedAlerts.info.map(renderAlert)}
              </div>
            )}
            
            {/* No Active Alerts */}
            {Object.values(groupedAlerts).slice(0, 4).every(group => group.length === 0) && (
              <div className="no-alerts">
                <p>No active alerts. System is running normally.</p>
              </div>
            )}
            
            {/* Acknowledged Alerts (Collapsed) */}
            {groupedAlerts.acknowledged.length > 0 && (
              <details className="acknowledged-alerts">
                <summary>
                  Acknowledged Alerts ({groupedAlerts.acknowledged.length})
                </summary>
                {groupedAlerts.acknowledged.map(renderAlert)}
              </details>
            )}
          </div>
          
          {/* Metrics Section */}
          <div className="metrics-section dashboard-section">
            <h2>System Metrics</h2>
            
            {/* Critical Metrics */}
            {groupedMetrics.critical.length > 0 && (
              <div className="metrics-group critical">
                <h3>Critical Metrics ({groupedMetrics.critical.length})</h3>
                <div className="metrics-grid">
                  {groupedMetrics.critical.map(renderMetric)}
                </div>
              </div>
            )}
            
            {/* Warning Metrics */}
            {groupedMetrics.warning.length > 0 && (
              <div className="metrics-group warning">
                <h3>Warning Metrics ({groupedMetrics.warning.length})</h3>
                <div className="metrics-grid">
                  {groupedMetrics.warning.map(renderMetric)}
                </div>
              </div>
            )}
            
            {/* Normal Metrics */}
            <div className="metrics-group normal">
              <h3>Normal Metrics ({groupedMetrics.normal.length})</h3>
              <div className="metrics-grid">
                {groupedMetrics.normal.map(renderMetric)}
              </div>
            </div>
            
            {/* No Metrics */}
            {metrics.length === 0 && !loading && !error && (
              <div className="no-metrics">
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
