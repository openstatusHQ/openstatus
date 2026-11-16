import { db as defaultDb, inArray } from "@openstatus/db";
import { monitor, uptimeTargetToMonitor } from "@openstatus/db/src/schema";

import type { DB } from "../../../context";
import type { UptimeEpisodesPipes } from "../../fetch-episodes";
import { sealUptimeTargetMonths } from "../../seal";
import { sealMonitorUptime } from "../../seal-uptime";

const DAY = 86_400_000;

/**
 * Stores the monitors' checks as the daily job would have by `now`: one run
 * 20 days earlier and one at `now`, so the store reaches back 60 days.
 */
export async function storeUptime(args: {
  db?: DB;
  now: Date;
  monitorIds: number[];
  episodesPipes: UptimeEpisodesPipes;
  sleep?: (ms: number) => Promise<void>;
}) {
  const db = args.db ?? defaultDb;
  if (args.monitorIds.length === 0) return;
  // fixtures are created today, after the months the tests judge
  await db
    .update(monitor)
    .set({ createdAt: new Date(0) })
    .where(inArray(monitor.id, args.monitorIds));
  await sealMonitorUptime({
    ...args,
    now: new Date(args.now.getTime() - 20 * DAY),
  });
  return sealMonitorUptime(args);
}

/** The uptime target seal after the uptime store caught up, as the cron runs them. */
export async function sealFromChecks(args: {
  db?: DB;
  now: Date;
  policyIds: number[];
  episodesPipes: UptimeEpisodesPipes;
  sleep?: (ms: number) => Promise<void>;
}) {
  const db = args.db ?? defaultDb;
  const members =
    args.policyIds.length === 0
      ? []
      : await db
          .select({ monitorId: uptimeTargetToMonitor.monitorId })
          .from(uptimeTargetToMonitor)
          .where(inArray(uptimeTargetToMonitor.uptimeTargetId, args.policyIds))
          .all();
  await storeUptime({
    db,
    now: args.now,
    monitorIds: [...new Set(members.map((m) => m.monitorId))],
    episodesPipes: args.episodesPipes,
    sleep: args.sleep,
  });
  return sealUptimeTargetMonths({
    db,
    now: args.now,
    policyIds: args.policyIds,
  });
}
