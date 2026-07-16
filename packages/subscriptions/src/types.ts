// Core types for the subscription system

import type { PageComponentImpact } from "@openstatus/db/src/schema/page_components/constants";

export interface Subscription {
  id: number;
  pageId: number;
  pageName: string;
  pageSlug: string;
  customDomain?: string | null;
  componentIds: number[]; // Empty = entire page

  // Only ONE identifier populated based on channelType
  channelType: "email" | "webhook" | "slack";
  email?: string;
  webhookUrl?: string;
  slackChannelId?: string;
  channelConfig?: string; // JSON string for headers, secrets, slack teamId, etc.

  token?: string;
  acceptedAt?: Date;
  unsubscribedAt?: Date;
}

/**
 * Generic page update (status reports, maintenance, incidents, etc.)
 * Used for all types of notifications sent to subscribers
 */
export interface PageUpdate {
  id: number;
  pageId: number;
  title: string;
  status:
    | "investigating"
    | "identified"
    | "monitoring"
    | "resolved"
    | "maintenance";
  message: string;
  pageComponentIds: number[];
  pageComponents: string[];
  date: string; // can be single string or "from - to"

  // Optional fields consumed by the prepared (staged) generic webhook payload.
  // Populated by the matching dispatcher; ignored by email/Slack/Discord
  // builders, which key off the fields above.
  updateId?: number; // statusReportUpdate.id (status reports only)
  pageComponentsWithId?: { id: number; name: string }[];
  // Current impact per component as of this update (not the raw delta).
  componentsWithImpact?: {
    id: number;
    name: string;
    impact: PageComponentImpact;
  }[];
  startsAt?: string; // maintenance only, ISO
  endsAt?: string; // maintenance only, ISO
}

/**
 * Interface for notification channels (email, webhook, etc.)
 * Channels handle the actual delivery of notifications.
 */
export interface SubscriptionChannel {
  id: string;

  // Validate channel-specific config
  validateConfig(config: unknown): Promise<{ valid: boolean; error?: string }>;

  // Send verification if needed
  sendVerification?(
    subscription: Subscription,
    verifyUrl: string,
  ): Promise<void>;

  // Send notifications to multiple subscribers (batched)
  sendNotifications(
    subscriptions: Subscription[],
    pageUpdate: PageUpdate,
  ): Promise<void>;
}
