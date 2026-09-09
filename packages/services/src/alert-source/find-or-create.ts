import { and, count, eq, lte } from "@openstatus/db";
import {
  alertSource,
  DEFAULT_STALENESS_WINDOW_MINUTES,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { getWorkspaceLimit } from "../limits";
import type { AlertSource } from "../types";
import { FindOrCreateAlertSourceInput } from "./schemas";

export type FindOrCreateAlertSourceResult = {
  source: AlertSource;
  created: boolean;
  overLimit: boolean;
};

/**
 * A webhook never fails because a source does not exist yet, so this creates on
 * first delivery — and creates it even past the plan limit, so the payload has
 * something to attach to and raising the limit later processes what was kept.
 * `overLimit` is derived from creation order, so it flips on upgrade with no
 * data migration.
 */
export async function findOrCreateAlertSource(args: {
  ctx: ServiceContext;
  input: FindOrCreateAlertSourceInput;
}): Promise<FindOrCreateAlertSourceResult> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = FindOrCreateAlertSourceInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const existing = await tx
      .select()
      .from(alertSource)
      .where(
        and(
          eq(alertSource.workspaceId, ctx.workspace.id),
          eq(alertSource.provider, input.provider),
        ),
      )
      .get();

    if (existing) {
      return {
        source: existing,
        created: false,
        overLimit: await isOverLimit(tx, ctx, existing),
      };
    }

    const record = await tx
      .insert(alertSource)
      .values({
        workspaceId: ctx.workspace.id,
        provider: input.provider,
        config: { stalenessWindowMinutes: DEFAULT_STALENESS_WINDOW_MINUTES },
      })
      .returning()
      .get();

    await emitAudit(tx, ctx, {
      action: "alert_source.create",
      entityType: "alert_source",
      entityId: record.id,
      after: record,
    });

    return {
      source: record,
      created: true,
      overLimit: await isOverLimit(tx, ctx, record),
    };
  });
}

async function isOverLimit(
  tx: Parameters<Parameters<typeof withTransaction>[1]>[0],
  ctx: ServiceContext,
  source: AlertSource,
): Promise<boolean> {
  const max = await getWorkspaceLimit(tx, ctx.workspace.id, "alert-sources");
  const row = await tx
    .select({ rank: count() })
    .from(alertSource)
    .where(
      and(
        eq(alertSource.workspaceId, ctx.workspace.id),
        lte(alertSource.id, source.id),
      ),
    )
    .get();
  return (row?.rank ?? 1) > max;
}
