// Core types for the subscription system

export interface Subscription {
  id: number;
  pageId: number;
  pageName: string; // For templates
  pageSlug: string; // For management URLs
  customDomain?: string | null; // For custom domain URLs
  workspaceId: number;
  componentIds: number[]; // Empty = entire page

  // Channel (only ONE identifier populated based on channelType)
  channelType: "email" | "webhook";
  email?: string; // For email channel
  webhookUrl?: string; // For webhook channel
  channelConfig?: string; // JSON string for headers, secrets, etc.

  token: string;
  verifiedAt?: Date;
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
  pageComponentIds: number[]; // For subscription matching
  pageComponents: string[]; // Component names for display
  date: string; // can be single string or "from - to"
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
