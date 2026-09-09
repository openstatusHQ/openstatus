import { getLogger } from "@logtape/logtape";
import { db, eq, inArray, isNotNull, sql } from "@openstatus/db";
import {
  alertSource,
  selectWorkspaceSchema,
  workspace,
} from "@openstatus/db/src/schema";
import { sweepStaleIncidents } from "@openstatus/services/incident";

const logger = getLogger(["ingest"]);

export type SweepSummary = { workspaces: number; resolved: number };

/**
 * Per-workspace because `sweepStaleIncidents` is workspace-scoped like every
 * other service verb; only workspaces that actually own an alert source are
 * visited, so this stays proportional to ingest usage, not tenant count.
 */
export async function sweepOnce(
  now = new Date(),
  /** Narrows the sweep. Tests use it so parallel files cannot resolve each
   * other's incidents; the cron passes nothing and sweeps everything. */
  workspaceIds?: number[],
): Promise<SweepSummary> {
  const owners = await db
    .selectDistinct({ id: alertSource.workspaceId })
    .from(alertSource)
    .where(eq(alertSource.active, true))
    .all();

  const scoped =
    workspaceIds === undefined
      ? owners.map((w) => w.id)
      : owners.map((w) => w.id).filter((id) => workspaceIds.includes(id));

  if (scoped.length === 0) return { workspaces: 0, resolved: 0 };

  const rows = await db
    .select()
    .from(workspace)
    .where(inArray(workspace.id, scoped))
    .all();

  let resolved = 0;
  for (const row of rows) {
    const parsed = selectWorkspaceSchema.safeParse(row);
    if (!parsed.success) continue;
    const result = await sweepStaleIncidents({
      ctx: {
        workspace: parsed.data,
        actor: { type: "system", job: "ingest-staleness-sweep" },
      },
      input: { now },
    });
    resolved += result.resolvedIds.length;
  }

  if (resolved > 0) {
    logger.info("stale incidents auto-resolved", {
      workspaces: rows.length,
      resolved,
    });
  }
  return { workspaces: rows.length, resolved };
}
