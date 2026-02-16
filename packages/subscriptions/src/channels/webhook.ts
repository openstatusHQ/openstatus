import { z } from "zod";
import type { PageUpdate, Subscription } from "../types";

/**
 * Webhook channel implementation (Phase 2 - Future)
 * Webhooks are sent individually (not batched like email)
 * as each webhook URL may be different and require its own signature.
 */

export async function validateWebhookConfig(config: unknown) {
  const schema = z.object({
    url: z.string().url(),
    headers: z
      .array(
        z.object({
          key: z.string().min(1),
          value: z.string(),
        }),
      )
      .optional(),
    secret: z.string().optional(),
  });
  const result = schema.safeParse(config);
  return { valid: result.success, error: result.error?.message };
}

/**
 * Type guard to filter subscriptions with webhookUrl
 */
function hasWebhookUrl(
  sub: Subscription,
): sub is Subscription & { webhookUrl: string } {
  return sub.webhookUrl !== undefined && sub.webhookUrl !== null;
}

export async function sendWebhookVerification(
  subscription: Subscription,
  verifyUrl: string,
) {
  if (!subscription.webhookUrl) {
    throw new Error("Webhook URL is required for webhook channel");
  }

  const response = await fetch(subscription.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "verification",
      token: subscription.token,
      verifyUrl,
    }),
    signal: AbortSignal.timeout(10000), // 10s timeout
  });

  if (!response.ok) {
    throw new Error(
      `Webhook verification failed: ${response.status} ${response.statusText}`,
    );
  }
}

/**
 * Send notifications to multiple webhook subscribers.
 * Note: Webhooks are sent individually (not batched like email)
 * as each webhook URL may be different and require its own signature.
 */
export async function sendWebhookNotifications(
  subscriptions: Subscription[],
  pageUpdate: PageUpdate,
) {
  // Filter subscriptions with webhookUrl
  const validSubscriptions = subscriptions.filter(hasWebhookUrl);
  if (validSubscriptions.length === 0) return;

  // Send webhooks in parallel
  await Promise.allSettled(
    validSubscriptions.map(async (subscription) => {
      const config = subscription.channelConfig
        ? JSON.parse(subscription.channelConfig)
        : {};

      const payload = {
        type: "page_update", // status reports, maintenance, incidents, etc.
        page: { id: subscription.pageId, name: subscription.pageName },
        update: {
          id: pageUpdate.id,
          title: pageUpdate.title,
          status: pageUpdate.status,
          message: pageUpdate.message,
          pageComponents: pageUpdate.pageComponents,
          date: pageUpdate.date,
        },
      };

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "OpenStatus-Webhooks/1.0",
      };

      // Add custom headers if configured
      if (config.headers) {
        for (const header of config.headers) {
          headers[header.key] = header.value;
        }
      }

      // TODO: Add HMAC signature if secret is provided
      // const signature = config.secret ? createHmac(config.secret, payload) : undefined;
      // if (signature) headers['X-OpenStatus-Signature'] = signature;

      try {
        const response = await fetch(subscription.webhookUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000), // 10s timeout
        });

        if (!response.ok) {
          console.error(
            `Webhook notification failed for ${subscription.webhookUrl}: ${response.status} ${response.statusText}`,
          );
          throw new Error(`Webhook returned ${response.status}`);
        }
      } catch (error) {
        console.error(
          `Failed to send webhook notification to ${subscription.webhookUrl}:`,
          error,
        );
        throw error;
      }
    }),
  );
}
