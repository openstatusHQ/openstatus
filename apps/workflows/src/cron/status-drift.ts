import { getLogger } from "@logtape/logtape";
import { db, sql } from "@openstatus/db";
import type { MonitorStatus } from "@openstatus/db/src/schema";
import { monitor, monitorStatusTable } from "@openstatus/db/src/schema";
import { withBusyRetry } from "@openstatus/services";
import * as Sentry from "@sentry/deno";

import { triggerNotifications } from "../checker/alerting";
import { enqueueOutbox } from "../checker/outbox";
import {
  csvRegionCountSql,
  csvRegionMemberSql,
  quorumMetSql,
} from "../checker/quorum";
import { EVENT_TYPE, evaluateTransition } from "../checker/transition";
import { env } from "../env";

const logger = getLogger(["workflow"]);

const CANDIDATE_LIMIT = 200;

type DriftRow = { monitor_id: number; status: MonitorStatus };

/**
 * Finds monitors whose regions already carry a quorum for a status the monitor
 * itself does not have, using the same quorum rule as a live check.
 */
async function findDrift(): Promise<DriftRow[]> {
  return withBusyRetry(() =>
    db.all<DriftRow>(sql`
      SELECT ${monitorStatusTable.monitorId} AS monitor_id,
             ${monitorStatusTable.status} AS status
      FROM ${monitorStatusTable}
      JOIN ${monitor} ON ${monitor.id} = ${monitorStatusTable.monitorId}
      WHERE ${monitor.deletedAt} IS NULL
        AND ${monitor.active} = 1
        AND ${monitor.regions} <> ''
        AND ${monitorStatusTable.status} <> ${monitor.status}
        AND ${csvRegionMemberSql(sql`${monitorStatusTable.region}`)}
      GROUP BY ${monitorStatusTable.monitorId}, ${monitorStatusTable.status}
      HAVING ${quorumMetSql(sql`count(*)`, csvRegionCountSql())}
      LIMIT ${CANDIDATE_LIMIT}
    `),
  );
}

/**
 * Safety net for the gap between the region write and the transition batch:
 * they are separate transactions, so a crash or a failed batch can leave a
 * monitor whose regions say "down" but whose status still says "up", which no
 * later check will re-evaluate because the region status stopped changing.
 */
export async function handleStatusDriftCron() {
  const candidates = await findDrift();
  if (candidates.length === 0) return { candidates: 0, repaired: 0 };

  let repaired = 0;

  for (const candidate of candidates) {
    const result = await evaluateTransition({
      monitorId: candidate.monitor_id,
      region: "drift-repair",
      status: candidate.status,
      cronTimestamp: Date.now(),
      deadlineSeconds: Math.floor(env().OUTBOX_DEADLINE_MS / 1000),
      rolloutPct: env().OUTBOX_ROLLOUT_PCT,
    });

    if (result.kind !== "evaluated" || !result.transitioned) continue;

    repaired += 1;
    logger.warn("Repaired monitor status drift", {
      monitor_id: candidate.monitor_id,
      status: candidate.status,
      outbox_rows: result.outboxRows.length,
    });

    // A repair that does not deliver is the failure it exists to fix.
    if (result.outboxRows.some((row) => row.status === "pending")) {
      enqueueOutbox(result.outboxRows.map((row) => row.id));
    } else if (result.outboxRows.length > 0) {
      await triggerNotifications({
        monitorId: String(candidate.monitor_id),
        notifType: EVENT_TYPE[candidate.status],
        cronTimestamp: Date.now(),
        regions: result.affectedRegions,
        incidentId: result.incidentId ?? undefined,
      });
    }
  }

  if (repaired > 0) {
    Sentry.captureMessage(
      `Repaired ${repaired} monitor(s) whose status had drifted from their region quorum`,
      "warning",
    );
  }

  return { candidates: candidates.length, repaired };
}
