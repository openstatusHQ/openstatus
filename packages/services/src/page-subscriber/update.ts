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
 * workspace) all line up.
 *
 * Atomicity: `updateChannel` lives in `@openstatus/subscriptions` and
 * runs against its own DB handle (no tx threading), so the auth check
 * and the channel write can't share a transaction. We mitigate the race
 * by re-running the ownership join inside the audit transaction *after*
 * `updateChannel` returns — if the page has since moved workspaces or
 * been deleted, we throw `NotFoundError` and roll back the audit. The
 * channel write itself has already happened, but the caller gets a
 * 404 rather than a silent cross-workspace bypass.
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

  await withTransaction(ctx, async (tx) => {
    // Re-verify ownership *after* the channel write. Catches the
    // workspace-move / page-delete race window between the initial
    // auth read and `updateChannel`. We deliberately use the same join
    // shape so a transferred page surfaces as a clean 404.
    const afterJoined = await tx
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

    if (!afterJoined) {
      throw new NotFoundError("page_subscriber", input.subscriberId);
    }

    const before = selectPageSubscriberSchema.parse(beforeJoined.subscriber);
    const after = selectPageSubscriberSchema.parse(afterJoined.subscriber);

    // `token` is the self-manage / unsubscribe capability; never audit it.
    const { token: _beforeToken, ...beforeSnap } = before;
    const { token: _afterToken, ...afterSnap } = after;

    await emitAudit(tx, ctx, {
      action: "page_subscriber.update",
      entityType: "page_subscriber",
      entityId: input.subscriberId,
      before: beforeSnap,
      after: afterSnap,
    });
  });
}
