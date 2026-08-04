import {
  type SQL,
  and,
  asc,
  db as defaultDb,
  desc,
  eq,
  getTableColumns,
  inArray,
  isNull,
  or,
  sql,
} from "@openstatus/db";
import {
  incidentTable,
  monitor,
  monitorTag,
  monitorTagsToMonitors,
  notification,
  notificationsToMonitors,
  privateLocation,
  privateLocationToMonitors,
  selectIncidentSchema,
  selectMonitorSchema,
  selectMonitorTagSchema,
  selectNotificationSchema,
  selectPrivateLocationSchema,
} from "@openstatus/db/src/schema";

import type { DB, ServiceContext } from "../context";
import type {
  Incident,
  Monitor,
  MonitorTag,
  Notification,
  PrivateLocation,
} from "../types";
import { getMonitorInWorkspace } from "./internal";
import { GetMonitorInput, ListMonitorsInput } from "./schemas";

export type MonitorListItem = Monitor & {
  tags: MonitorTag[];
  incidents: Incident[];
};

export type MonitorWithRelations = Monitor & {
  tags: MonitorTag[];
  incidents: Incident[];
  notifications: Notification[];
  privateLocations: PrivateLocation[];
};

export type ListMonitorsResult = {
  items: MonitorListItem[];
  totalSize: number;
};

/**
 * Every open incident for these monitors, plus each monitor's most recent one.
 * Consumers read only the open count and the latest incident's date, so
 * selecting the full history made `monitor.list` — prefetched by the sidebar on
 * every dashboard route — scale with the workspace's lifetime incident count.
 */
function recentIncidents(db: DB, monitorIds: number[], workspaceId: number) {
  const ranked = db
    .select({
      ...getTableColumns(incidentTable),
      // Alias avoids `rank` / `row_number`, which name SQLite window functions.
      recencyRank:
        sql<number>`row_number() over (partition by ${incidentTable.monitorId} order by ${incidentTable.startedAt} desc)`.as(
          "recency_rank",
        ),
    })
    .from(incidentTable)
    .where(
      and(
        inArray(incidentTable.monitorId, monitorIds),
        // Scope to caller's workspace — defence-in-depth in case an
        // incident.monitorId somehow points cross-workspace. The
        // `incident.monitorId` FK doesn't enforce workspace ownership.
        eq(incidentTable.workspaceId, workspaceId),
      ),
    )
    .as("ranked");

  // Newest first so consumers reading `incidents[0]` get the latest incident;
  // the unordered select this replaced left that row arbitrary.
  return db
    .select()
    .from(ranked)
    .where(or(eq(ranked.recencyRank, 1), isNull(ranked.resolvedAt)))
    .orderBy(desc(ranked.startedAt));
}

/**
 * Batched enrichment for a list of monitors — loads tags + incidents in
 * two IN queries (three if notifications / privateLocations are also
 * requested). Avoids the per-row pattern that pairs badly with dashboards
 * that don't paginate.
 */
async function enrichMonitorsBatch(
  db: DB,
  rows: Array<typeof monitor.$inferSelect>,
  workspaceId: number,
  include: { notifications?: boolean; privateLocations?: boolean } = {},
): Promise<MonitorWithRelations[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  // Explicit column selection (not `select()`) keeps the join row shape in
  // our hands instead of relying on drizzle's auto-derived `row.<table_name>`
  // keys, which are named after the JS variable and silently break on
  // schema rename.
  const [tagRows, incidentRows, notifRows, locRows] = await Promise.all([
    db
      .select({
        monitorId: monitorTagsToMonitors.monitorId,
        tag: monitorTag,
      })
      .from(monitorTag)
      .innerJoin(
        monitorTagsToMonitors,
        eq(monitorTagsToMonitors.monitorTagId, monitorTag.id),
      )
      .where(
        and(
          inArray(monitorTagsToMonitors.monitorId, ids),
          eq(monitorTag.workspaceId, workspaceId),
        ),
      )
      .all(),
    recentIncidents(db, ids, workspaceId).all(),
    include.notifications
      ? db
          .select({
            monitorId: notificationsToMonitors.monitorId,
            notification,
          })
          .from(notification)
          .innerJoin(
            notificationsToMonitors,
            eq(notificationsToMonitors.notificationId, notification.id),
          )
          .where(
            and(
              inArray(notificationsToMonitors.monitorId, ids),
              eq(notification.workspaceId, workspaceId),
            ),
          )
          .all()
      : Promise.resolve([]),
    include.privateLocations
      ? db
          .select({
            monitorId: privateLocationToMonitors.monitorId,
            location: privateLocation,
          })
          .from(privateLocation)
          .innerJoin(
            privateLocationToMonitors,
            eq(privateLocationToMonitors.privateLocationId, privateLocation.id),
          )
          .where(
            and(
              inArray(privateLocationToMonitors.monitorId, ids),
              eq(privateLocation.workspaceId, workspaceId),
            ),
          )
          .all()
      : Promise.resolve([]),
  ]);

  const tagsByMonitor = new Map<number, MonitorTag[]>();
  for (const row of tagRows) {
    const tag = selectMonitorTagSchema.parse(row.tag);
    const arr = tagsByMonitor.get(row.monitorId);
    if (arr) arr.push(tag);
    else tagsByMonitor.set(row.monitorId, [tag]);
  }

  const incidentsByMonitor = new Map<number, Incident[]>();
  for (const row of incidentRows) {
    if (row.monitorId == null) continue;
    const incident = selectIncidentSchema.parse(row);
    const arr = incidentsByMonitor.get(row.monitorId);
    if (arr) arr.push(incident);
    else incidentsByMonitor.set(row.monitorId, [incident]);
  }

  const notifsByMonitor = new Map<number, Notification[]>();
  for (const row of notifRows) {
    const parsed = selectNotificationSchema.parse(row.notification);
    const arr = notifsByMonitor.get(row.monitorId);
    if (arr) arr.push(parsed);
    else notifsByMonitor.set(row.monitorId, [parsed]);
  }

  const locsByMonitor = new Map<number, PrivateLocation[]>();
  for (const row of locRows) {
    if (row.monitorId == null) continue;
    const parsed = selectPrivateLocationSchema.parse(row.location);
    const arr = locsByMonitor.get(row.monitorId);
    if (arr) arr.push(parsed);
    else locsByMonitor.set(row.monitorId, [parsed]);
  }

  return rows.map((r) => ({
    ...selectMonitorSchema.parse(r),
    tags: tagsByMonitor.get(r.id) ?? [],
    incidents: incidentsByMonitor.get(r.id) ?? [],
    notifications: notifsByMonitor.get(r.id) ?? [],
    privateLocations: locsByMonitor.get(r.id) ?? [],
  }));
}

export async function listMonitors(args: {
  ctx: ServiceContext;
  input: ListMonitorsInput;
}): Promise<ListMonitorsResult> {
  const { ctx } = args;
  const input = ListMonitorsInput.parse(args.input);
  const db = ctx.db ?? defaultDb;

  const conditions: SQL[] = [
    eq(monitor.workspaceId, ctx.workspace.id),
    isNull(monitor.deletedAt),
  ];
  const whereClause = and(...conditions);

  const rows = await db
    .select()
    .from(monitor)
    .where(whereClause)
    .orderBy(
      input.order === "asc" ? asc(monitor.active) : desc(monitor.active),
      input.order === "asc" ? asc(monitor.createdAt) : desc(monitor.createdAt),
    )
    .limit(input.limit)
    .offset(input.offset)
    .all();

  // A short page is the last page, so the total is already known and the
  // extra `count(*)` is only paid when a full page comes back — or when an
  // empty page leaves it ambiguous whether we ran off the end. The tRPC
  // `list` procedure discards `totalSize` entirely.
  let totalSize = input.offset + rows.length;
  if (rows.length === input.limit || (rows.length === 0 && input.offset > 0)) {
    const countRow = await db
      .select({ count: sql<number>`count(*)` })
      .from(monitor)
      .where(whereClause)
      .get();
    totalSize = countRow?.count ?? totalSize;
  }

  const enriched = await enrichMonitorsBatch(db, rows, ctx.workspace.id);
  // `list` only exposes tags + incidents to match the tRPC `list` shape.
  const items: MonitorListItem[] = enriched.map(
    ({ notifications: _n, privateLocations: _p, ...rest }) => rest,
  );
  return { items, totalSize };
}

export async function getMonitor(args: {
  ctx: ServiceContext;
  input: GetMonitorInput;
}): Promise<MonitorWithRelations> {
  const { ctx } = args;
  const input = GetMonitorInput.parse(args.input);
  const db = ctx.db ?? defaultDb;
  const record = await getMonitorInWorkspace({
    tx: db,
    id: input.id,
    workspaceId: ctx.workspace.id,
  });
  const [enriched] = await enrichMonitorsBatch(db, [record], ctx.workspace.id, {
    notifications: true,
    privateLocations: true,
  });
  // oxlint-disable-next-line typescript/no-non-null-assertion -- always defined for len === 1
  return enriched!;
}
