import { db as defaultDb } from "@openstatus/db";
import { alertInbox } from "@openstatus/db/src/schema";
import type { z } from "zod";

import { requireScope } from "../auth";
import type { ServiceContext } from "../context";
import type { AlertInbox } from "../types";
import { RecordInboxEventInput } from "./schemas";

/**
 * Durable write for one inbound webhook. Deliberately a single statement with
 * no `withTransaction`, and deliberately no `emitAudit`: this is the highest
 * volume write in the system and `alert_inbox` is itself the record of it. The
 * meaningful config event — creating the source — is audited instead.
 */
export async function recordInboxEvent(args: {
  ctx: ServiceContext;
  input: z.input<typeof RecordInboxEventInput>;
}): Promise<AlertInbox | null> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = RecordInboxEventInput.parse(args.input);

  const tx = ctx.db ?? defaultDb;
  const now = Math.floor(Date.now() / 1000);
  const settled = input.settleAs !== null;

  const row = await tx
    .insert(alertInbox)
    .values({
      alertSourceId: input.alertSourceId,
      dedupKey: input.dedupKey,
      rawBody: input.rawBody,
      contentType: input.contentType,
      externalId: input.externalId,
      fingerprint: input.fingerprint,
      processingStatus: settled ? "settled" : "pending",
      outcome: input.settleAs,
      lastError: input.settleReason,
      nextAttemptAt: now,
      deadlineAt: now + input.deadlineSeconds,
      processedAt: settled ? now : null,
      receivedAt: now,
    })
    .onConflictDoNothing()
    .returning()
    .get();

  return row ?? null;
}
