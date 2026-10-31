import type { Region } from "@openstatus/regions";
import { z } from "zod";

import { requireScope } from "../auth";
import { type ServiceContext, getReadDb } from "../context";
import { InternalServiceError, ValidationError } from "../errors";
import { getMonitorInWorkspace } from "./internal";
import { type CheckResult, parseStoredHeaders, probeRegion } from "./probe";

export const RunMonitorCheckInput = z.object({
  monitorId: z.number().int(),
  region: z.string().optional(),
});
export type RunMonitorCheckInput = z.infer<typeof RunMonitorCheckInput>;

/**
 * One ephemeral probe of an HTTP monitor from a single region (the monitor's
 * first when omitted), capped at 10s. Returns `null` for other job types.
 * Nothing is persisted.
 */
export async function runMonitorCheck(args: {
  ctx: ServiceContext;
  input: RunMonitorCheckInput;
}): Promise<CheckResult | null> {
  const { ctx } = args;
  requireScope(ctx, "monitors:write");
  const input = RunMonitorCheckInput.parse(args.input);

  const monitor = await getMonitorInWorkspace({
    tx: getReadDb(ctx),
    id: input.monitorId,
    workspaceId: ctx.workspace.id,
  });
  if (monitor.jobType !== "http") return null;

  const region = input.region ?? firstRegion(monitor.regions);
  if (!region) {
    throw new ValidationError("Monitor has no region to probe from.");
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    throw new InternalServiceError("CRON_SECRET is not set");
  }

  return probeRegion({
    region: region as Region,
    url: monitor.url,
    method: monitor.method ?? "GET",
    headers: parseStoredHeaders(monitor.headers),
    body: monitor.body ?? undefined,
    cronSecret,
  });
}

/** First code of the stored comma-joined region list, or `undefined`. */
export function firstRegion(stored: string | null | undefined) {
  return stored
    ?.split(",")
    .map((r) => r.trim())
    .find((r) => r.length > 0);
}
