import { and, eq, isNull, sql } from "@openstatus/db";
import {
  page,
  pageSubscriber,
  selectPageSubscriberSchema,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import {
  type DB,
  type ServiceContext,
  getReadDb,
  withTransaction,
} from "../context";
import { NotFoundError } from "../errors";
import { assertSubscribersAllowed, parseWorkspaceForContext } from "./internal";
import {
  type CreateSlackSubscriberInput,
  type ListSlackSubscribersInput,
  type RemoveSlackSubscriberInput,
  CreateSlackSubscriberInput as CreateSlackSubscriberSchema,
  ListSlackSubscribersInput as ListSlackSubscribersSchema,
  RemoveSlackSubscriberInput as RemoveSlackSubscriberSchema,
} from "./schemas";

export interface SlackSubscriberResult {
  id: number;
  pageId: number;
  pageName: string;
  pageSlug: string;
  customDomain: string | null;
  alreadySubscribed: boolean;
}

function channelLabel(channelId: string, channelName?: string): string {
  return channelName ? `#${channelName}` : channelId;
}

/**
 * Self-signup for a Slack channel via `/openstatus subscribe <url>`. There is no
 * authenticated workspace at the call site — both workspace and audit actor
 * are resolved from the page. Auto-accepted (the slash command is consent).
 */
// Token-addressed self-service by an anonymous visitor: the audit actor is
// `subscriber`, for which `requireScope` is a documented no-op.
// oxlint-disable-next-line openstatus/services-mutation-guards
export async function createSlackSubscriber(args: {
  input: CreateSlackSubscriberInput;
  db?: DB;
}): Promise<SlackSubscriberResult> {
  const input = CreateSlackSubscriberSchema.parse(args.input);

  const readDb = getReadDb({ db: args.db } as ServiceContext);
  const pageData = await readDb.query.page.findFirst({
    where: eq(page.id, input.pageId),
    with: { workspace: true },
  });
  if (!pageData) {
    throw new NotFoundError("page", input.pageId);
  }
  const workspace = parseWorkspaceForContext(pageData.workspace);
  assertSubscribersAllowed(workspace);

  const channelConfig = JSON.stringify({
    teamId: input.teamId,
    channelId: input.channelId,
    channelName: input.channelName,
  });
  const name = channelLabel(input.channelId, input.channelName);

  return withTransaction({ db: args.db } as ServiceContext, async (tx) => {
    const existing = await tx.query.pageSubscriber.findFirst({
      where: and(
        eq(pageSubscriber.pageId, input.pageId),
        eq(pageSubscriber.slackChannelId, input.channelId),
        eq(pageSubscriber.channelType, "slack"),
      ),
    });

    if (existing && !existing.unsubscribedAt) {
      return {
        id: existing.id,
        pageId: pageData.id,
        pageName: pageData.title,
        pageSlug: pageData.slug,
        customDomain: pageData.customDomain,
        alreadySubscribed: true,
      };
    }

    if (existing) {
      const before = selectPageSubscriberSchema.parse(existing);
      const updated = await tx
        .update(pageSubscriber)
        .set({
          unsubscribedAt: null,
          acceptedAt: new Date(),
          channelConfig,
          name,
          updatedAt: new Date(),
        })
        .where(eq(pageSubscriber.id, existing.id))
        .returning()
        .get();
      const after = selectPageSubscriberSchema.parse(updated ?? existing);

      const auditCtx: ServiceContext = {
        workspace,
        actor: { type: "subscriber", subscriberId: existing.id },
        db: tx,
      };
      const { token: _bt, ...beforeSnap } = before;
      const { token: _at, ...afterSnap } = after;
      await emitAudit(tx, auditCtx, {
        action: "page_subscriber.update",
        entityType: "page_subscriber",
        entityId: existing.id,
        before: beforeSnap,
        after: afterSnap,
      });

      return {
        id: existing.id,
        pageId: pageData.id,
        pageName: pageData.title,
        pageSlug: pageData.slug,
        customDomain: pageData.customDomain,
        alreadySubscribed: false,
      };
    }

    const inserted = await tx
      .insert(pageSubscriber)
      .values({
        channelType: "slack",
        slackChannelId: input.channelId,
        channelConfig,
        pageId: input.pageId,
        source: "self_signup",
        name,
        acceptedAt: new Date(),
      })
      .returning()
      .get();

    const auditCtx: ServiceContext = {
      workspace,
      actor: { type: "subscriber", subscriberId: inserted.id },
      db: tx,
    };
    const { token: _t, ...after } = selectPageSubscriberSchema.parse(inserted);
    await emitAudit(tx, auditCtx, {
      action: "page_subscriber.create",
      entityType: "page_subscriber",
      entityId: inserted.id,
      after,
    });

    return {
      id: inserted.id,
      pageId: pageData.id,
      pageName: pageData.title,
      pageSlug: pageData.slug,
      customDomain: pageData.customDomain,
      alreadySubscribed: false,
    };
  });
}

// Token-addressed self-service by an anonymous visitor: the audit actor is
// `subscriber`, for which `requireScope` is a documented no-op.
// oxlint-disable-next-line openstatus/services-mutation-guards
export async function removeSlackSubscriber(args: {
  input: RemoveSlackSubscriberInput;
  db?: DB;
}): Promise<{ removed: boolean }> {
  const input = RemoveSlackSubscriberSchema.parse(args.input);

  const readDb = getReadDb({ db: args.db } as ServiceContext);
  const pageData = await readDb.query.page.findFirst({
    where: eq(page.id, input.pageId),
    with: { workspace: true },
  });
  if (!pageData) {
    throw new NotFoundError("page", input.pageId);
  }
  const workspace = parseWorkspaceForContext(pageData.workspace);

  return withTransaction({ db: args.db } as ServiceContext, async (tx) => {
    const existing = await tx.query.pageSubscriber.findFirst({
      where: and(
        eq(pageSubscriber.pageId, input.pageId),
        eq(pageSubscriber.slackChannelId, input.channelId),
        eq(pageSubscriber.channelType, "slack"),
        sql`json_extract(${pageSubscriber.channelConfig}, '$.teamId') = ${input.teamId}`,
        isNull(pageSubscriber.unsubscribedAt),
      ),
    });
    if (!existing) return { removed: false };

    const before = selectPageSubscriberSchema.parse(existing);
    const updated = await tx
      .update(pageSubscriber)
      .set({ unsubscribedAt: new Date(), updatedAt: new Date() })
      .where(eq(pageSubscriber.id, existing.id))
      .returning()
      .get();
    const after = selectPageSubscriberSchema.parse(updated ?? existing);

    const auditCtx: ServiceContext = {
      workspace,
      actor: { type: "subscriber", subscriberId: existing.id },
      db: tx,
    };
    const { token: _bt, ...beforeSnap } = before;
    const { token: _at, ...afterSnap } = after;
    await emitAudit(tx, auditCtx, {
      action: "page_subscriber.update",
      entityType: "page_subscriber",
      entityId: existing.id,
      before: beforeSnap,
      after: afterSnap,
    });

    return { removed: true };
  });
}

/**
 * Unsubscribes every channel of a Slack team, on any workspace's page, when
 * the app is removed from that team. Audited per subscriber as `system`.
 */
// Called by `uninstallSlackTeam` for a team, not a workspace: each row is
// audited in its page's workspace, and a system actor has no scope to check.
// oxlint-disable-next-line openstatus/services-mutation-guards
export async function removeSlackTeamSubscribers(args: {
  input: { teamId: string };
  job: string;
  db?: DB;
}): Promise<number> {
  const { teamId } = args.input;
  return withTransaction({ db: args.db } as ServiceContext, async (tx) => {
    const rows = await tx.query.pageSubscriber.findMany({
      where: and(
        eq(pageSubscriber.channelType, "slack"),
        isNull(pageSubscriber.unsubscribedAt),
        sql`json_extract(${pageSubscriber.channelConfig}, '$.teamId') = ${teamId}`,
      ),
      with: { page: { with: { workspace: true } } },
    });
    for (const existing of rows) {
      const updated = await tx
        .update(pageSubscriber)
        .set({ unsubscribedAt: new Date(), updatedAt: new Date() })
        .where(eq(pageSubscriber.id, existing.id))
        .returning()
        .get();
      if (!existing.page?.workspace) continue;
      const { page: _page, ...existingRow } = existing;
      const { token: _bt, ...beforeSnap } =
        selectPageSubscriberSchema.parse(existingRow);
      const { token: _at, ...afterSnap } = selectPageSubscriberSchema.parse(
        updated ?? existingRow,
      );
      await emitAudit(
        tx,
        {
          workspace: parseWorkspaceForContext(existing.page.workspace),
          actor: { type: "system", job: args.job },
          db: tx,
        },
        {
          action: "page_subscriber.update",
          entityType: "page_subscriber",
          entityId: existing.id,
          before: beforeSnap,
          after: afterSnap,
        },
      );
    }
    return rows.length;
  });
}

export interface SlackSubscriptionSummary {
  id: number;
  pageId: number;
  pageName: string;
  pageSlug: string;
  customDomain: string | null;
}

export async function listSlackSubscribersForChannel(args: {
  input: ListSlackSubscribersInput;
  db?: DB;
}): Promise<SlackSubscriptionSummary[]> {
  const input = ListSlackSubscribersSchema.parse(args.input);
  const readDb = getReadDb({ db: args.db } as ServiceContext);

  const rows = await readDb.query.pageSubscriber.findMany({
    where: and(
      eq(pageSubscriber.slackChannelId, input.channelId),
      eq(pageSubscriber.channelType, "slack"),
      sql`json_extract(${pageSubscriber.channelConfig}, '$.teamId') = ${input.teamId}`,
      isNull(pageSubscriber.unsubscribedAt),
    ),
    with: { page: true },
  });

  return rows.map((row) => ({
    id: row.id,
    pageId: row.pageId,
    pageName: row.page.title,
    pageSlug: row.page.slug,
    customDomain: row.page.customDomain,
  }));
}
