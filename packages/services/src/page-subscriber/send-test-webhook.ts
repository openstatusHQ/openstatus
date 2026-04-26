import { and, eq } from "@openstatus/db";
import { pageSubscriber } from "@openstatus/db/src/schema";
import {
  detectWebhookFlavor,
  sendTestWebhookRequest,
} from "@openstatus/subscriptions";

import { type ServiceContext, withTransaction } from "../context";
import { NotFoundError, ValidationError } from "../errors";
import { loadPageForWorkspace } from "./internal";
import { SendPageSubscriberTestWebhookInput } from "./schemas";

/**
 * Send a test payload to a vendor-added webhook subscriber.
 *
 * No audit emit — a test dispatch has no effect on the entity's durable
 * state. If we add "last-tested-at" bookkeeping later, we'd revisit.
 */
export async function sendPageSubscriberTestWebhook(args: {
  ctx: ServiceContext;
  input: SendPageSubscriberTestWebhookInput;
}): Promise<void> {
  const { ctx } = args;
  const input = SendPageSubscriberTestWebhookInput.parse(args.input);

  const existing = await withTransaction(ctx, async (tx) => {
    await loadPageForWorkspace({
      tx,
      pageId: input.pageId,
      workspaceId: ctx.workspace.id,
    });
    return tx.query.pageSubscriber.findFirst({
      where: and(
        eq(pageSubscriber.id, input.subscriberId),
        eq(pageSubscriber.pageId, input.pageId),
      ),
    });
  });

  if (!existing) {
    throw new NotFoundError("page_subscriber", input.subscriberId);
  }
  if (existing.source !== "vendor") {
    throw new ValidationError(
      "Only vendor-added webhook subscribers support test dispatch.",
    );
  }
  if (existing.channelType !== "webhook" || !existing.webhookUrl) {
    throw new ValidationError("Subscriber is not a webhook channel");
  }
  if (existing.unsubscribedAt) {
    throw new ValidationError("Subscriber is unsubscribed");
  }

  const flavor = detectWebhookFlavor(existing.webhookUrl);
  const headers = parseWebhookHeaders(existing.channelConfig);
  await sendTestWebhookRequest({
    url: existing.webhookUrl,
    flavor,
    headers,
  });
}

function parseWebhookHeaders(
  channelConfig: string | null,
): Record<string, string> {
  if (!channelConfig) return {};
  try {
    const config = JSON.parse(channelConfig) as {
      headers?: { key: string; value: string }[];
    };
    const headers: Record<string, string> = {};
    for (const h of config.headers ?? []) {
      headers[h.key] = h.value;
    }
    return headers;
  } catch {
    return {};
  }
}
