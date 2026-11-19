import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import type { MonitorIncident } from "../types";
import { resolveOpenMonitorIncidents } from "./internal";
import { AutoResolveMonitorIncidentsInput } from "./schemas";

/** Close a monitor's open incidents because it recovered, not because someone resolved them. */
// oxlint-disable-next-line openstatus/services-mutation-guards -- resolveOpenMonitorIncidents emits one audit row per incident
export async function autoResolveMonitorIncidents(args: {
  ctx: ServiceContext;
  input: AutoResolveMonitorIncidentsInput;
}): Promise<MonitorIncident[]> {
  const { ctx } = args;
  requireScope(ctx, "monitors:write");
  const input = AutoResolveMonitorIncidentsInput.parse(args.input);

  return withTransaction(ctx, (tx) =>
    resolveOpenMonitorIncidents({
      tx,
      ctx,
      monitorIds: [input.monitorId],
      now: input.resolvedAt,
    }),
  );
}
