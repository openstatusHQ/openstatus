import { eq } from "@openstatus/db";
import { pageSubscriber } from "@openstatus/db/src/schema";

import { requireScope } from "../auth";
import { type ServiceContext, getReadDb } from "../context";
import { InternalServiceError } from "../errors";
import { loadPageForWorkspace } from "./internal";
import { UpsertSelfSignupSubscriberInput } from "./schemas";
import {
  type UpsertSelfSignupResult,
  upsertSelfSignupSubscriber,
} from "./upsert";

/**
 * Email subscription requested by a workspace credential (API key) rather
 * than the visitor: the page must be in the caller's workspace. The row
 * still goes through double opt-in like a self-signup.
 */
export async function subscribeEmailInWorkspace(args: {
  ctx: ServiceContext;
  input: UpsertSelfSignupSubscriberInput;
}): Promise<{
  subscriber: UpsertSelfSignupResult;
  row: typeof pageSubscriber.$inferSelect;
}> {
  const { ctx } = args;
  requireScope(ctx, "subscribers:write");
  const input = UpsertSelfSignupSubscriberInput.parse(args.input);
  const db = getReadDb(ctx);

  await loadPageForWorkspace({
    tx: db,
    pageId: input.pageId,
    workspaceId: ctx.workspace.id,
  });

  const subscriber = await upsertSelfSignupSubscriber({
    input,
    visitor: null,
    db: ctx.db,
  });

  const row = await db
    .select()
    .from(pageSubscriber)
    .where(eq(pageSubscriber.id, subscriber.id))
    .get();
  if (!row) throw new InternalServiceError("Subscriber was not saved");

  return { subscriber, row };
}
