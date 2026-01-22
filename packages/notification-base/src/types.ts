import type {
  Incident,
  Monitor,
  MonitorRegion,
  Notification,
} from "@openstatus/db/src/schema";

/**
 * Common context passed to all notification providers
 */
export interface NotificationContext {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
  cronTimestamp: number;
  region?: MonitorRegion;
  latency?: number;
}

/**
 * Extended context with incident data for recovery/degraded
 */
export interface NotificationContextWithIncident extends NotificationContext {
  incident: Incident;
}

/**
 * Formatted common message data ready for rendering
 */
export interface FormattedMessageData {
  monitorName: string;
  monitorUrl: string;
  statusCodeFormatted: string;
  errorMessage: string;
  timestampFormatted: string;
  regionDisplay: string;
  latencyDisplay: string;
  dashboardUrl: string;
  incidentDuration?: string;
}

/**
 * Notification type discriminator
 */
export type NotificationType = "alert" | "recovery" | "degraded";
