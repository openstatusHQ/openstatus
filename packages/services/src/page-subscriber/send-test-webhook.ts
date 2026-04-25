import { sendTestWebhook as sendTestWebhookImpl } from "@openstatus/subscriptions";

import { type ServiceContext, withTransaction } from "../context";
import { loadPageForWorkspace, rethrowSubscriptionError } from "./internal";
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

  await withTransaction(ctx, async (tx) => {
    await loadPageForWorkspace({
      tx,
      pageId: input.pageId,
      workspaceId: ctx.workspace.id,
    });
  });

  try {
    await sendTestWebhookImpl(input.subscriberId, input.pageId);
  } catch (error) {
    rethrowSubscriptionError(error);
  }
}
