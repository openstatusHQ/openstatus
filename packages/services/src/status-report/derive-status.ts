import { asc, eq } from "@openstatus/db";
import { statusReport, statusReportUpdate } from "@openstatus/db/src/schema";

import type { DB } from "../context";
import type { StatusReport } from "../types";
import type { StatusReportStatus } from "./schemas";

type DerivableUpdate = {
  id: number;
  status: StatusReportStatus;
  date: Date;
};

/**
 * Latest update wins; `id` breaks date ties — must match
 * `getCurrentImpactsForReport` or status and impacts can come from
 * different updates. Null when there are no updates.
 */
export function deriveReportStatus(
  updates: ReadonlyArray<DerivableUpdate>,
): StatusReportStatus | null {
  let latest: DerivableUpdate | null = null;
  for (const update of updates) {
    if (
      latest === null ||
      update.date.getTime() > latest.date.getTime() ||
      (update.date.getTime() === latest.date.getTime() && update.id > latest.id)
    ) {
      latest = update;
    }
  }
  return latest?.status ?? null;
}

/**
 * Persist `status_report.status` from the report's updates. Every mutation
 * touching the update set must end with this — the column is a cache, never
 * an independently settable field. Null when no updates remain.
 */
export async function recomputeReportStatus(
  tx: DB,
  statusReportId: number,
): Promise<StatusReport | null> {
  const rows = await tx
    .select({
      id: statusReportUpdate.id,
      status: statusReportUpdate.status,
      date: statusReportUpdate.date,
    })
    .from(statusReportUpdate)
    .where(eq(statusReportUpdate.statusReportId, statusReportId))
    .orderBy(asc(statusReportUpdate.date), asc(statusReportUpdate.id))
    .all();

  const derived = deriveReportStatus(rows);
  if (derived === null) return null;

  const current = await tx
    .select()
    .from(statusReport)
    .where(eq(statusReport.id, statusReportId))
    .get();
  if (!current) return null;

  // no-op edits (message, impacts) must not bump updatedAt — the RSS/Atom
  // feed dates and sorts items by it
  if (current.status === derived) return current;

  return tx
    .update(statusReport)
    .set({ status: derived, updatedAt: new Date() })
    .where(eq(statusReport.id, statusReportId))
    .returning()
    .get();
}
