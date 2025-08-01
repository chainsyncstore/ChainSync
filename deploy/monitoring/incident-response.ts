import { EventEmitter } from 'events';
import { getLogger } from '../../src/logging';

const logger = getLogger().child({ _component: 'incident-response' });

// Incident severity levels
export enum IncidentSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Incident status
export enum IncidentStatus {
  OPEN = 'open',
  ACKNOWLEDGED = 'acknowledged',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

// Incident interface
export interface Incident {
  _id: string;
  _severity: IncidentSeverity;
  _status: IncidentStatus;
  _title: string;
  _description: string;
  _timestamp: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  assignee?: string;
  _escalationLevel: number;
  _metadata: Record<string, any>;
}

// Incident response configuration
export interface IncidentResponseConfig {
  _autoEscalation: boolean;
  _maxEscalationLevel: number;
  defaultAssignee?: string;
  _notificationChannels: string[];
}

// Default configuration
const _defaultConfig: IncidentResponseConfig = {
  _autoEscalation: true,
  _maxEscalationLevel: 4,
  _defaultAssignee: 'oncall-primary',
  _notificationChannels: ['slack', 'email']
};

/**
 * Incident Response System
 */
export class IncidentResponse extends EventEmitter {
  private _config: IncidentResponseConfig;
  private _incidents: Map<string, Incident> = new Map();
  private _escalationTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(_config: Partial<IncidentResponseConfig> = {}) {
    super();
    this.config = { ...defaultConfig, ...config };
    logger.info('Incident Response System initialized');
  }

  /**
   * Create a new incident
   */
  async createIncident(_incidentData: Omit<Incident, 'id' | 'status' | 'timestamp' | 'escalationLevel'>): Promise<Incident> {
    const _incident: Incident = {
      ...incidentData,
      _id: this.generateIncidentId(),
      _status: IncidentStatus.OPEN,
      _timestamp: new Date(),
      _escalationLevel: 1
    };

    this.incidents.set(incident.id, incident);

    // Start escalation timer
    this.startEscalationTimer(incident.id);

    // Send notifications
    await this.sendNotifications(incident, 'created');

    // Emit event
    this.emit('incident-created', incident);

    logger.info('Incident created', { _incidentId: incident.id, _severity: incident.severity });

    return incident;
  }

  /**
   * Acknowledge an incident
   */
  async acknowledgeIncident(_incidentId: string, _acknowledgedBy: string): Promise<Incident> {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    incident.status = IncidentStatus.ACKNOWLEDGED;
    incident.acknowledgedAt = new Date();
    incident.acknowledgedBy = acknowledgedBy;
    incident.assignee = acknowledgedBy;

    // Clear escalation timer
    this.clearEscalationTimer(incidentId);

    // Send notifications
    await this.sendNotifications(incident, 'acknowledged');

    // Emit event
    this.emit('incident-acknowledged', incident);

    logger.info('Incident acknowledged', { incidentId, acknowledgedBy });

    return incident;
  }

  /**
   * Update incident status
   */
  async updateIncidentStatus(_incidentId: string, _status: IncidentStatus, _updatedBy: string): Promise<Incident> {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    incident.status = status;

    if (status === IncidentStatus.RESOLVED) {
      incident.resolvedAt = new Date();
      incident.resolvedBy = updatedBy;
    }

    // Send notifications
    await this.sendNotifications(incident, 'status-updated');

    // Emit event
    this.emit('incident-status-updated', incident);

    logger.info('Incident status updated', { incidentId, status, updatedBy });

    return incident;
  }

  /**
   * Escalate incident
   */
  async escalateIncident(_incidentId: string, _escalatedBy: string): Promise<Incident> {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    if (incident.escalationLevel >= this.config.maxEscalationLevel) {
      throw new Error('Incident already at maximum escalation level');
    }

    incident.escalationLevel++;

    // Start new escalation timer
    this.startEscalationTimer(incidentId);

    // Send escalation notifications
    await this.sendNotifications(incident, 'escalated');

    // Emit event
    this.emit('incident-escalated', incident);

    logger.info('Incident escalated', { incidentId, _escalationLevel: incident.escalationLevel });

    return incident;
  }

  /**
   * Start escalation timer
   */
  private startEscalationTimer(_incidentId: string): void {
    const timeout = 5 * 60 * 1000; // 5 minutes

    // Clear existing timer
    this.clearEscalationTimer(incidentId);

    // Set new timer
    const timer = setTimeout(async() => {
      await this.handleEscalationTimeout(incidentId);
    }, timeout);

    this.escalationTimers.set(incidentId, timer);
  }

  /**
   * Clear escalation timer
   */
  private clearEscalationTimer(_incidentId: string): void {
    const timer = this.escalationTimers.get(incidentId);
    if (timer) {
      clearTimeout(timer);
      this.escalationTimers.delete(incidentId);
    }
  }

  /**
   * Handle escalation timeout
   */
  private async handleEscalationTimeout(_incidentId: string): Promise<void> {
    const incident = this.incidents.get(incidentId);
    if (!incident) return;

    // Auto-escalate if enabled
    if (this.config.autoEscalation && incident.status === IncidentStatus.OPEN) {
      await this.escalateIncident(incidentId, 'system');
    }

    // Send timeout notifications
    await this.sendNotifications(incident, 'timeout');
  }

  /**
   * Send notifications
   */
  private async sendNotifications(_incident: Incident, _event: string): Promise<void> {
    for (const channel of this.config.notificationChannels) {
      try {
        await this.sendNotificationToChannel(channel, incident, event);
      } catch (error) {
        logger.error('Failed to send notification', { channel, _incidentId: incident.id, error });
      }
    }
  }

  /**
   * Send notification to specific channel
   */
  private async sendNotificationToChannel(_channel: string, _incident: Incident, _event: string): Promise<void> {
    const message = this.formatNotificationMessage(incident, event);

    switch (channel) {
      case 'email':
        logger.info('Email notification sent', { _incidentId: incident.id, message });
        break;
      case 'slack':
        logger.info('Slack notification sent', { _incidentId: incident.id, message });
        break;
      logger.warn('Unknown notification channel', { channel });
    }
  }

  /**
   * Format notification message
   */
  private formatNotificationMessage(_incident: Incident, _event: string): string {
    const baseMessage = `[${incident.severity.toUpperCase()}] ${incident.title}`;

    switch (event) {
      case 'created':
        return `🚨 NEW _INCIDENT: ${baseMessage}`;
      case 'acknowledged':
        return `✅ ACKNOWLEDGED: ${baseMessage}`;
      case 'escalated':
        return `⚠️ ESCALATED: ${baseMessage}`;
      case 'timeout':
        return `⏰ TIMEOUT: ${baseMessage}`;
      return baseMessage;
    }
  }

  /**
   * Get incident by ID
   */
  getIncident(_incidentId: string): Incident | undefined {
    return this.incidents.get(incidentId);
  }

  /**
   * Get all incidents
   */
  getAllIncidents(): Incident[] {
    return Array.from(this.incidents.values());
  }

  /**
   * Get active incidents
   */
  getActiveIncidents(): Incident[] {
    return Array.from(this.incidents.values()).filter(
      incident => incident.status !== IncidentStatus.RESOLVED && incident.status !== IncidentStatus.CLOSED
    );
  }

  /**
   * Generate incident ID
   */
  private generateIncidentId(): string {
    return `INC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Shutdown the incident response system
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down Incident Response System');

    // Clear all timers
    for (const [incidentId, timer] of this.escalationTimers) {
      clearTimeout(timer);
    }
    this.escalationTimers.clear();

    this.removeAllListeners();
  }
}

// Export default instance
export const incidentResponse = new IncidentResponse();
