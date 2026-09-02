import { and, count, db, eq, gte, inArray, isNull, sql } from "@openstatus/db";
import {
  incidentTable,
  monitor,
  notification,
  notificationTrigger,
  notificationsToMonitors,
  selectWorkspaceSchema,
  workspace,
} from "@openstatus/db/src/schema";

const CHECKS_PER_REGION_PER_DAY: Record<string, number> = {
  "30s": 2880,
  "1m": 1440,
  "5m": 288,
  "10m": 144,
  "30m": 48,
  "1h": 24,
  other: 0,
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function duplicateOpenIncidents() {
  const rows = await db
    .select({
      monitorId: incidentTable.monitorId,
      openCount: count(incidentTable.id),
    })
    .from(incidentTable)
    .where(isNull(incidentTable.resolvedAt))
    .groupBy(incidentTable.monitorId)
    .having(sql`count(${incidentTable.id}) > 1`)
    .all();

  console.log(
    `\n[1] Monitors with more than one open incident: ${rows.length}`,
  );
  for (const row of rows) {
    console.log(`    monitor ${row.monitorId}: ${row.openCount} open`);
  }
  if (rows.length > 0) {
    console.log(
      "    -> migration 0085 will FAIL until these are resolved (unique incident_open_idx)",
    );
  }
}

async function smsQuotaBlastRadius() {
  const smsNotifications = await db
    .select({ id: notification.id, workspaceId: notification.workspaceId })
    .from(notification)
    .where(eq(notification.provider, "sms"))
    .all();

  const byWorkspace = new Map<number, number[]>();
  for (const row of smsNotifications) {
    if (row.workspaceId === null) continue;
    const ids = byWorkspace.get(row.workspaceId) ?? [];
    ids.push(row.id);
    byWorkspace.set(row.workspaceId, ids);
  }

  console.log(`\n[2] Workspaces with SMS notifications: ${byWorkspace.size}`);

  const cutoffMs = Date.now() - THIRTY_DAYS_MS;
  let blocked = 0;

  for (const [workspaceId, notificationIds] of byWorkspace) {
    const rows = await db
      .select()
      .from(workspace)
      .where(eq(workspace.id, workspaceId))
      .all();
    const parsed = selectWorkspaceSchema.safeParse(rows[0]);
    if (!parsed.success) continue;
    const limit = parsed.data.limits["sms-limit"];

    const allTime = await db
      .select({ total: count() })
      .from(notificationTrigger)
      .where(inArray(notificationTrigger.notificationId, notificationIds))
      .all();

    const lastMonth = await db
      .select({ total: count() })
      .from(notificationTrigger)
      .where(
        and(
          inArray(notificationTrigger.notificationId, notificationIds),
          gte(notificationTrigger.cronTimestamp, cutoffMs),
        ),
      )
      .all();

    const allTimeCount = allTime[0]?.total ?? 0;
    const lastMonthCount = lastMonth[0]?.total ?? 0;

    if (allTimeCount > limit && lastMonthCount <= limit) {
      blocked += 1;
      console.log(
        `    workspace ${workspaceId}: limit ${limit}, all-time ${allTimeCount}, real 30d ${lastMonthCount} -> UNBLOCKS on fix`,
      );
    }
  }

  console.log(
    `    -> ${blocked} workspace(s) currently blocked by the ms/s bug and will resume sending SMS`,
  );
}

async function writeVolumeBaseline() {
  const monitors = await db
    .select({
      id: monitor.id,
      regions: monitor.regions,
      periodicity: monitor.periodicity,
    })
    .from(monitor)
    .where(eq(monitor.active, true))
    .all();

  let checksPerDay = 0;
  for (const row of monitors) {
    const regionCount = row.regions.split(",").filter(Boolean).length;
    checksPerDay +=
      regionCount * (CHECKS_PER_REGION_PER_DAY[row.periodicity] ?? 0);
  }

  console.log(`\n[3] Active monitors: ${monitors.length}`);
  console.log(`    Checks per day: ${checksPerDay.toLocaleString()}`);
  console.log(
    `    Current monitor_status writes per day: ${checksPerDay.toLocaleString()} (one per check)`,
  );
  console.log(
    `    After the conditional upsert these become zero-row statements.`,
  );
}

async function averageChannelsPerMonitor() {
  const rows = await db
    .select({
      links: count(notificationsToMonitors.notificationId),
      monitors: sql<number>`count(distinct ${notificationsToMonitors.monitorId})`,
    })
    .from(notificationsToMonitors)
    .all();

  const links = rows[0]?.links ?? 0;
  const monitors = rows[0]?.monitors ?? 0;
  const average = monitors === 0 ? 0 : links / monitors;

  console.log(`\n[4] Notification links: ${links} across ${monitors} monitors`);
  console.log(
    `    C (avg channels per notified monitor): ${average.toFixed(2)}`,
  );
  console.log(
    `    Writes per transition (4C + 4): ${(4 * average + 4).toFixed(1)} rows`,
  );
}

async function main() {
  console.log("checker outbox preflight");
  await duplicateOpenIncidents();
  await smsQuotaBlastRadius();
  await writeVolumeBaseline();
  await averageChannelsPerMonitor();
  console.log("");
}

await main();
