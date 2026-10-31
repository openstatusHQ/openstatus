import { and, eq, isNull } from "@openstatus/db";
import { page, pageSubscriber } from "@openstatus/db/src/schema";

import { requireScope } from "../auth";
import { type ServiceContext, getReadDb } from "../context";
import { NotFoundError } from "../errors";
import { ListPageSubscribersInput } from "./schemas";

/**
 * Reduce a webhook URL to its origin for non-vendor rows so the secret
 * path isn't exposed back through the dashboard list. Vendor rows own the
 * full URL + channelConfig and get it verbatim.
 *
 * Malformed URLs surface as a `<malformed>` sentinel + a warning log
 * rather than `null`. `null` would silently drop the row's destination
 * from the dashboard, hiding a row that needs operator attention.
 */
function webhookUrlForList(
  subscriberId: number,
  source: string,
  webhookUrl: string | null,
): string | null {
  if (!webhookUrl) return null;
  if (source === "vendor") return webhookUrl;
  try {
    return new URL(webhookUrl).origin;
  } catch {
    console.warn("page_subscriber row has a malformed webhook URL", {
      subscriberId,
      source,
    });
    return "<malformed>";
  }
}

export type PageSubscriberListItem = {
  id: number;
  channelType: "email" | "webhook" | "slack";
  email: string | null;
  webhookUrl: string | null;
  channelConfig: string | null;
  source: "self_signup" | "vendor" | "import";
  name: string | null;
  acceptedAt: Date | null;
  unsubscribedAt: Date | null;
  createdAt: Date | null;
  updatedAt?: Date | null;
  components: { id: number; name: string }[];
  isEntirePage: boolean;
  pageId: number;
};

/**
 * List subscribers for a page owned by the caller's workspace, newest
 * first by default. Unsubscribed rows are included unless
 * `includeUnsubscribed: false`.
 */
export async function listPageSubscribers(args: {
  ctx: ServiceContext;
  input: ListPageSubscribersInput;
}): Promise<PageSubscriberListItem[]> {
  const { ctx } = args;
  requireScope(ctx, "subscribers:read");
  const input = ListPageSubscribersInput.parse(args.input);
  const db = getReadDb(ctx);

  const pageRow = await db.query.page.findFirst({
    where: and(
      eq(page.workspaceId, ctx.workspace.id),
      eq(page.id, input.pageId),
    ),
  });
  if (!pageRow) {
    throw new NotFoundError("page", input.pageId);
  }

  const subscriptions = await db.query.pageSubscriber.findMany({
    where:
      input.includeUnsubscribed === false
        ? and(
            eq(pageSubscriber.pageId, pageRow.id),
            isNull(pageSubscriber.unsubscribedAt),
          )
        : eq(pageSubscriber.pageId, pageRow.id),
    with: {
      components: {
        with: { pageComponent: true },
      },
    },
    orderBy: (subs, { desc, asc }) =>
      input.order === "asc" ? asc(subs.createdAt) : desc(subs.createdAt),
    limit: input.limit,
    offset: input.offset,
  });

  return subscriptions.map((sub) => {
    const isVendor = sub.source === "vendor";
    return {
      id: sub.id,
      channelType: sub.channelType,
      email: sub.email,
      webhookUrl: webhookUrlForList(sub.id, sub.source, sub.webhookUrl),
      channelConfig: isVendor ? sub.channelConfig : null,
      source: sub.source,
      name: sub.name,
      acceptedAt: sub.acceptedAt,
      unsubscribedAt: sub.unsubscribedAt,
      createdAt: sub.createdAt,
      updatedAt: sub.updatedAt,
      components: sub.components.map((c) => ({
        id: c.pageComponent.id,
        name: c.pageComponent.name,
      })),
      isEntirePage: sub.components.length === 0,
      pageId: sub.pageId,
    };
  });
}

/** Total for the same filter `listPageSubscribers` applies, for paginated callers. */
export async function countPageSubscribers(args: {
  ctx: ServiceContext;
  input: Pick<ListPageSubscribersInput, "pageId" | "includeUnsubscribed">;
}): Promise<number> {
  const { ctx } = args;
  requireScope(ctx, "subscribers:read");
  const input = ListPageSubscribersInput.parse(args.input);
  const db = getReadDb(ctx);
  const pageRow = await db.query.page.findFirst({
    where: and(
      eq(page.workspaceId, ctx.workspace.id),
      eq(page.id, input.pageId),
    ),
  });
  if (!pageRow) throw new NotFoundError("page", input.pageId);
  return db.$count(
    pageSubscriber,
    input.includeUnsubscribed === false
      ? and(
          eq(pageSubscriber.pageId, pageRow.id),
          isNull(pageSubscriber.unsubscribedAt),
        )
      : eq(pageSubscriber.pageId, pageRow.id),
  );
}
