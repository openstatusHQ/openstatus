import { and, eq, inArray, isNull, sql } from "@openstatus/db";
import {
  pageComponent,
  pageSubscriber,
  pageSubscriberToPageComponent,
  selectPageSubscriberSchema,
} from "@openstatus/db/src/schema";
import { detectWebhookFlavor } from "@openstatus/subscriptions";
import { assertSafeUrl } from "@openstatus/utils";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import { ConflictError, ValidationError } from "../errors";
import {
  assertSubscribersAllowed,
  loadPageForWorkspace,
  parseWorkspaceForContext,
} from "./internal";
import { CreatePageSubscriberInput } from "./schemas";

export type CreatePageSubscriberResult = {
  id: number;
  row: typeof pageSubscriber.$inferSelect;
  componentIds: number[];
};

/**
 * Create a **vendor-added** page subscriber — a workspace member adds
 * someone (typically a partner) from the dashboard / RPC. Always
 * inserts with `source: "vendor"`, skips the verification flow, stamps
 * `acceptedAt` immediately. A `token` is still generated so the
 * partner can self-manage via `/manage/{token}` and
 * `/unsubscribe/{token}`.
 *
 * NOT for self-serve subscriptions originating from the public status
 * page — those go through `upsertEmailSubscription` in
 * `@openstatus/subscriptions`, which inserts with the default
 * `source: "self_signup"`, runs the email verification flow, and
 * intentionally emits no audit row (visitor action, not a workspace
 * mutation).
 *
 * The dedup queries below are deliberately source-agnostic: an active
 * row of *either* source for the same (page, email|webhookUrl) blocks
 * the vendor add. That prevents duplicate notification fanout when a
 * visitor self-subscribed before the vendor add.
 *
 * Single transaction: plan-gate, dedup, INSERT, join inserts, and the
 * audit emit all run in one `withTransaction` block. A failed audit
 * row rolls the subscriber back — fail-closed audit guarantee from
 * CLAUDE.md is preserved.
 */
export async function createPageSubscriber(args: {
  ctx: ServiceContext;
  input: CreatePageSubscriberInput;
}): Promise<CreatePageSubscriberResult> {
  const { ctx } = args;
  const input = CreatePageSubscriberInput.parse(args.input);
  const componentIds = input.componentIds ?? [];

  // Webhook URL pre-checks happen outside the tx. `assertSafeUrl` does
  // a DNS resolution to block private/internal targets — keeping it
  // outside avoids holding the SQLite write lock across a network call.
  if (input.channelType === "webhook") {
    await assertSafeUrl(input.webhookUrl);
    if (detectWebhookFlavor(input.webhookUrl) === "generic") {
      throw new ValidationError(
        "Only Slack and Discord webhook URLs are supported.",
      );
    }
  }

  return withTransaction(ctx, async (tx) => {
    const pageWithWorkspace = await loadPageForWorkspace({
      tx,
      pageId: input.pageId,
      workspaceId: ctx.workspace.id,
    });
    assertSubscribersAllowed(
      parseWorkspaceForContext(pageWithWorkspace.workspace),
    );

    if (componentIds.length > 0) {
      const valid = await tx
        .select({ id: pageComponent.id })
        .from(pageComponent)
        .where(
          and(
            eq(pageComponent.pageId, input.pageId),
            inArray(pageComponent.id, componentIds),
          ),
        )
        .all();
      if (valid.length !== componentIds.length) {
        throw new ValidationError("Some components do not belong to this page");
      }
    }

    let emailLower: string | null = null;
    let webhookUrl: string | null = null;
    let channelConfig: string | null = null;

    if (input.channelType === "email") {
      emailLower = input.email.toLowerCase();
      const dup = await tx.query.pageSubscriber.findFirst({
        where: and(
          eq(pageSubscriber.pageId, input.pageId),
          eq(pageSubscriber.email, emailLower),
          eq(pageSubscriber.channelType, "email"),
          isNull(pageSubscriber.unsubscribedAt),
        ),
      });
      if (dup) {
        throw new ConflictError(
          "A subscriber with this email already exists for this page.",
        );
      }
    } else {
      webhookUrl = input.webhookUrl;
      const dup = await tx.query.pageSubscriber.findFirst({
        where: and(
          eq(pageSubscriber.pageId, input.pageId),
          sql`LOWER(${pageSubscriber.webhookUrl}) = ${webhookUrl.toLowerCase()}`,
          eq(pageSubscriber.channelType, "webhook"),
          isNull(pageSubscriber.unsubscribedAt),
        ),
      });
      if (dup) {
        throw new ConflictError(
          "A subscriber with this webhook URL already exists for this page.",
        );
      }
      // Empty array is truthy in JS, so check `length > 0` — otherwise
      // we'd persist `{"headers":[]}` instead of leaving the column null.
      channelConfig =
        input.headers && input.headers.length > 0
          ? JSON.stringify({ headers: input.headers })
          : null;
    }

    const row = await tx
      .insert(pageSubscriber)
      .values({
        channelType: input.channelType,
        email: emailLower,
        webhookUrl,
        channelConfig,
        pageId: input.pageId,
        source: "vendor",
        name: input.name ?? null,
        token: crypto.randomUUID(),
        acceptedAt: new Date(),
        expiresAt: null,
      })
      .returning()
      .get();

    if (componentIds.length > 0) {
      await tx
        .insert(pageSubscriberToPageComponent)
        .values(
          componentIds.map((compId) => ({
            pageSubscriberId: row.id,
            pageComponentId: compId,
          })),
        )
        .run();
    }

    // Strip the management `token` — capability for the self-manage /
    // unsubscribe URLs, must never land in the audit log.
    const parsed = selectPageSubscriberSchema.parse(row);
    const { token: _token, ...after } = parsed;
    await emitAudit(tx, ctx, {
      action: "page_subscriber.create",
      entityType: "page_subscriber",
      entityId: parsed.id,
      after,
      metadata: componentIds.length ? { componentIds } : undefined,
    });

    return { id: row.id, row, componentIds };
  });
}
