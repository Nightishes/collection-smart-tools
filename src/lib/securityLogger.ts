/**
 * Security Logging and Monitoring Module
 * Provides comprehensive security event logging and alerting
 */

import { promises as fs } from 'fs';
import path from 'path';

export enum SecurityEventType {
  AUTH_FAILURE = 'AUTH_FAILURE',
  VIRUS_DETECTED = 'VIRUS_DETECTED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  MALICIOUS_FILENAME = 'MALICIOUS_FILENAME',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  FILE_QUARANTINED = 'FILE_QUARANTINED',
  DOCKER_SECURITY_EVENT = 'DOCKER_SECURITY_EVENT',
  XSS_ATTEMPT = 'XSS_ATTEMPT',
  SQL_INJECTION_ATTEMPT = 'SQL_INJECTION_ATTEMPT',
  CSRF_VALIDATION_FAILED = 'CSRF_VALIDATION_FAILED',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  FILE_SCAN_FAILED = 'FILE_SCAN_FAILED',
  LARGE_FILE_UPLOAD = 'LARGE_FILE_UPLOAD'
}

export enum SecuritySeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

interface SecurityEvent {
  timestamp: string;
  type: SecurityEventType;
  severity: SecuritySeverity;
  userId?: string;
  ip?: string;
  userAgent?: string;
  details: Record<string, unknown>;
  message: string;
}

interface SecurityMetrics {
  eventCounts: Record<SecurityEventType, number>;
  suspiciousIPs: Map<string, number>;
  failedAuthAttempts: Map<string, number>;
}

class SecurityLogger {
  private logDir: string;
  private metrics: SecurityMetrics;
  private alertWebhook?: string;
  private retentionDays: number;

  constructor(logDir: string = './logs/security', retentionDays: number = 90) {
    this.logDir = logDir;
    this.retentionDays = retentionDays;
    this.metrics = {
      eventCounts: {} as Record<SecurityEventType, number>,
      suspiciousIPs: new Map(),
      failedAuthAttempts: new Map()
    };
    this.alertWebhook = process.env.SECURITY_ALERT_WEBHOOK;
    this.initializeLogger();
  }

  private async initializeLogger(): Promise<void> {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
      console.log(`[SecurityLogger] Initialized at ${this.logDir}`);
      
      // Start periodic cleanup
      setInterval(() => this.cleanupOldLogs(), 24 * 60 * 60 * 1000); // Daily
    } catch (error) {
      console.error('[SecurityLogger] Initialization error:', error);
    }
  }

  /**
   * Log a security event
   */
  async logEvent(
    type: SecurityEventType,
    severity: SecuritySeverity,
    message: string,
    details: Record<string, unknown> = {},
    userId?: string,
    ip?: string,
    userAgent?: string
  ): Promise<void> {
    const event: SecurityEvent = {
      timestamp: new Date().toISOString(),
      type,
      severity,
      userId,
      ip,
      userAgent,
      details,
      message
    };

    // Update metrics
    this.updateMetrics(event);

    // Write to log file
    await this.writeToFile(event);

    // Send alerts for critical events
    if (severity === SecuritySeverity.CRITICAL || severity === SecuritySeverity.ERROR) {
      await this.sendAlert(event);
    }

    // Console output for monitoring
    const logLevel = severity === SecuritySeverity.CRITICAL ? 'error' : 
                     severity === SecuritySeverity.ERROR ? 'error' : 
                     severity === SecuritySeverity.WARNING ? 'warn' : 'info';
    console[logLevel](`[Security:${type}] ${message}`, details);
  }

  /**
   * Update internal metrics
   */
  private updateMetrics(event: SecurityEvent): void {
    // Event counts
    this.metrics.eventCounts[event.type] = 
      (this.metrics.eventCounts[event.type] || 0) + 1;

    // Track suspicious IPs
    if (event.ip && this.isSuspiciousEvent(event.type)) {
      const count = (this.metrics.suspiciousIPs.get(event.ip) || 0) + 1;
      this.metrics.suspiciousIPs.set(event.ip, count);
    }

    // Track failed auth attempts
    if (event.type === SecurityEventType.AUTH_FAILURE && event.userId) {
      const count = (this.metrics.failedAuthAttempts.get(event.userId) || 0) + 1;
      this.metrics.failedAuthAttempts.set(event.userId, count);
    }
  }

  /**
   * Determine if event type is suspicious
   */
  private isSuspiciousEvent(type: SecurityEventType): boolean {
    return [
      SecurityEventType.AUTH_FAILURE,
      SecurityEventType.XSS_ATTEMPT,
      SecurityEventType.SQL_INJECTION_ATTEMPT,
      SecurityEventType.MALICIOUS_FILENAME,
      SecurityEventType.RATE_LIMIT_EXCEEDED
    ].includes(type);
  }

  /**
   * Write event to log file
   */
  private async writeToFile(event: SecurityEvent): Promise<void> {
    try {
      const date = new Date().toISOString().split('T')[0];
      const logFile = path.join(this.logDir, `security-${date}.log`);
      
      const logEntry = JSON.stringify(event) + '\n';
      await fs.appendFile(logFile, logEntry, 'utf8');
    } catch (error) {
      console.error('[SecurityLogger] Write error:', error);
    }
  }

  /**
   * Send alert for critical events
   */
  private async sendAlert(event: SecurityEvent): Promise<void> {
    if (!this.alertWebhook) {
      return;
    }

    try {
      const alertMessage = {
        text: `🚨 Security Alert: ${event.type}`,
        attachments: [
          {
            color: event.severity === SecuritySeverity.CRITICAL ? 'danger' : 'warning',
            fields: [
              { title: 'Severity', value: event.severity, short: true },
              { title: 'Type', value: event.type, short: true },
              { title: 'Message', value: event.message, short: false },
              { title: 'User ID', value: event.userId || 'N/A', short: true },
              { title: 'IP Address', value: event.ip || 'N/A', short: true },
              { title: 'Timestamp', value: event.timestamp, short: false }
            ]
          }
        ]
      };

      await fetch(this.alertWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertMessage)
      });
    } catch (error) {
      console.error('[SecurityLogger] Alert sending failed:', error);
    }
  }

  /**
   * Get current security metrics
   */
  getMetrics(): SecurityMetrics {
    return {
      eventCounts: { ...this.metrics.eventCounts },
      suspiciousIPs: new Map(this.metrics.suspiciousIPs),
      failedAuthAttempts: new Map(this.metrics.failedAuthAttempts)
    };
  }

  /**
   * Check if IP should be blocked based on suspicious activity
   */
  shouldBlockIP(ip: string, threshold: number = 10): boolean {
    return (this.metrics.suspiciousIPs.get(ip) || 0) >= threshold;
  }

  /**
   * Check if user should be locked based on failed auth attempts
   */
  shouldLockUser(userId: string, threshold: number = 5): boolean {
    return (this.metrics.failedAuthAttempts.get(userId) || 0) >= threshold;
  }

  /**
   * Clean up old log files based on retention policy
   */
  private async cleanupOldLogs(): Promise<void> {
    try {
      const files = await fs.readdir(this.logDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

      for (const file of files) {
        if (!file.startsWith('security-') || !file.endsWith('.log')) {
          continue;
        }

        const filePath = path.join(this.logDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          console.log(`[SecurityLogger] Deleted old log: ${file}`);
        }
      }
    } catch (error) {
      console.error('[SecurityLogger] Cleanup error:', error);
    }
  }

  /**
   * Generate security report
   */
  async generateReport(days: number = 7): Promise<string> {
    const report = {
      period: `Last ${days} days`,
      generatedAt: new Date().toISOString(),
      metrics: this.getMetrics(),
      topSuspiciousIPs: Array.from(this.metrics.suspiciousIPs.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
      topFailedAuthUsers: Array.from(this.metrics.failedAuthAttempts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
    };

    return JSON.stringify(report, null, 2);
  }
}

// Export singleton instance
export const securityLogger = new SecurityLogger(
  path.join(process.cwd(), 'logs', 'security'),
  parseInt(process.env.SECURITY_LOG_RETENTION_DAYS || '90')
);

// Convenience methods
export async function logSecurityEvent(
  type: SecurityEventType,
  severity: SecuritySeverity,
  message: string,
  details?: Record<string, unknown>,
  userId?: string,
  ip?: string,
  userAgent?: string
): Promise<void> {
  await securityLogger.logEvent(type, severity, message, details, userId, ip, userAgent);
}

export function getSecurityMetrics(): SecurityMetrics {
  return securityLogger.getMetrics();
}
