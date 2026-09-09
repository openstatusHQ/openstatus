import { asc, db as defaultDb, eq } from "@openstatus/db";
import { alertSource } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import type { AlertSource } from "../types";
import { getAlertSourceInWorkspace } from "./internal";
import {
  SetAlertSourceActiveInput,
  UpdateAlertSourceConfigInput,
} from "./schemas";

export async function listAlertSources(args: {
  ctx: ServiceContext;
}): Promise<AlertSource[]> {
  const tx = args.ctx.db ?? defaultDb;
  return tx
    .select()
    .from(alertSource)
    .where(eq(alertSource.workspaceId, args.ctx.workspace.id))
    .orderBy(asc(alertSource.id))
    .all();
}

export async function updateAlertSourceConfig(args: {
  ctx: ServiceContext;
  input: UpdateAlertSourceConfigInput;
}): Promise<AlertSource> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = UpdateAlertSourceConfigInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const before = await getAlertSourceInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });

    const config = { ...before.config };
    if (input.stalenessWindowMinutes !== undefined) {
      config.stalenessWindowMinutes = input.stalenessWindowMinutes;
    }
    if (input.signatureSecret !== undefined) {
      if (input.signatureSecret === null) {
        config.signatureSecret = undefined;
      } else {
        config.signatureSecret = input.signatureSecret;
      }
    }

    const after = await tx
      .update(alertSource)
      .set({ config, updatedAt: new Date() })
      .where(eq(alertSource.id, before.id))
      .returning()
      .get();

    await emitAudit(tx, ctx, {
      action: "alert_source.update",
      entityType: "alert_source",
      entityId: after.id,
      // The signing secret must never reach the audit log.
      before: {
        ...before,
        config: { ...before.config, signatureSecret: undefined },
      },
      after: {
        ...after,
        config: { ...after.config, signatureSecret: undefined },
      },
    });

    return after;
  });
}

export async function setAlertSourceActive(args: {
  ctx: ServiceContext;
  input: SetAlertSourceActiveInput;
}): Promise<AlertSource> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = SetAlertSourceActiveInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const before = await getAlertSourceInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });

    const after = await tx
      .update(alertSource)
      .set({ active: input.active, updatedAt: new Date() })
      .where(eq(alertSource.id, before.id))
      .returning()
      .get();

    await emitAudit(tx, ctx, {
      action: "alert_source.update",
      entityType: "alert_source",
      entityId: after.id,
      before: {
        ...before,
        config: { ...before.config, signatureSecret: undefined },
      },
      after: {
        ...after,
        config: { ...after.config, signatureSecret: undefined },
      },
    });

    return after;
  });
}
