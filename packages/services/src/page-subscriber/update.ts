import { and, db as defaultDb, eq } from "@openstatus/db";
import {
  page,
  pageSubscriber,
  selectPageSubscriberSchema,
} from "@openstatus/db/src/schema";
import { updateChannel } from "@openstatus/subscriptions";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import { NotFoundError } from "../errors";
import { rethrowSubscriptionError } from "./internal";
import { UpdatePageSubscriberChannelInput } from "./schemas";

/**
 * Update a vendor-added subscription's name / webhook URL / headers /
 * component scope. Page ownership is enforced by joining the subscriber
 * fetch to `page` — a single SELECT that confirms (subscriber, page,
 * workspace) all line up. This closes the race window where a between-
 * tx page delete or workspace move could let a stale snapshot through.
 *
 * Row-level eligibility (vendor vs self-signup, email vs webhook) is
 * enforced inside `@openstatus/subscriptions`.
 */
export async function updatePageSubscriberChannel(args: {
  ctx: ServiceContext;
  input: UpdatePageSubscriberChannelInput;
}): Promise<void> {
  const { ctx } = args;
  const input = UpdatePageSubscriberChannelInput.parse(args.input);

  const db = ctx.db ?? defaultDb;

  // One query, one round-trip: confirms the subscriber exists, that
  // it's attached to the supplied page, and that the page belongs to
  // the caller's workspace. Any miss surfaces as 404 — we don't
  // distinguish "wrong page" from "wrong workspace" to avoid leaking
  // cross-workspace existence.
  const beforeJoined = await db
    .select({ subscriber: pageSubscriber })
    .from(pageSubscriber)
    .innerJoin(page, eq(pageSubscriber.pageId, page.id))
    .where(
      and(
        eq(pageSubscriber.id, input.subscriberId),
        eq(pageSubscriber.pageId, input.pageId),
        eq(page.workspaceId, ctx.workspace.id),
      ),
    )
    .get();

  if (!beforeJoined) {
    throw new NotFoundError("page_subscriber", input.subscriberId);
  }

  try {
    await updateChannel({
      subscriberId: input.subscriberId,
      pageId: input.pageId,
      name: input.name === undefined ? undefined : input.name,
      webhookUrl: input.webhookUrl,
      channelConfig:
        input.headers !== undefined ? { headers: input.headers } : undefined,
      componentIds: input.componentIds,
    });
  } catch (error) {
    rethrowSubscriptionError(error);
  }

  const afterRow = await db.query.pageSubscriber.findFirst({
    where: eq(pageSubscriber.id, input.subscriberId),
  });
  if (!afterRow) return;

  const before = selectPageSubscriberSchema.parse(beforeJoined.subscriber);
  const after = selectPageSubscriberSchema.parse(afterRow);

  // `token` is the self-manage / unsubscribe capability; never audit it.
  const { token: _beforeToken, ...beforeSnap } = before;
  const { token: _afterToken, ...afterSnap } = after;

  await withTransaction(ctx, async (tx) => {
    await emitAudit(tx, ctx, {
      action: "page_subscriber.update",
      entityType: "page_subscriber",
      entityId: input.subscriberId,
      before: beforeSnap,
      after: afterSnap,
    });
  });
}
