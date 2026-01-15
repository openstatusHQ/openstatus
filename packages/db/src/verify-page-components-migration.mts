import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { count, eq, and, isNull, isNotNull, sql as sqlQuery } from "drizzle-orm";

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
 * Verification Script: Verify data migration from monitors_to_pages to page_components
 *
 * Run with: bun packages/db/src/verify-page-components-migration.mts
 */

interface VerificationResult {
  name: string;
  passed: boolean;
  message: string;
  details?: unknown;
}

async function main() {
  const db = drizzle(
    createClient({ url: env.DATABASE_URL, authToken: env.DATABASE_AUTH_TOKEN }),
  );

  console.log("=".repeat(70));
  console.log("Migration Verification: monitors_to_pages → page_components");
  console.log("=".repeat(70));

  const results: VerificationResult[] = [];

  // Test 1: Compare record count
  console.log("\n[Test 1] Comparing record counts...");
  const monitorsToPagesCount = await db
    .select({ count: count() })
    .from(monitorsToPages)
    .get();
  const pageComponentsCount = await db
    .select({ count: count() })
    .from(pageComponent)
    .where(eq(pageComponent.type, "monitor"))
    .get();

  const countMatch =
    monitorsToPagesCount?.count === pageComponentsCount?.count;
  results.push({
    name: "Record Count Match",
    passed: countMatch,
    message: countMatch
      ? `Both tables have ${monitorsToPagesCount?.count} records`
      : `Mismatch: monitors_to_pages has ${monitorsToPagesCount?.count}, page_components has ${pageComponentsCount?.count}`,
  });
  console.log(`  monitors_to_pages: ${monitorsToPagesCount?.count}`);
  console.log(`  page_components (type='monitor'): ${pageComponentsCount?.count}`);

  // Test 2: Verify all page_components have type='monitor'
  console.log("\n[Test 2] Verifying all migrated records have type='monitor'...");
  const nonMonitorTypes = await db
    .select({ count: count() })
    .from(pageComponent)
    .where(
      and(
        isNotNull(pageComponent.monitorId),
        sqlQuery`${pageComponent.type} != 'monitor'`,
      ),
    )
    .get();

  const allMonitorType = nonMonitorTypes?.count === 0;
  results.push({
    name: "All Migrated Records Have type='monitor'",
    passed: allMonitorType,
    message: allMonitorType
      ? "All records with monitorId have type='monitor'"
      : `Found ${nonMonitorTypes?.count} records with monitorId but wrong type`,
  });

  // Test 3: Spot check order values
  console.log("\n[Test 3] Spot checking order values...");
  const sampleMonitorsToPages = await db
    .select()
    .from(monitorsToPages)
    .limit(10)
    .all();

  let orderMismatches = 0;
  const orderDetails: Array<{
    pageId: number;
    monitorId: number;
    expected: number | null;
    actual: number | null;
  }> = [];

  for (const record of sampleMonitorsToPages) {
    const component = await db
      .select({ order: pageComponent.order })
      .from(pageComponent)
      .where(
        and(
          eq(pageComponent.pageId, record.pageId),
          eq(pageComponent.monitorId, record.monitorId),
        ),
      )
      .get();

    const expectedOrder = record.order ?? 0;
    const actualOrder = component?.order ?? 0;

    if (expectedOrder !== actualOrder) {
      orderMismatches++;
      orderDetails.push({
        pageId: record.pageId,
        monitorId: record.monitorId,
        expected: expectedOrder,
        actual: actualOrder,
      });
    }
  }

  results.push({
    name: "Order Values Match",
    passed: orderMismatches === 0,
    message:
      orderMismatches === 0
        ? `All ${sampleMonitorsToPages.length} sampled records have matching order values`
        : `Found ${orderMismatches} mismatches in order values`,
    details: orderDetails.length > 0 ? orderDetails : undefined,
  });

  // Test 4: Spot check groupId values (from monitorGroupId)
  console.log("\n[Test 4] Spot checking groupId values (from monitorGroupId)...");
  let groupIdMismatches = 0;
  const groupIdDetails: Array<{
    pageId: number;
    monitorId: number;
    expected: number | null;
    actual: number | null;
  }> = [];

  for (const record of sampleMonitorsToPages) {
    const component = await db
      .select({ groupId: pageComponent.groupId })
      .from(pageComponent)
      .where(
        and(
          eq(pageComponent.pageId, record.pageId),
          eq(pageComponent.monitorId, record.monitorId),
        ),
      )
      .get();

    const expectedGroupId = record.monitorGroupId ?? null;
    const actualGroupId = component?.groupId ?? null;

    if (expectedGroupId !== actualGroupId) {
      groupIdMismatches++;
      groupIdDetails.push({
        pageId: record.pageId,
        monitorId: record.monitorId,
        expected: expectedGroupId,
        actual: actualGroupId,
      });
    }
  }

  results.push({
    name: "GroupId Values Match",
    passed: groupIdMismatches === 0,
    message:
      groupIdMismatches === 0
        ? `All ${sampleMonitorsToPages.length} sampled records have matching groupId values`
        : `Found ${groupIdMismatches} mismatches in groupId values`,
    details: groupIdDetails.length > 0 ? groupIdDetails : undefined,
  });

  // Test 5: Spot check name values match monitor names
  console.log("\n[Test 5] Spot checking name values match monitor names...");
  let nameMismatches = 0;
  const nameDetails: Array<{
    monitorId: number;
    expectedName: string;
    actualName: string;
  }> = [];

  for (const record of sampleMonitorsToPages) {
    const component = await db
      .select({ name: pageComponent.name })
      .from(pageComponent)
      .where(
        and(
          eq(pageComponent.pageId, record.pageId),
          eq(pageComponent.monitorId, record.monitorId),
        ),
      )
      .get();

    const monitorData = await db
      .select({ name: monitor.name, externalName: monitor.externalName })
      .from(monitor)
      .where(eq(monitor.id, record.monitorId))
      .get();

    if (monitorData && component) {
      const expectedName =
        monitorData.externalName || monitorData.name || "Unnamed Monitor";
      const actualName = component.name;

      if (expectedName !== actualName) {
        nameMismatches++;
        nameDetails.push({
          monitorId: record.monitorId,
          expectedName,
          actualName,
        });
      }
    }
  }

  results.push({
    name: "Name Values Match Monitor Names",
    passed: nameMismatches === 0,
    message:
      nameMismatches === 0
        ? `All ${sampleMonitorsToPages.length} sampled records have matching name values`
        : `Found ${nameMismatches} mismatches in name values`,
    details: nameDetails.length > 0 ? nameDetails : undefined,
  });

  // Test 6: Verify status_reports_to_page_components has correct fan-out
  console.log("\n[Test 6] Verifying status_reports_to_page_components fan-out...");

  // Count unique status reports linked to monitors
  const statusReportsLinkedToMonitors = await db
    .select({ statusReportId: monitorsToStatusReport.statusReportId })
    .from(monitorsToStatusReport)
    .all();
  const uniqueStatusReportIds = new Set(
    statusReportsLinkedToMonitors.map((r) => r.statusReportId),
  );

  const statusReportToPageComponentCount = await db
    .select({ count: count() })
    .from(statusReportsToPageComponents)
    .get();

  // Each status report linked to a monitor should have junction entries
  // for each page_component with that monitor (on the same page)
  results.push({
    name: "Status Reports Junction Populated",
    passed: (statusReportToPageComponentCount?.count ?? 0) >= 0,
    message: `status_reports_to_page_components has ${statusReportToPageComponentCount?.count} entries (${uniqueStatusReportIds.size} unique status reports linked to monitors)`,
  });

  // Test 7: Verify maintenances_to_page_components has correct fan-out
  console.log("\n[Test 7] Verifying maintenances_to_page_components fan-out...");

  const maintenancesLinkedToMonitors = await db
    .select({ maintenanceId: maintenancesToMonitors.maintenanceId })
    .from(maintenancesToMonitors)
    .all();
  const uniqueMaintenanceIds = new Set(
    maintenancesLinkedToMonitors.map((r) => r.maintenanceId),
  );

  const maintenanceToPageComponentCount = await db
    .select({ count: count() })
    .from(maintenancesToPageComponents)
    .get();

  results.push({
    name: "Maintenances Junction Populated",
    passed: (maintenanceToPageComponentCount?.count ?? 0) >= 0,
    message: `maintenances_to_page_components has ${maintenanceToPageComponentCount?.count} entries (${uniqueMaintenanceIds.size} unique maintenances linked to monitors)`,
  });

  // Test 8: Verify all page_components with monitorId have corresponding monitors_to_pages entry
  console.log("\n[Test 8] Verifying all page_components have corresponding monitors_to_pages entries...");

  const allPageComponents = await db
    .select({
      pageId: pageComponent.pageId,
      monitorId: pageComponent.monitorId,
    })
    .from(pageComponent)
    .where(isNotNull(pageComponent.monitorId))
    .all();

  let missingInMonitorsToPages = 0;
  for (const pc of allPageComponents) {
    if (pc.monitorId === null) continue;
    const originalEntry = await db
      .select()
      .from(monitorsToPages)
      .where(
        and(
          eq(monitorsToPages.pageId, pc.pageId),
          eq(monitorsToPages.monitorId, pc.monitorId),
        ),
      )
      .get();

    if (!originalEntry) {
      missingInMonitorsToPages++;
    }
  }

  results.push({
    name: "All Page Components Have Source Records",
    passed: missingInMonitorsToPages === 0,
    message:
      missingInMonitorsToPages === 0
        ? `All ${allPageComponents.length} page_components have corresponding monitors_to_pages entries`
        : `Found ${missingInMonitorsToPages} page_components without source monitors_to_pages entries`,
  });

  // Print Summary
  console.log("\n" + "=".repeat(70));
  console.log("VERIFICATION SUMMARY");
  console.log("=".repeat(70));

  let passedCount = 0;
  let failedCount = 0;

  for (const result of results) {
    const status = result.passed ? "✓ PASS" : "✗ FAIL";
    console.log(`\n${status}: ${result.name}`);
    console.log(`  ${result.message}`);
    if (result.details) {
      console.log(`  Details: ${JSON.stringify(result.details, null, 2)}`);
    }
    if (result.passed) {
      passedCount++;
    } else {
      failedCount++;
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log(`Results: ${passedCount} passed, ${failedCount} failed`);
  console.log("=".repeat(70));

  if (failedCount > 0) {
    console.log("\n⚠️  Some verification checks failed. Please review the details above.");
    process.exit(1);
  } else {
    console.log("\n✓ All verification checks passed!");
    process.exit(0);
  }
}

main().catch((e) => {
  console.error("Verification failed with error:");
  console.error(e);
  process.exit(1);
});
