import { type DB, getReadDb, dbOnlyContext } from "../context";
import { NotFoundError } from "../errors";
import { type PageVisitor, requirePageAccess } from "../page-access";
import { HasPendingSubscriberInput } from "./schemas";

/**
 * Anti-spam check used by the public subscribe flow: returns `true`
 * when an unverified, unexpired self-signup row already exists for
 * (email, page). Lets the router reject duplicate verification-email
 * sends without round-tripping through `upsertSelfSignupSubscriber`.
 */
export async function hasPendingSubscriber(args: {
  input: HasPendingSubscriberInput;
  /** `null` only when the caller already ran the page gate. */
  visitor: PageVisitor | null;
  db?: DB;
}): Promise<boolean> {
  const input = HasPendingSubscriberInput.parse(args.input);
  const db = getReadDb(dbOnlyContext(args.db));

  // Gate first: pending state on a protected page is not public.
  if (args.visitor) {
    const pageData = await db.query.page.findFirst({
      where: { id: input.pageId },
    });
    if (!pageData) throw new NotFoundError("page", input.pageId);
    await requirePageAccess(pageData, args.visitor);
  }

  const existing = await db.query.pageSubscriber.findFirst({
    where: {
      email: input.email.toLowerCase(),
      pageId: input.pageId,
      channelType: "email",
      unsubscribedAt: { isNull: true },
      acceptedAt: { isNull: true },
    },
  });
  return !!(existing?.expiresAt && existing.expiresAt > new Date());
}
