import { and, eq, inArray, isNull, ne, sql } from "@openstatus/db";
import {
  page,
  pageComponent,
  pageSubscriber,
  pageSubscriberToPageComponent,
  selectPageSubscriberSchema,
} from "@openstatus/db/src/schema";
import { detectWebhookFlavor } from "@openstatus/subscriptions";
import { assertSafeUrl } from "@openstatus/utils";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import { ConflictError, NotFoundError, ValidationError } from "../errors";
import { UpdatePageSubscriberChannelInput } from "./schemas";

/**
 * Update a vendor-added subscription's name / webhook URL / headers /
 * component scope. Page ownership is enforced by joining the subscriber
 * fetch to `page` — a single SELECT that confirms (subscriber, page,
 * workspace) all line up.
 *
 * The auth check, channel write, and audit emit run in one transaction:
 * a failed audit insert rolls the channel write back, and there's no
 * race window between ownership confirmation and mutation.
 *
 * Row-level eligibility (vendor vs self-signup, email vs webhook) is
 * enforced inline below — the legacy `updateChannel` helper in
 * `@openstatus/subscriptions` opened its own DB handle so it couldn't
 * share the caller's tx; the logic now lives here instead.
 */
export async function updatePageSubscriberChannel(args: {
  ctx: ServiceContext;
  input: UpdatePageSubscriberChannelInput;
}): Promise<void> {
  const { ctx } = args;
  const input = UpdatePageSubscriberChannelInput.parse(args.input);

  // `assertSafeUrl` does a DNS lookup to block private/internal targets;
  // keep it outside the tx so we don't hold the SQLite write lock across
  // a network call. Flavor check is pure and stays here for symmetry.
  if (input.webhookUrl !== undefined) {
    await assertSafeUrl(input.webhookUrl);
    if (detectWebhookFlavor(input.webhookUrl) === "generic") {
      throw new ValidationError(
        "Only Slack and Discord webhook URLs are supported.",
      );
    }
  }

  await withTransaction(ctx, async (tx) => {
    // One query confirms the subscriber exists, that it's attached to the
    // supplied page, and that the page belongs to the caller's workspace.
    // Any miss surfaces as 404 — we don't distinguish "wrong page" from
    // "wrong workspace" to avoid leaking cross-workspace existence.
    const beforeJoined = await tx
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

    const existing = beforeJoined.subscriber;

    if (existing.source !== "vendor") {
      throw new ValidationError(
        "Self-signup subscribers manage their own subscription; use the unsubscribe action instead.",
      );
    }

    if (existing.channelType === "email") {
      if (input.webhookUrl !== undefined || input.headers !== undefined) {
        throw new ValidationError(
          "Email subscribers do not have webhook fields to edit.",
        );
      }
    }

    const updateFields: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) updateFields.name = input.name;

    if (existing.channelType === "webhook") {
      if (
        input.webhookUrl !== undefined &&
        input.webhookUrl !== existing.webhookUrl
      ) {
        const duplicate = await tx.query.pageSubscriber.findFirst({
          where: and(
            eq(pageSubscriber.pageId, input.pageId),
            sql`LOWER(${pageSubscriber.webhookUrl}) = ${input.webhookUrl.toLowerCase()}`,
            eq(pageSubscriber.channelType, "webhook"),
            isNull(pageSubscriber.unsubscribedAt),
            ne(pageSubscriber.id, input.subscriberId),
          ),
        });
        if (duplicate) {
          throw new ConflictError(
            "A subscriber with this webhook URL already exists for this page.",
          );
        }
        updateFields.webhookUrl = input.webhookUrl;
      }
      if (input.headers !== undefined) {
        // Empty array is truthy in JS, so check `length > 0` — otherwise
        // we'd persist `{"headers":[]}` instead of nulling the column.
        updateFields.channelConfig =
          input.headers.length > 0
            ? JSON.stringify({ headers: input.headers })
            : null;
      }
    }

    if (input.componentIds !== undefined && input.componentIds.length > 0) {
      const valid = await tx
        .select({ id: pageComponent.id })
        .from(pageComponent)
        .where(
          and(
            eq(pageComponent.pageId, input.pageId),
            inArray(pageComponent.id, input.componentIds),
          ),
        )
        .all();
      if (valid.length !== input.componentIds.length) {
        throw new ValidationError(
          "Some components do not belong to this page",
        );
      }
    }

    const updated = await tx
      .update(pageSubscriber)
      .set(updateFields)
      .where(eq(pageSubscriber.id, input.subscriberId))
      .returning()
      .get();

    if (input.componentIds !== undefined) {
      await tx
        .delete(pageSubscriberToPageComponent)
        .where(
          eq(
            pageSubscriberToPageComponent.pageSubscriberId,
            input.subscriberId,
          ),
        )
        .run();

      if (input.componentIds.length > 0) {
        await tx
          .insert(pageSubscriberToPageComponent)
          .values(
            input.componentIds.map((compId) => ({
              pageSubscriberId: input.subscriberId,
              pageComponentId: compId,
            })),
          )
          .run();
      }
    }

    // libSQL HTTP can omit RETURNING rows from a no-op UPDATE; ownership
    // was already proven via `beforeJoined`, so fall back to the pre-image.
    const before = selectPageSubscriberSchema.parse(existing);
    const after = selectPageSubscriberSchema.parse(updated ?? existing);

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
