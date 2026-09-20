import { and, eq, isNull } from "@openstatus/db";
import {
  pageSubscriber,
  selectPageSubscriberSchema,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type DB, type ServiceContext, withTransaction } from "../context";
import { parseWorkspaceForContext } from "./internal";

// Anonymous self-signup compensation uses the subscriber as its audit actor.
// oxlint-disable-next-line openstatus/services-mutation-guards
export async function expireSelfSignupVerification(args: {
  subscriberId: number;
  token: string;
  db?: DB;
}) {
  await withTransaction({ db: args.db } as ServiceContext, async (tx) => {
    const existing = await tx.query.pageSubscriber.findFirst({
      where: and(
        eq(pageSubscriber.id, args.subscriberId),
        eq(pageSubscriber.token, args.token),
        isNull(pageSubscriber.acceptedAt),
        isNull(pageSubscriber.unsubscribedAt),
      ),
      with: { page: { with: { workspace: true } } },
    });
    if (!existing) return;

    const beforeRow = selectPageSubscriberSchema.parse(existing);
    const updatedRow = await tx
      .update(pageSubscriber)
      .set({ expiresAt: new Date(0), updatedAt: new Date() })
      .where(
        and(
          eq(pageSubscriber.id, args.subscriberId),
          eq(pageSubscriber.token, args.token),
          isNull(pageSubscriber.acceptedAt),
          isNull(pageSubscriber.unsubscribedAt),
        ),
      )
      .returning()
      .get();
    if (!updatedRow) return;

    const workspace = parseWorkspaceForContext(existing.page.workspace);
    const auditCtx: ServiceContext = {
      workspace,
      actor: { type: "subscriber", subscriberId: existing.id },
      db: tx,
    };
    const afterRow = selectPageSubscriberSchema.parse(updatedRow);
    const { token: _beforeToken, ...before } = beforeRow;
    const { token: _afterToken, ...after } = afterRow;
    await emitAudit(tx, auditCtx, {
      action: "page_subscriber.update",
      entityType: "page_subscriber",
      entityId: existing.id,
      before,
      after,
      metadata: { reason: "verification_delivery_failed" },
    });
  });
}
