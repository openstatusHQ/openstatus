import { ALL_REGIONS, type Region, regionDict } from "@openstatus/regions";
import { yieldMany } from "@openstatus/utils";
import { z } from "zod";

import { requireScope } from "../auth";
import { type ServiceContext, getReadDb } from "../context";
import { InternalServiceError } from "../errors";
import { getMonitorInWorkspace } from "./internal";
import { type CheckResult, parseStoredHeaders, probeRegion } from "./probe";

export type {
  CheckResult,
  CheckResultError,
  CheckResultSuccess,
} from "./probe";

export const StreamMonitorPreviewInput = z.object({
  monitorId: z.number(),
});

export type StreamMonitorPreviewInput = z.infer<
  typeof StreamMonitorPreviewInput
>;

/**
 * Streaming async generator — yields per-region preview results as they arrive.
 * Probes ALL 28 regions, regardless of `monitor.regions` (plan-bounded).
 * Does NOT persist to Tinybird. Ephemeral, onboarding-only.
 */
export async function* streamMonitorPreview(args: {
  ctx: ServiceContext;
  input: StreamMonitorPreviewInput;
}): AsyncGenerator<CheckResult> {
  const { ctx } = args;
  // Probes are side effects, same as triggerMonitorRun.
  requireScope(ctx, "monitors:write");
  const input = StreamMonitorPreviewInput.parse(args.input);

  const tx = getReadDb(ctx);
  const monitor = await getMonitorInWorkspace({
    tx,
    id: input.monitorId,
    workspaceId: ctx.workspace.id,
  });

  const headers = parseStoredHeaders(monitor.headers);

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    throw new InternalServiceError("CRON_SECRET is not set");
  }

  // Skip deprecated regions — fly (and other providers) no longer run
  // machines there, so probes time out and produce noise rows. Mirrors
  // the existing `pickDefaultRegions` filter in `internal.ts`.
  const activeRegions = ALL_REGIONS.filter(
    (region) => !regionDict[region].deprecated,
  );

  const promises: Promise<CheckResult>[] = activeRegions.map((region) =>
    probeRegion({
      region: region as Region,
      url: monitor.url,
      method: monitor.method ?? "GET",
      headers,
      body: monitor.body ?? undefined,
      cronSecret,
    }),
  );

  yield* yieldMany(promises);
}
