// Test data factories: create fresh, uniquely-identified resources so suites
// don't collide on shared seed IDs (workspace 1, monitors 1-3, …). Each call
// inserts a row with an auto-increment id and unique slug/name, then returns
// it — scope the test to the returned id and clean up in afterAll.
//
// Pass a transaction as the last arg to scope creation to it (e.g. inside a
// rolled-back `withTestTransaction`); omit it to commit to the shared db.
import { db as defaultDb } from "../db";
import { monitor, workspace } from "../schema";

type Db = typeof defaultDb;
type WorkspaceInsert = typeof workspace.$inferInsert;
type MonitorInsert = typeof monitor.$inferInsert;

const unique = () => crypto.randomUUID().slice(0, 8);

export async function createWorkspace(
  overrides: Partial<WorkspaceInsert> = {},
  db: Db = defaultDb,
) {
  const u = unique();
  const [row] = await db
    .insert(workspace)
    .values({
      slug: `test-ws-${u}`,
      name: "Test Workspace",
      stripeId: `test-stripe-${u}`,
      plan: "team",
      ...overrides,
    })
    .returning();
  return row;
}

export async function createMonitor(
  workspaceId: number,
  overrides: Partial<MonitorInsert> = {},
  db: Db = defaultDb,
) {
  const [row] = await db
    .insert(monitor)
    .values({
      workspaceId,
      url: "https://example.openstatus.dev",
      name: `test-monitor-${unique()}`,
      ...overrides,
    })
    .returning();
  return row;
}
