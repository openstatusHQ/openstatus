import { eq } from "@openstatus/db";
import {
  pageSubscriber,
  selectPageSubscriberSchema,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type DB, type ServiceContext, withTransaction } from "../context";
import { NotFoundError } from "../errors";
import { resolveSubscriberByToken } from "./internal";
import { UnsubscribeSubscriberInput } from "./schemas";

/**
 * Token-addressed unsubscribe, both for self-signup and vendor-added
 * rows (the action is the same — set `unsubscribedAt`). Idempotent: a
 * second call on an already-unsubscribed row returns silently with no
 * audit emit.
 */
export async function unsubscribeSubscriber(args: {
  input: UnsubscribeSubscriberInput;
  db?: DB;
}): Promise<void> {
  const input = UnsubscribeSubscriberInput.parse(args.input);

  const resolved = await resolveSubscriberByToken({
    db: args.db,
    token: input.token,
    domain: input.domain,
  });
  if (!resolved) throw new NotFoundError("page_subscriber");
  const { row, pageData } = resolved;

  // Idempotent — no row, no audit on the second call.
  if (row.unsubscribedAt) return;

  await withTransaction({ db: args.db } as ServiceContext, async (tx) => {
    const before = selectPageSubscriberSchema.parse(row);
    const updated = await tx
      .update(pageSubscriber)
      .set({ unsubscribedAt: new Date(), updatedAt: new Date() })
      .where(eq(pageSubscriber.id, row.id))
      .returning()
      .get();
    const after = selectPageSubscriberSchema.parse(updated ?? row);

    const auditCtx: ServiceContext = {
      workspace: pageData.workspace,
      actor: { type: "subscriber", subscriberId: row.id },
      db: tx,
    };
    const { token: _bt, ...beforeSnap } = before;
    const { token: _at, ...afterSnap } = after;
    await emitAudit(tx, auditCtx, {
      action: "page_subscriber.update",
      entityType: "page_subscriber",
      entityId: row.id,
      before: beforeSnap,
      after: afterSnap,
    });
  });
}
