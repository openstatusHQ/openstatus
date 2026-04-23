import { monitor, selectMonitorSchema } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import { LimitExceededError } from "../errors";
import type { Monitor } from "../types";
import {
  countMonitorsInWorkspace,
  headersToDbJson,
  pickDefaultRegions,
  serialiseAssertions,
} from "./internal";
import { CreateMonitorInput } from "./schemas";

export async function createMonitor(args: {
  ctx: ServiceContext;
  input: CreateMonitorInput;
}): Promise<Monitor> {
  const { ctx } = args;
  const input = CreateMonitorInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const existing = await countMonitorsInWorkspace(tx, ctx.workspace.id);
    if (existing >= ctx.workspace.limits.monitors) {
      throw new LimitExceededError("monitors", ctx.workspace.limits.monitors);
    }

    const defaults = pickDefaultRegions(ctx.workspace);
    const regions = input.regions ?? defaults.regions;
    const periodicity = input.periodicity ?? defaults.periodicity;

    const row = await tx
      .insert(monitor)
      .values({
        name: input.name,
        jobType: input.jobType,
        url: input.url,
        method: input.method,
        headers: headersToDbJson(input.headers),
        body: input.body,
        active: input.active,
        workspaceId: ctx.workspace.id,
        periodicity,
        regions: regions.join(","),
        assertions: serialiseAssertions(input.assertions),
        updatedAt: new Date(),
      })
      .returning()
      .get();

    await emitAudit(tx, ctx, {
      action: "monitor.create",
      entityType: "monitor",
      entityId: row.id,
      after: row,
      metadata: { jobType: row.jobType, url: row.url },
    });

    return selectMonitorSchema.parse(row);
  });
}
