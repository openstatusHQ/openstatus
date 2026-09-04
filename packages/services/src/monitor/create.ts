import { monitor, selectMonitorSchema } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { assertWithinLimit } from "../limits";
import type { Monitor } from "../types";
import {
  headersToDbJson,
  pickDefaultRegions,
  serialiseAssertions,
} from "./internal";
import { CreateMonitorInput } from "./schemas";
import { assertMonitorUrlSafe } from "./url-safety";

export async function createMonitor(args: {
  ctx: ServiceContext;
  input: CreateMonitorInput;
}): Promise<Monitor> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = CreateMonitorInput.parse(args.input);

  assertMonitorUrlSafe({ jobType: input.jobType, url: input.url });

  return withTransaction(ctx, async (tx) => {
    await assertWithinLimit({
      tx,
      workspaceId: ctx.workspace.id,
      limit: "monitors",
    });

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
        description: input.description,
        public: input.public,
        timeout: input.timeout,
        degradedAfter: input.degradedAfter,
        retry: input.retry,
        followRedirects: input.followRedirects,
        grpcService: input.grpcService,
        grpcTls: input.grpcTls,
        otelEndpoint: input.otelEndpoint,
        otelHeaders: headersToDbJson(input.otelHeaders),
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
