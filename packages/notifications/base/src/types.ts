import type {
  Incident,
  Monitor,
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
  regions?: string[];
  latency?: number;
  incident?: Incident;
}

/**
 * Formatted common message data ready for rendering
 */
export interface FormattedMessageData {
  monitorName: string;
  monitorUrl: string;
  monitorMethod?: string;
  monitorJobType: string;
  statusCodeFormatted: string;
  errorMessage: string;
  timestampFormatted: string;
  regionsDisplay: string;
  latencyDisplay: string;
  dashboardUrl: string;
  incidentDuration?: string;
}

/**
 * Notification type discriminator
 */
export type NotificationType = "alert" | "recovery" | "degraded";
