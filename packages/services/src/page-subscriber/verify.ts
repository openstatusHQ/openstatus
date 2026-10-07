import { and, eq } from "@openstatus/db";
import {
  pageSubscriber,
  selectPageSubscriberSchema,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type DB, type ServiceContext, withTransaction } from "../context";
import { ValidationError } from "../errors";
import { resolveSubscriberByToken } from "./internal";
import { VerifySelfSignupSubscriberInput } from "./schemas";

export type VerifyResult = {
  id: number;
  pageId: number;
  pageName: string;
  pageSlug: string;
  customDomain: string | null;
  channelType: "email" | "webhook" | "slack";
  email: string | null;
  webhookUrl?: string | null;
  token: string | null;
  acceptedAt: Date | null;
  componentIds: number[];
} | null;

/**
 * Verify a self-signup subscription by its emailed token. Returns `null`
 * when the token doesn't resolve (or the optional `domain` doesn't
 * match) — callers map that to `NOT_FOUND`. Already-accepted rows
 * short-circuit without re-emitting; first-time acceptance flips
 * `acceptedAt` and writes one `page_subscriber.update` audit row with
 * actor `subscriber:{id}`.
 */
// Token-addressed self-service by an anonymous visitor: the audit actor is
// `subscriber`, for which `requireScope` is a documented no-op.
// oxlint-disable-next-line openstatus/services-mutation-guards
export async function verifySelfSignupSubscriber(args: {
  input: VerifySelfSignupSubscriberInput;
  db?: DB;
}): Promise<VerifyResult> {
  const input = VerifySelfSignupSubscriberInput.parse(args.input);

  const resolved = await resolveSubscriberByToken({
    db: args.db,
    token: input.token,
    domain: input.domain,
  });
  if (!resolved) return null;
  const { row, pageData, components } = resolved;

  // Already accepted — surface the row without writing.
  if (row.acceptedAt) {
    return {
      id: row.id,
      pageId: row.pageId,
      pageName: pageData.title,
      pageSlug: pageData.slug,
      customDomain: pageData.customDomain,
      channelType: row.channelType,
      email: row.email,
      webhookUrl: row.webhookUrl,
      token: row.token,
      acceptedAt: row.acceptedAt,
      componentIds: components,
    };
  }

  if (row.expiresAt && row.expiresAt < new Date()) {
    throw new ValidationError("Verification token expired");
  }

  return withTransaction({ db: args.db } as ServiceContext, async (tx) => {
    const before = selectPageSubscriberSchema.parse(row);
    const updated = await tx
      .update(pageSubscriber)
      .set({ acceptedAt: new Date(), updatedAt: new Date() })
      // Signup may rotate the token after the lookup above.
      .where(
        and(
          eq(pageSubscriber.id, row.id),
          eq(pageSubscriber.token, input.token),
        ),
      )
      .returning()
      .get();
    if (!updated) return null;
    const after = selectPageSubscriberSchema.parse(updated);

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

    return {
      id: row.id,
      pageId: row.pageId,
      pageName: pageData.title,
      pageSlug: pageData.slug,
      customDomain: pageData.customDomain,
      channelType: updated.channelType,
      email: updated.email,
      webhookUrl: updated.webhookUrl,
      token: updated.token,
      acceptedAt: updated.acceptedAt,
      componentIds: components,
    };
  });
}
