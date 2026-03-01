import { z } from "zod";
import type { PageUpdate, Subscription } from "../types";

export async function validateWebhookConfig(config: unknown) {
  const schema = z.object({
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
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(
      `Webhook verification failed: ${response.status} ${response.statusText}`,
    );
  }
}

export async function sendWebhookNotifications(
  subscriptions: Subscription[],
  pageUpdate: PageUpdate,
) {
  const validSubscriptions = subscriptions.filter(hasWebhookUrl);
  if (validSubscriptions.length === 0) return;

  await Promise.allSettled(
    validSubscriptions.map(async (subscription) => {
      let config: Record<string, unknown> = {};
      try {
        config = subscription.channelConfig
          ? JSON.parse(subscription.channelConfig)
          : {};
      } catch {
        console.error(
          `Invalid channelConfig JSON for subscription ${subscription.id}`,
        );
      }

      const payload = {
        type: "page_update",
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

      if (config.headers) {
        for (const header of config.headers as {
          key: string;
          value: string;
        }[]) {
          headers[header.key] = header.value;
        }
      }

      try {
        const response = await fetch(subscription.webhookUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
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
