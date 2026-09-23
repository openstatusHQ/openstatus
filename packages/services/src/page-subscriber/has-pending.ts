import { and, eq, isNull } from "@openstatus/db";
import { page, pageSubscriber } from "@openstatus/db/src/schema";

import { type DB, type ServiceContext, getReadDb } from "../context";
import { NotFoundError } from "../errors";
import { type PageVisitor, assertPageAccess } from "../page-access";
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
  const db = getReadDb({ db: args.db } as ServiceContext);

  // Gate first: pending state on a protected page is not public.
  if (args.visitor) {
    const pageData = await db.query.page.findFirst({
      where: eq(page.id, input.pageId),
    });
    if (!pageData) throw new NotFoundError("page", input.pageId);
    assertPageAccess(pageData, args.visitor);
  }

  const existing = await db.query.pageSubscriber.findFirst({
    where: and(
      eq(pageSubscriber.email, input.email.toLowerCase()),
      eq(pageSubscriber.pageId, input.pageId),
      eq(pageSubscriber.channelType, "email"),
      isNull(pageSubscriber.unsubscribedAt),
      isNull(pageSubscriber.acceptedAt),
    ),
  });
  return !!(existing?.expiresAt && existing.expiresAt > new Date());
}
