// Test data factories: create fresh, uniquely-identified resources so suites
// don't collide on shared seed IDs (workspace 1, monitors 1-3, …). Each call
// inserts a row with an auto-increment id and unique slug/name, then returns
// it — scope the test to the returned id.
//
// Pass a transaction as the last arg to scope creation to it (e.g. inside a
// rolled-back `withTestTransaction`); omit it to commit to the shared db.
import { db as defaultDb } from "../db";
import {
  monitor,
  notification,
  notificationsToMonitors,
  page,
  pageComponent,
  user,
  usersToWorkspaces,
  workspace,
} from "../schema";
import { TEAM_WORKSPACE_LIMITS } from "../seed/limits";

type Db = typeof defaultDb;
type WorkspaceInsert = typeof workspace.$inferInsert;
type MonitorInsert = typeof monitor.$inferInsert;
type UserInsert = typeof user.$inferInsert;
type PageInsert = typeof page.$inferInsert;
type PageComponentInsert = typeof pageComponent.$inferInsert;
type NotificationInsert = typeof notification.$inferInsert;

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
  if (!row) throw new Error("factory insert returned no row");
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
  if (!row) throw new Error("factory insert returned no row");
  return row;
}

export async function createUser(
  overrides: Partial<UserInsert> = {},
  db: Db = defaultDb,
) {
  const u = unique();
  const [row] = await db
    .insert(user)
    .values({
      tenantId: `test-tenant-${u}`,
      firstName: "Test",
      lastName: "User",
      email: `test-${u}@openstatus.dev`,
      photoUrl: "",
      ...overrides,
    })
    .returning();
  if (!row) throw new Error("factory insert returned no row");
  return row;
}

export async function addUserToWorkspace(
  userId: number,
  workspaceId: number,
  role: "owner" | "member" = "owner",
  db: Db = defaultDb,
) {
  const [row] = await db
    .insert(usersToWorkspaces)
    .values({ userId, workspaceId, role })
    .returning();
  if (!row) throw new Error("factory insert returned no row");
  return row;
}

export async function createPage(
  workspaceId: number,
  overrides: Partial<PageInsert> = {},
  db: Db = defaultDb,
) {
  const [row] = await db
    .insert(page)
    .values({
      workspaceId,
      title: "Test Page",
      description: "Test page description",
      // `slug` is globally unique, not per-workspace.
      slug: `test-page-${unique()}`,
      customDomain: "",
      published: true,
      ...overrides,
    })
    .returning();
  if (!row) throw new Error("factory insert returned no row");
  return row;
}

export async function createPageComponent(
  workspaceId: number,
  pageId: number,
  overrides: Partial<PageComponentInsert> = {},
  db: Db = defaultDb,
) {
  const [row] = await db
    .insert(pageComponent)
    .values({
      workspaceId,
      pageId,
      type: "static",
      name: `test-component-${unique()}`,
      order: 0,
      ...overrides,
    })
    .returning();
  if (!row) throw new Error("factory insert returned no row");
  return row;
}

export async function createNotification(
  workspaceId: number,
  overrides: Partial<NotificationInsert> = {},
  db: Db = defaultDb,
) {
  const [row] = await db
    .insert(notification)
    .values({
      workspaceId,
      name: `test-notification-${unique()}`,
      provider: "email",
      data: JSON.stringify({ email: `test-${unique()}@openstatus.dev` }),
      ...overrides,
    })
    .returning();
  if (!row) throw new Error("factory insert returned no row");
  return row;
}

export async function linkNotificationToMonitor(
  notificationId: number,
  monitorId: number,
  db: Db = defaultDb,
) {
  const [row] = await db
    .insert(notificationsToMonitors)
    .values({ notificationId, monitorId })
    .returning();
  if (!row) throw new Error("factory insert returned no row");
  return row;
}

export type TestWorkspaceFixture = {
  workspace: Awaited<ReturnType<typeof createWorkspace>>;
  user: Awaited<ReturnType<typeof createUser>>;
};

/**
 * A workspace with an owner, isolated from the seed fixtures and from every
 * other suite. Prefer this over the seeded workspaces so suites can assert on
 * exact counts and on workspace-scoped side effects like `audit_log`.
 *
 * Not torn down: `onDelete: "cascade"` is set on only some workspace-scoped
 * tables, so a delete would fail on the rest. Test databases are ephemeral.
 */
export async function createTestWorkspace(
  overrides: Partial<WorkspaceInsert> = {},
  db: Db = defaultDb,
): Promise<TestWorkspaceFixture> {
  const plan = overrides.plan ?? "team";
  const ws = await createWorkspace(
    {
      // Match the seeded team workspace's looser caps; `free` keeps plan defaults
      // so quota-rejection tests still hit their limits.
      limits: plan === "team" ? TEAM_WORKSPACE_LIMITS : "{}",
      ...overrides,
      plan,
    },
    db,
  );
  const owner = await createUser({}, db);
  await addUserToWorkspace(owner.id, ws.id, "owner", db);
  return { workspace: ws, user: owner };
}
