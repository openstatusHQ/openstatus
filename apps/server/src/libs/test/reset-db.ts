/**
 * Reset the database to a clean state before running tests.
 * This ensures tests are not affected by data created in previous test runs.
 *
 * Seeded data IDs (from packages/db/src/seed.mts):
 * - Monitors: 1-5
 * - Pages: 1
 * - Maintenances: 1-2
 * - Notifications: 1
 * - Status Reports: 1-2
 * - Status Report Updates: 1-7
 * - Incidents: 1-2
 */
import { db, sql } from "@openstatus/db";

// Delete test-created data (using correct table names from schema)
await db.run(sql`DELETE FROM page_subscriber WHERE id > 0`);
await db.run(
  sql`DELETE FROM monitors_to_pages WHERE monitor_id > 5 OR page_id > 1`,
);
await db.run(sql`DELETE FROM maintenance_to_monitor WHERE maintenance_id > 2`);
await db.run(
  sql`DELETE FROM notifications_to_monitors WHERE notification_id > 1`,
);
await db.run(
  sql`DELETE FROM status_report_to_monitors WHERE status_report_id > 2`,
);
await db.run(sql`DELETE FROM status_report_update WHERE id > 7`);
await db.run(sql`DELETE FROM status_report WHERE id > 2`);
await db.run(sql`DELETE FROM maintenance WHERE id > 2`);
await db.run(sql`DELETE FROM notification WHERE id > 1`);
await db.run(sql`DELETE FROM page WHERE id > 1`);
await db.run(sql`DELETE FROM monitor WHERE id > 5`);

// Reset seeded monitors that may have been soft-deleted
await db.run(
  sql`UPDATE monitor SET deleted_at = NULL, active = 1 WHERE id IN (1, 2, 3, 4, 5)`,
);

console.log("Database reset complete");
