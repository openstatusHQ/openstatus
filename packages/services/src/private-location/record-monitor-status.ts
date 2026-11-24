import { and, db as defaultDb, eq, sql } from "@openstatus/db";
import { privateLocationMonitorStatus } from "@openstatus/db/src/schema";

import { type DB, isTx } from "../context";
import { withBusyRetry } from "../retry";
import { RecordPrivateLocationMonitorStatusInput } from "./schemas";

/**
 * Store the status a private location reported for a monitor. `changed` is
 * true when this report is newer than the stored one and flips its status.
 *
 * No `ServiceContext` and no audit row: this is check telemetry on the ingest
 * path, one write per check, not workspace configuration.
 */
// oxlint-disable-next-line openstatus/services-mutation-guards -- a check result reported by a private location, not audited
export async function recordPrivateLocationMonitorStatus(args: {
  input: RecordPrivateLocationMonitorStatusInput;
  db?: DB;
}): Promise<{ changed: boolean }> {
  const input = RecordPrivateLocationMonitorStatusInput.parse(args.input);
  const db = args.db ?? defaultDb;
  const { monitorId, privateLocationId, status, cronTimestamp } = input;

  // One atomic batch, so a concurrent report cannot land between the read and
  // the write and make both callers see the same prior status.
  const [prior, upserted] = await withBusyRetry(async () => {
    const readPrior = db
      .select({ status: privateLocationMonitorStatus.status })
      .from(privateLocationMonitorStatus)
      .where(
        and(
          eq(privateLocationMonitorStatus.monitorId, monitorId),
          eq(privateLocationMonitorStatus.privateLocationId, privateLocationId),
        ),
      );
    const upsert = db
      .insert(privateLocationMonitorStatus)
      .values({ monitorId, privateLocationId, status, cronTimestamp })
      .onConflictDoUpdate({
        target: [
          privateLocationMonitorStatus.monitorId,
          privateLocationMonitorStatus.privateLocationId,
        ],
        set: { status, cronTimestamp, updatedAt: new Date() },
        // An out-of-order report must not overwrite a newer one.
        setWhere: sql`excluded.cron_timestamp > ${privateLocationMonitorStatus.cronTimestamp}`,
      })
      .returning();
    return isTx(db)
      ? ([await readPrior, await upsert] as const)
      : db.batch([readPrior, upsert]);
  });

  return {
    changed: upserted.length > 0 && status !== (prior[0]?.status ?? "active"),
  };
}
