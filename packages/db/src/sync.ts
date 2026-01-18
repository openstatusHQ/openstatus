import { and, eq, inArray } from "drizzle-orm";

import type { db } from "./db";
import {
  maintenance,
  maintenancesToMonitors,
  maintenancesToPageComponents,
  monitor,
  monitorsToStatusReport,
  pageComponent,
  pageComponentGroup,
  statusReport,
  statusReportsToPageComponents,
} from "./schema";

// Type that works with both LibSQLDatabase and SQLiteTransaction
// Using any to allow both db instance and transaction to be passed
// biome-ignore lint/suspicious/noExplicitAny: Compatible with both db and transaction
type DB = typeof db;
// Extract transaction type from the callback parameter of db.transaction()
type Transaction = Parameters<Parameters<DB["transaction"]>[0]>[0];

// ============================================================================
// Monitor Group <-> Page Component Group Sync
// ============================================================================

/**
 * Syncs a monitor group insert to page_component_groups
 */
export async function syncMonitorGroupInsert(
  db: DB | Transaction,
  data: {
    id: number;
    workspaceId: number;
    pageId: number;
    name: string;
  },
) {
  await db
    .insert(pageComponentGroup)
    .values({
      id: data.id,
      workspaceId: data.workspaceId,
      pageId: data.pageId,
      name: data.name,
    })
    .onConflictDoNothing();
}

/**
 * Syncs a monitor group delete to page_component_groups
 */
export async function syncMonitorGroupDelete(
  db: DB | Transaction,
  monitorGroupId: number,
) {
  await db
    .delete(pageComponentGroup)
    .where(eq(pageComponentGroup.id, monitorGroupId));
}

/**
 * Syncs multiple monitor group deletes to page_component_groups
 */
export async function syncMonitorGroupDeleteMany(
  db: DB | Transaction,
  monitorGroupIds: number[],
) {
  if (monitorGroupIds.length === 0) return;
  await db
    .delete(pageComponentGroup)
    .where(inArray(pageComponentGroup.id, monitorGroupIds));
}

// ============================================================================
// Monitors to Pages <-> Page Component Sync
// ============================================================================

/**
 * Syncs a monitors_to_pages insert to page_component
 * Requires monitor data to get name and workspace_id
 */
export async function syncMonitorsToPageInsert(
  db: DB | Transaction,
  data: {
    monitorId: number;
    pageId: number;
    order?: number;
    monitorGroupId?: number | null;
    groupOrder?: number;
  },
) {
  // Get monitor data for name and workspace_id
  const monitorData = await db
    .select({
      id: monitor.id,
      name: monitor.name,
      externalName: monitor.externalName,
      workspaceId: monitor.workspaceId,
    })
    .from(monitor)
    .where(eq(monitor.id, data.monitorId))
    .get();

  if (!monitorData || !monitorData.workspaceId) return;

  await db
    .insert(pageComponent)
    .values({
      workspaceId: monitorData.workspaceId,
      pageId: data.pageId,
      type: "monitor",
      monitorId: data.monitorId,
      name: monitorData.externalName || monitorData.name,
      order: data.order ?? 0,
      groupId: data.monitorGroupId ?? null,
      groupOrder: data.groupOrder ?? 0,
    })
    .onConflictDoNothing();
}

/**
 * Syncs multiple monitors_to_pages inserts to page_component
 */
export async function syncMonitorsToPageInsertMany(
  db: DB | Transaction,
  items: Array<{
    monitorId: number;
    pageId: number;
    order?: number;
    monitorGroupId?: number | null;
    groupOrder?: number;
  }>,
) {
  if (items.length === 0) return;

  // Get all monitor data in one query
  const monitorIds = [...new Set(items.map((item) => item.monitorId))];
  const monitors = await db
    .select({
      id: monitor.id,
      name: monitor.name,
      externalName: monitor.externalName,
      workspaceId: monitor.workspaceId,
    })
    .from(monitor)
    .where(inArray(monitor.id, monitorIds));

  const monitorMap = new Map(monitors.map((m) => [m.id, m]));

  const values = items
    .map((item) => {
      const m = monitorMap.get(item.monitorId);
      if (!m || !m.workspaceId) return null;
      return {
        workspaceId: m.workspaceId,
        pageId: item.pageId,
        type: "monitor" as const,
        monitorId: item.monitorId,
        name: m.externalName || m.name,
        order: item.order ?? 0,
        groupId: item.monitorGroupId ?? null,
        groupOrder: item.groupOrder ?? 0,
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  if (values.length === 0) return;

  await db.insert(pageComponent).values(values).onConflictDoNothing();
}

/**
 * Syncs a monitors_to_pages delete to page_component
 */
export async function syncMonitorsToPageDelete(
  db: DB | Transaction,
  data: { monitorId: number; pageId: number },
) {
  await db
    .delete(pageComponent)
    .where(
      and(
        eq(pageComponent.monitorId, data.monitorId),
        eq(pageComponent.pageId, data.pageId),
      ),
    );
}

/**
 * Syncs monitors_to_pages deletes for a specific page to page_component
 */
export async function syncMonitorsToPageDeleteByPage(
  db: DB | Transaction,
  pageId: number,
) {
  await db
    .delete(pageComponent)
    .where(
      and(eq(pageComponent.pageId, pageId), eq(pageComponent.type, "monitor")),
    );
}

/**
 * Syncs monitors_to_pages deletes for specific monitors to page_component
 */
export async function syncMonitorsToPageDeleteByMonitors(
  db: DB | Transaction,
  monitorIds: number[],
) {
  if (monitorIds.length === 0) return;
  await db
    .delete(pageComponent)
    .where(inArray(pageComponent.monitorId, monitorIds));
}

// ============================================================================
// Status Report to Monitors <-> Status Report to Page Components Sync
// ============================================================================

/**
 * Syncs a status_report_to_monitors insert to status_report_to_page_component
 */
export async function syncStatusReportToMonitorInsert(
  db: DB | Transaction,
  data: { statusReportId: number; monitorId: number },
) {
  // Get the status report's page_id
  const report = await db
    .select({ pageId: statusReport.pageId })
    .from(statusReport)
    .where(eq(statusReport.id, data.statusReportId))
    .get();

  // Find matching page_components
  const components = await db
    .select({ id: pageComponent.id })
    .from(pageComponent)
    .where(
      and(
        eq(pageComponent.monitorId, data.monitorId),
        report?.pageId
          ? eq(pageComponent.pageId, report.pageId)
          : // If no page_id on status report, match all page_components with this monitor
            eq(pageComponent.monitorId, data.monitorId),
      ),
    );

  if (components.length === 0) return;

  await db
    .insert(statusReportsToPageComponents)
    .values(
      components.map((c) => ({
        statusReportId: data.statusReportId,
        pageComponentId: c.id,
      })),
    )
    .onConflictDoNothing();
}

/**
 * Syncs multiple status_report_to_monitors inserts to status_report_to_page_component
 */
export async function syncStatusReportToMonitorInsertMany(
  db: DB | Transaction,
  statusReportId: number,
  monitorIds: number[],
) {
  if (monitorIds.length === 0) return;

  // Get the status report's page_id
  const report = await db
    .select({ pageId: statusReport.pageId })
    .from(statusReport)
    .where(eq(statusReport.id, statusReportId))
    .get();

  // Find matching page_components for all monitors
  const components = await db
    .select({ id: pageComponent.id, monitorId: pageComponent.monitorId })
    .from(pageComponent)
    .where(
      and(
        inArray(pageComponent.monitorId, monitorIds),
        report?.pageId
          ? eq(pageComponent.pageId, report.pageId)
          : // If no page_id, we need to be careful - get components that match the monitor
            inArray(pageComponent.monitorId, monitorIds),
      ),
    );

  if (components.length === 0) return;

  await db
    .insert(statusReportsToPageComponents)
    .values(
      components.map((c) => ({
        statusReportId,
        pageComponentId: c.id,
      })),
    )
    .onConflictDoNothing();
}

/**
 * Syncs a status_report_to_monitors delete to status_report_to_page_component
 */
export async function syncStatusReportToMonitorDelete(
  db: DB | Transaction,
  data: { statusReportId: number; monitorId: number },
) {
  // Find page_components with this monitor
  const components = await db
    .select({ id: pageComponent.id })
    .from(pageComponent)
    .where(eq(pageComponent.monitorId, data.monitorId));

  if (components.length === 0) return;

  await db.delete(statusReportsToPageComponents).where(
    and(
      eq(statusReportsToPageComponents.statusReportId, data.statusReportId),
      inArray(
        statusReportsToPageComponents.pageComponentId,
        components.map((c) => c.id),
      ),
    ),
  );
}

/**
 * Syncs status_report_to_monitors deletes for a specific status report
 */
export async function syncStatusReportToMonitorDeleteByStatusReport(
  db: DB | Transaction,
  statusReportId: number,
) {
  await db
    .delete(statusReportsToPageComponents)
    .where(eq(statusReportsToPageComponents.statusReportId, statusReportId));
}

/**
 * Syncs status_report_to_monitors deletes for specific monitors
 */
export async function syncStatusReportToMonitorDeleteByMonitors(
  db: DB | Transaction,
  monitorIds: number[],
) {
  if (monitorIds.length === 0) return;

  // Find page_components with these monitors
  const components = await db
    .select({ id: pageComponent.id })
    .from(pageComponent)
    .where(inArray(pageComponent.monitorId, monitorIds));

  if (components.length === 0) return;

  await db.delete(statusReportsToPageComponents).where(
    inArray(
      statusReportsToPageComponents.pageComponentId,
      components.map((c) => c.id),
    ),
  );
}

/**
 * Syncs status_report_to_page_component inserts to status_report_to_monitors
 * This is the inverse of syncStatusReportToMonitorInsertMany
 */
export async function syncStatusReportToPageComponentInsertMany(
  db: DB | Transaction,
  statusReportId: number,
  pageComponentIds: number[],
) {
  if (pageComponentIds.length === 0) return;

  // Find monitor IDs from the page components
  // Only get components that have a monitorId (not external components)
  const components = await db
    .select({ monitorId: pageComponent.monitorId })
    .from(pageComponent)
    .where(
      and(
        inArray(pageComponent.id, pageComponentIds),
        eq(pageComponent.type, "monitor"),
      ),
    );

  if (components.length === 0) return;

  // Extract unique monitor IDs (filter out nulls)
  const monitorIds = [
    ...new Set(
      components
        .map((c) => c.monitorId)
        .filter((id): id is number => id !== null),
    ),
  ];

  if (monitorIds.length === 0) return;

  // Insert into monitorsToStatusReport
  await db
    .insert(monitorsToStatusReport)
    .values(
      monitorIds.map((monitorId) => ({
        statusReportId,
        monitorId,
      })),
    )
    .onConflictDoNothing();
}

/**
 * Syncs status_report_to_page_component deletes to status_report_to_monitors
 * This is the inverse of syncStatusReportToMonitorDeleteByStatusReport
 * When page components are removed from a status report, remove the corresponding monitors
 */
export async function syncStatusReportToPageComponentDeleteByStatusReport(
  db: DB | Transaction,
  statusReportId: number,
) {
  await db
    .delete(monitorsToStatusReport)
    .where(eq(monitorsToStatusReport.statusReportId, statusReportId));
}

// ============================================================================
// Maintenance to Monitor <-> Maintenance to Page Component Sync
// ============================================================================

/**
 * Syncs a maintenance_to_monitor insert to maintenance_to_page_component
 */
export async function syncMaintenanceToMonitorInsert(
  db: DB | Transaction,
  data: { maintenanceId: number; monitorId: number },
) {
  // Get the maintenance's page_id
  const maint = await db
    .select({ pageId: maintenance.pageId })
    .from(maintenance)
    .where(eq(maintenance.id, data.maintenanceId))
    .get();

  // Find matching page_components
  const components = await db
    .select({ id: pageComponent.id })
    .from(pageComponent)
    .where(
      and(
        eq(pageComponent.monitorId, data.monitorId),
        maint?.pageId
          ? eq(pageComponent.pageId, maint.pageId)
          : eq(pageComponent.monitorId, data.monitorId),
      ),
    );

  if (components.length === 0) return;

  await db
    .insert(maintenancesToPageComponents)
    .values(
      components.map((c) => ({
        maintenanceId: data.maintenanceId,
        pageComponentId: c.id,
      })),
    )
    .onConflictDoNothing();
}

/**
 * Syncs multiple maintenance_to_monitor inserts to maintenance_to_page_component
 */
export async function syncMaintenanceToMonitorInsertMany(
  db: DB | Transaction,
  maintenanceId: number,
  monitorIds: number[],
) {
  if (monitorIds.length === 0) return;

  // Get the maintenance's page_id
  const maint = await db
    .select({ pageId: maintenance.pageId })
    .from(maintenance)
    .where(eq(maintenance.id, maintenanceId))
    .get();

  // Find matching page_components for all monitors
  const components = await db
    .select({ id: pageComponent.id, monitorId: pageComponent.monitorId })
    .from(pageComponent)
    .where(
      and(
        inArray(pageComponent.monitorId, monitorIds),
        maint?.pageId
          ? eq(pageComponent.pageId, maint.pageId)
          : inArray(pageComponent.monitorId, monitorIds),
      ),
    );

  if (components.length === 0) return;

  await db
    .insert(maintenancesToPageComponents)
    .values(
      components.map((c) => ({
        maintenanceId,
        pageComponentId: c.id,
      })),
    )
    .onConflictDoNothing();
}

/**
 * Syncs a maintenance_to_monitor delete to maintenance_to_page_component
 */
export async function syncMaintenanceToMonitorDelete(
  db: DB | Transaction,
  data: { maintenanceId: number; monitorId: number },
) {
  // Find page_components with this monitor
  const components = await db
    .select({ id: pageComponent.id })
    .from(pageComponent)
    .where(eq(pageComponent.monitorId, data.monitorId));

  if (components.length === 0) return;

  await db.delete(maintenancesToPageComponents).where(
    and(
      eq(maintenancesToPageComponents.maintenanceId, data.maintenanceId),
      inArray(
        maintenancesToPageComponents.pageComponentId,
        components.map((c) => c.id),
      ),
    ),
  );
}

/**
 * Syncs maintenance_to_monitor deletes for a specific maintenance
 */
export async function syncMaintenanceToMonitorDeleteByMaintenance(
  db: DB | Transaction,
  maintenanceId: number,
) {
  await db
    .delete(maintenancesToPageComponents)
    .where(eq(maintenancesToPageComponents.maintenanceId, maintenanceId));
}

/**
 * Syncs maintenance_to_monitor deletes for specific monitors
 */
export async function syncMaintenanceToMonitorDeleteByMonitors(
  db: DB | Transaction,
  monitorIds: number[],
) {
  if (monitorIds.length === 0) return;

  // Find page_components with these monitors
  const components = await db
    .select({ id: pageComponent.id })
    .from(pageComponent)
    .where(inArray(pageComponent.monitorId, monitorIds));

  if (components.length === 0) return;

  await db.delete(maintenancesToPageComponents).where(
    inArray(
      maintenancesToPageComponents.pageComponentId,
      components.map((c) => c.id),
    ),
  );
}

/**
 * Syncs maintenance_to_page_component inserts to maintenance_to_monitors
 * This is the inverse of syncMaintenanceToMonitorInsertMany
 */
export async function syncMaintenanceToPageComponentInsertMany(
  db: DB | Transaction,
  maintenanceId: number,
  pageComponentIds: number[],
) {
  if (pageComponentIds.length === 0) return;

  // Find monitor IDs from the page components
  // Only get components that have a monitorId (not external components)
  const components = await db
    .select({ monitorId: pageComponent.monitorId })
    .from(pageComponent)
    .where(
      and(
        inArray(pageComponent.id, pageComponentIds),
        eq(pageComponent.type, "monitor"),
      ),
    );

  if (components.length === 0) return;

  // Extract unique monitor IDs (filter out nulls)
  const monitorIds = [
    ...new Set(
      components
        .map((c) => c.monitorId)
        .filter((id): id is number => id !== null),
    ),
  ];

  if (monitorIds.length === 0) return;

  // Insert into maintenancesToMonitors
  await db
    .insert(maintenancesToMonitors)
    .values(
      monitorIds.map((monitorId) => ({
        maintenanceId,
        monitorId,
      })),
    )
    .onConflictDoNothing();
}

/**
 * Syncs maintenance_to_page_component deletes to maintenance_to_monitors
 * This is the inverse of syncMaintenanceToMonitorDeleteByMaintenance
 * When page components are removed from a maintenance, remove the corresponding monitors
 */
export async function syncMaintenanceToPageComponentDeleteByMaintenance(
  db: DB | Transaction,
  maintenanceId: number,
) {
  await db
    .delete(maintenancesToMonitors)
    .where(eq(maintenancesToMonitors.maintenanceId, maintenanceId));
}
