import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { and, eq, inArray } from "drizzle-orm";

import { env } from "../env.mjs";
import {
  maintenance,
  maintenancesToMonitors,
  maintenancesToPageComponents,
  monitor,
  monitorsToPages,
  monitorsToStatusReport,
  pageComponent,
  statusReport,
  statusReportsToPageComponents,
} from "./schema";

/**
 * Data Migration Script: monitors_to_pages → page_components
 *
 * This script migrates data from the old `monitors_to_pages` junction table
 * to the new `page_component` table, and creates the corresponding junction
 * entries for status reports and maintenances.
 *
 * Run with: bun packages/db/src/migrate-monitors-to-page-components.mts
 */

async function main() {
  const db = drizzle(
    createClient({ url: env.DATABASE_URL, authToken: env.DATABASE_AUTH_TOKEN }),
  );

  console.log("Starting data migration: monitors_to_pages → page_components");
  console.log("=".repeat(60));

  // Step 1: Query all records from monitors_to_pages
  console.log("\n[Step 1] Fetching all monitors_to_pages records...");
  const monitorsToPagesList = await db.select().from(monitorsToPages).all();
  console.log(`Found ${monitorsToPagesList.length} records to migrate`);

  if (monitorsToPagesList.length === 0) {
    console.log("No records to migrate. Exiting.");
    process.exit(0);
  }

  // Step 2: Fetch all unique monitors to get workspace_id and name
  console.log("\n[Step 2] Fetching monitor details...");
  const uniqueMonitorIds = [
    ...new Set(monitorsToPagesList.map((m) => m.monitorId)),
  ];
  const monitors = await db
    .select({
      id: monitor.id,
      workspaceId: monitor.workspaceId,
      name: monitor.name,
      externalName: monitor.externalName,
    })
    .from(monitor)
    .where(inArray(monitor.id, uniqueMonitorIds))
    .all();

  const monitorMap = new Map(monitors.map((m) => [m.id, m]));
  console.log(`Fetched ${monitors.length} monitors`);

  // Step 3: Insert page_component records
  console.log("\n[Step 3] Creating page_component records...");
  let insertedCount = 0;
  let skippedCount = 0;

  // Build a map to track page_component IDs by (pageId, monitorId)
  const pageComponentMap = new Map<string, number>();

  for (const record of monitorsToPagesList) {
    const monitorData = monitorMap.get(record.monitorId);

    if (!monitorData) {
      console.warn(
        `  Warning: Monitor ${record.monitorId} not found, skipping...`,
      );
      skippedCount++;
      continue;
    }

    if (!monitorData.workspaceId) {
      console.warn(
        `  Warning: Monitor ${record.monitorId} has no workspaceId, skipping...`,
      );
      skippedCount++;
      continue;
    }

    // Use externalName if available, otherwise use name
    const componentName = monitorData.externalName || monitorData.name || "Unnamed Monitor";

    try {
      const result = await db
        .insert(pageComponent)
        .values({
          workspaceId: monitorData.workspaceId,
          pageId: record.pageId,
          type: "monitor",
          monitorId: record.monitorId,
          name: componentName,
          order: record.order ?? 0,
          groupId: record.monitorGroupId ?? null,
          groupOrder: record.groupOrder ?? 0,
        })
        .onConflictDoNothing()
        .returning({ id: pageComponent.id })
        .get();

      if (result) {
        const key = `${record.pageId}-${record.monitorId}`;
        pageComponentMap.set(key, result.id);
        insertedCount++;
        console.log(
          `  Created page_component for page=${record.pageId}, monitor=${record.monitorId} (id=${result.id})`,
        );
      } else {
        // Record already exists, fetch its ID
        const existing = await db
          .select({ id: pageComponent.id })
          .from(pageComponent)
          .where(
            and(
              eq(pageComponent.pageId, record.pageId),
              eq(pageComponent.monitorId, record.monitorId),
            ),
          )
          .get();

        if (existing) {
          const key = `${record.pageId}-${record.monitorId}`;
          pageComponentMap.set(key, existing.id);
          console.log(
            `  Skipped (already exists): page=${record.pageId}, monitor=${record.monitorId} (id=${existing.id})`,
          );
        }
        skippedCount++;
      }
    } catch (error) {
      console.error(
        `  Error creating page_component for page=${record.pageId}, monitor=${record.monitorId}:`,
        error,
      );
      skippedCount++;
    }
  }

  console.log(`\nPage components: ${insertedCount} created, ${skippedCount} skipped`);

  // Step 4: Migrate status_reports_to_monitors to status_reports_to_page_components
  console.log("\n[Step 4] Creating status_reports_to_page_components records...");

  // Fetch all status_reports_to_monitors
  const statusReportToMonitorList = await db
    .select()
    .from(monitorsToStatusReport)
    .all();
  console.log(`Found ${statusReportToMonitorList.length} status report to monitor links`);

  // Get status report page associations for filtering
  const statusReportList = await db
    .select({ id: statusReport.id, pageId: statusReport.pageId })
    .from(statusReport)
    .all();
  const statusReportPageMap = new Map(
    statusReportList.map((sr) => [sr.id, sr.pageId]),
  );

  let statusReportLinksCreated = 0;
  let statusReportLinksSkipped = 0;

  for (const link of statusReportToMonitorList) {
    // For each status report linked to a monitor, create links to all page_components
    // that have this monitor AND are on the same page as the status report
    const statusReportPageId = statusReportPageMap.get(link.statusReportId);

    // Find page_components with this monitor
    for (const [key, pageComponentId] of pageComponentMap.entries()) {
      const parts = key.split("-");
      const pageIdStr = parts[0];
      const monitorIdStr = parts[1];
      if (!pageIdStr || !monitorIdStr) continue;
      const pageId = Number.parseInt(pageIdStr, 10);
      const monitorId = Number.parseInt(monitorIdStr, 10);

      // Only link if the monitor matches AND the page matches
      if (
        monitorId === link.monitorId &&
        (statusReportPageId === pageId || statusReportPageId === null)
      ) {
        try {
          await db
            .insert(statusReportsToPageComponents)
            .values({
              statusReportId: link.statusReportId,
              pageComponentId: pageComponentId,
            })
            .onConflictDoNothing()
            .run();
          statusReportLinksCreated++;
          console.log(
            `  Linked status_report=${link.statusReportId} to page_component=${pageComponentId}`,
          );
        } catch (error) {
          console.error(
            `  Error linking status_report=${link.statusReportId} to page_component=${pageComponentId}:`,
            error,
          );
          statusReportLinksSkipped++;
        }
      }
    }
  }

  console.log(
    `\nStatus report links: ${statusReportLinksCreated} created, ${statusReportLinksSkipped} skipped`,
  );

  // Step 5: Migrate maintenances_to_monitors to maintenances_to_page_components
  console.log("\n[Step 5] Creating maintenances_to_page_components records...");

  // Fetch all maintenances_to_monitors
  const maintenanceToMonitorList = await db
    .select()
    .from(maintenancesToMonitors)
    .all();
  console.log(`Found ${maintenanceToMonitorList.length} maintenance to monitor links`);

  // Get maintenance page associations for filtering
  const maintenanceList = await db
    .select({ id: maintenance.id, pageId: maintenance.pageId })
    .from(maintenance)
    .all();
  const maintenancePageMap = new Map(
    maintenanceList.map((m) => [m.id, m.pageId]),
  );

  let maintenanceLinksCreated = 0;
  let maintenanceLinksSkipped = 0;

  for (const link of maintenanceToMonitorList) {
    // For each maintenance linked to a monitor, create links to all page_components
    // that have this monitor AND are on the same page as the maintenance
    const maintenancePageId = maintenancePageMap.get(link.maintenanceId);

    // Find page_components with this monitor
    for (const [key, pageComponentId] of pageComponentMap.entries()) {
      const parts = key.split("-");
      const pageIdStr = parts[0];
      const monitorIdStr = parts[1];
      if (!pageIdStr || !monitorIdStr) continue;
      const pageId = Number.parseInt(pageIdStr, 10);
      const monitorId = Number.parseInt(monitorIdStr, 10);

      // Only link if the monitor matches AND the page matches
      if (
        monitorId === link.monitorId &&
        (maintenancePageId === pageId || maintenancePageId === null)
      ) {
        try {
          await db
            .insert(maintenancesToPageComponents)
            .values({
              maintenanceId: link.maintenanceId,
              pageComponentId: pageComponentId,
            })
            .onConflictDoNothing()
            .run();
          maintenanceLinksCreated++;
          console.log(
            `  Linked maintenance=${link.maintenanceId} to page_component=${pageComponentId}`,
          );
        } catch (error) {
          console.error(
            `  Error linking maintenance=${link.maintenanceId} to page_component=${pageComponentId}:`,
            error,
          );
          maintenanceLinksSkipped++;
        }
      }
    }
  }

  console.log(
    `\nMaintenance links: ${maintenanceLinksCreated} created, ${maintenanceLinksSkipped} skipped`,
  );

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("Migration Summary:");
  console.log(`  - Page components: ${insertedCount} created, ${skippedCount} skipped`);
  console.log(
    `  - Status report links: ${statusReportLinksCreated} created, ${statusReportLinksSkipped} skipped`,
  );
  console.log(
    `  - Maintenance links: ${maintenanceLinksCreated} created, ${maintenanceLinksSkipped} skipped`,
  );
  console.log("=".repeat(60));
  console.log("\nMigration completed successfully!");

  process.exit(0);
}

main().catch((e) => {
  console.error("Migration failed");
  console.error(e);
  process.exit(1);
});
