import { and, eq, isNull } from "@openstatus/db";
import { pageSubscriber } from "@openstatus/db/src/schema";

import { type DB, type ServiceContext, getReadDb } from "../context";
import { HasPendingSubscriberInput } from "./schemas";

/**
 * Anti-spam check used by the public subscribe flow: returns `true`
 * when an unverified, unexpired self-signup row already exists for
 * (email, page). Lets the router reject duplicate verification-email
 * sends without round-tripping through `upsertSelfSignupSubscriber`.
 */
export async function hasPendingSubscriber(args: {
  input: HasPendingSubscriberInput;
  db?: DB;
}): Promise<boolean> {
  const input = HasPendingSubscriberInput.parse(args.input);
  const db = getReadDb({ db: args.db } as ServiceContext);

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
