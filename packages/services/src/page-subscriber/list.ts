import { and, eq } from "@openstatus/db";
import { page, pageSubscriber } from "@openstatus/db/src/schema";

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
  channelType: "email" | "webhook";
  email: string | null;
  webhookUrl: string | null;
  channelConfig: string | null;
  source: "self_signup" | "vendor" | "import";
  name: string | null;
  acceptedAt: Date | null;
  unsubscribedAt: Date | null;
  createdAt: Date | null;
  components: { id: number; name: string }[];
  isEntirePage: boolean;
  pageId: number;
};

/**
 * List all subscribers for a page owned by the caller's workspace.
 * Order defaults to `desc` (newest first) — matches the router default.
 */
export async function listPageSubscribers(args: {
  ctx: ServiceContext;
  input: ListPageSubscribersInput;
}): Promise<PageSubscriberListItem[]> {
  const { ctx } = args;
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
    where: eq(pageSubscriber.pageId, pageRow.id),
    with: {
      components: {
        with: { pageComponent: true },
      },
    },
    orderBy: (subs, { desc, asc }) =>
      input.order === "asc" ? asc(subs.createdAt) : desc(subs.createdAt),
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
      components: sub.components.map((c) => ({
        id: c.pageComponent.id,
        name: c.pageComponent.name,
      })),
      isEntirePage: sub.components.length === 0,
      pageId: sub.pageId,
    };
  });
}
