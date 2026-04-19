import { COLORS, COLOR_DECIMALS } from "@openstatus/notification-base";
import { assertSafeUrl } from "@openstatus/utils";
import { z } from "zod";
import type { PageUpdate, Subscription } from "../types";

export type WebhookFlavor = "slack" | "discord" | "generic";

const SLACK_PREFIX = "https://hooks.slack.com/services/";
const DISCORD_PREFIX = "https://discord.com/api/webhooks/";

/**
 * Classify a webhook URL by its incoming-webhook origin so we can emit
 * channel-native payloads. Unknown URLs fall back to generic JSON.
 */
export function detectWebhookFlavor(url: string): WebhookFlavor {
  if (url.startsWith(SLACK_PREFIX)) return "slack";
  if (url.startsWith(DISCORD_PREFIX)) return "discord";
  return "generic";
}

function resolveStatusPageOrigin(subscription: Subscription): string {
  return subscription.customDomain
    ? `https://${subscription.customDomain}`
    : `https://${subscription.pageSlug}.openstatus.dev`;
}

function buildManagementLinks(subscription: Subscription) {
  if (!subscription.token) {
    return { manageUrl: null, unsubscribeUrl: null };
  }
  const origin = resolveStatusPageOrigin(subscription);
  return {
    manageUrl: `${origin}/manage/${subscription.token}`,
    unsubscribeUrl: `${origin}/unsubscribe/${subscription.token}`,
  };
}

type StatusColor = "red" | "yellow" | "green" | "blue";

function statusColor(status: PageUpdate["status"]): StatusColor {
  switch (status) {
    case "investigating":
    case "identified":
      return "red";
    case "monitoring":
      return "yellow";
    case "resolved":
      return "green";
    case "maintenance":
      return "blue";
  }
}

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

  await assertSafeUrl(subscription.webhookUrl);
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

type ManagementLinks = ReturnType<typeof buildManagementLinks>;

function buildSlackPayload(
  pageUpdate: PageUpdate,
  subscription: Subscription,
  links: ManagementLinks,
) {
  const color = statusColor(pageUpdate.status);

  const blocks: Record<string, unknown>[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: pageUpdate.title,
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Status*\n${pageUpdate.status}`,
        },
        {
          type: "mrkdwn",
          text: `*Page*\n${subscription.pageName}`,
        },
      ],
    },
  ];

  if (pageUpdate.message) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: pageUpdate.message,
      },
    });
  }

  if (pageUpdate.pageComponents.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Affected*\n${pageUpdate.pageComponents.join(", ")}`,
      },
    });
  }

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: pageUpdate.date,
      },
    ],
  });

  if (links.manageUrl && links.unsubscribeUrl) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `<${links.manageUrl}|Manage> · <${links.unsubscribeUrl}|Unsubscribe>`,
        },
      ],
    });
  }

  return {
    attachments: [
      {
        color: COLORS[color],
        blocks,
      },
    ],
  };
}

function buildDiscordPayload(
  pageUpdate: PageUpdate,
  subscription: Subscription,
  links: ManagementLinks,
) {
  const color = statusColor(pageUpdate.status);

  const descriptionParts: string[] = [];
  if (pageUpdate.message) descriptionParts.push(pageUpdate.message);
  if (pageUpdate.pageComponents.length > 0) {
    descriptionParts.push(
      `**Affected:** ${pageUpdate.pageComponents.join(", ")}`,
    );
  }
  if (links.manageUrl && links.unsubscribeUrl) {
    descriptionParts.push(
      `[Manage](${links.manageUrl}) · [Unsubscribe](${links.unsubscribeUrl})`,
    );
  }

  return {
    embeds: [
      {
        title: pageUpdate.title,
        description: descriptionParts.join("\n\n") || undefined,
        color: COLOR_DECIMALS[color],
        fields: [
          {
            name: "Status",
            value: pageUpdate.status,
            inline: true,
          },
          {
            name: "Page",
            value: subscription.pageName,
            inline: true,
          },
        ],
        footer: {
          text: pageUpdate.date,
        },
      },
    ],
  };
}

function buildGenericPayload(
  pageUpdate: PageUpdate,
  subscription: Subscription,
  links: ManagementLinks,
) {
  return {
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
    manageUrl: links.manageUrl,
    unsubscribeUrl: links.unsubscribeUrl,
  };
}

function buildNotificationPayload(
  pageUpdate: PageUpdate,
  subscription: Subscription,
) {
  if (!hasWebhookUrl(subscription)) {
    throw new Error("Subscription has no webhook URL");
  }
  const flavor = detectWebhookFlavor(subscription.webhookUrl);
  const links = buildManagementLinks(subscription);

  switch (flavor) {
    case "slack":
      return buildSlackPayload(pageUpdate, subscription, links);
    case "discord":
      return buildDiscordPayload(pageUpdate, subscription, links);
    case "generic":
      return buildGenericPayload(pageUpdate, subscription, links);
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

      const payload = buildNotificationPayload(pageUpdate, subscription);

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
        await assertSafeUrl(subscription.webhookUrl);
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

/**
 * Build a flavor-specific test payload (used by the "Send test" row action).
 * Exported for unit-test coverage; also called by `sendTestWebhookRequest`.
 */
export function buildTestPayload(flavor: WebhookFlavor) {
  switch (flavor) {
    case "slack":
      return {
        attachments: [
          {
            color: COLORS.green,
            blocks: [
              {
                type: "header",
                text: {
                  type: "plain_text",
                  text: "Test Notification",
                  emoji: false,
                },
              },
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: "Your openstatus webhook is configured correctly.",
                },
              },
            ],
          },
        ],
      };
    case "discord":
      return {
        embeds: [
          {
            title: "Test Notification",
            description: "Your openstatus webhook is configured correctly.",
            color: COLOR_DECIMALS.green,
            timestamp: new Date().toISOString(),
          },
        ],
      };
    case "generic":
      return {
        type: "test",
        message: "Your openstatus webhook is configured correctly.",
        timestamp: new Date().toISOString(),
      };
  }
}

/**
 * Send a test payload to the given webhook URL. SSRF-checked and timeout-capped.
 * Throws on non-2xx or network error.
 */
export async function sendTestWebhookRequest(input: {
  url: string;
  flavor: WebhookFlavor;
  headers?: Record<string, string>;
}) {
  const { url, flavor, headers: extraHeaders = {} } = input;
  await assertSafeUrl(url);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "OpenStatus-Webhooks/1.0",
    ...extraHeaders,
  };

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(buildTestPayload(flavor)),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(
      `Test webhook failed: ${response.status} ${response.statusText}`,
    );
  }
}
