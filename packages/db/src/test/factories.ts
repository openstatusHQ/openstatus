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

// SQLite returns SQLITE_BUSY / SQLITE_LOCKED when a concurrent test file holds
// the write lock, which surfaces as "database is locked" on bare inserts.
// Retry briefly instead of failing the whole suite; mirrors the retryable-error
// rules in @openstatus/services (which db cannot depend on — services depends on db).
const RETRYABLE_CODES = new Set(["SQLITE_BUSY", "SQLITE_LOCKED"]);
const RETRYABLE_MESSAGE = /database is (locked|busy)/i;
const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 25;

function isBusyError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  if ("code" in err && typeof (err as { code: unknown }).code === "string") {
    if (RETRYABLE_CODES.has((err as { code: string }).code)) return true;
  }
  if (
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    if (RETRYABLE_MESSAGE.test((err as { message: string }).message))
      return true;
  }
  return false;
}

async function withBusyRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isBusyError(err)) throw err;
      lastErr = err;
      await new Promise((resolve) =>
        setTimeout(resolve, BASE_DELAY_MS * 2 ** attempt),
      );
    }
  }
  throw lastErr;
}

export async function createWorkspace(
  overrides: Partial<WorkspaceInsert> = {},
  db: Db = defaultDb,
) {
  const u = unique();
  const [row] = await withBusyRetry(() =>
    db
      .insert(workspace)
      .values({
        slug: `test-ws-${u}`,
        name: "Test Workspace",
        stripeId: `test-stripe-${u}`,
        plan: "team",
        ...overrides,
      })
      .returning(),
  );
  if (!row) throw new Error("factory insert returned no row");
  return row;
}

export async function createMonitor(
  workspaceId: number,
  overrides: Partial<MonitorInsert> = {},
  db: Db = defaultDb,
) {
  const [row] = await withBusyRetry(() =>
    db
      .insert(monitor)
      .values({
        workspaceId,
        url: "https://example.openstatus.dev",
        name: `test-monitor-${unique()}`,
        ...overrides,
      })
      .returning(),
  );
  if (!row) throw new Error("factory insert returned no row");
  return row;
}

export async function createUser(
  overrides: Partial<UserInsert> = {},
  db: Db = defaultDb,
) {
  const u = unique();
  const [row] = await withBusyRetry(() =>
    db
      .insert(user)
      .values({
        tenantId: `test-tenant-${u}`,
        firstName: "Test",
        lastName: "User",
        email: `test-${u}@openstatus.dev`,
        photoUrl: "",
        ...overrides,
      })
      .returning(),
  );
  if (!row) throw new Error("factory insert returned no row");
  return row;
}

export async function addUserToWorkspace(
  userId: number,
  workspaceId: number,
  role: "owner" | "member" = "owner",
  db: Db = defaultDb,
) {
  const [row] = await withBusyRetry(() =>
    db
      .insert(usersToWorkspaces)
      .values({ userId, workspaceId, role })
      .returning(),
  );
  if (!row) throw new Error("factory insert returned no row");
  return row;
}

export async function createPage(
  workspaceId: number,
  overrides: Partial<PageInsert> = {},
  db: Db = defaultDb,
) {
  const [row] = await withBusyRetry(() =>
    db
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
      .returning(),
  );
  if (!row) throw new Error("factory insert returned no row");
  return row;
}

export async function createPageComponent(
  workspaceId: number,
  pageId: number,
  overrides: Partial<PageComponentInsert> = {},
  db: Db = defaultDb,
) {
  const [row] = await withBusyRetry(() =>
    db
      .insert(pageComponent)
      .values({
        workspaceId,
        pageId,
        type: "static",
        name: `test-component-${unique()}`,
        order: 0,
        ...overrides,
      })
      .returning(),
  );
  if (!row) throw new Error("factory insert returned no row");
  return row;
}

export async function createNotification(
  workspaceId: number,
  overrides: Partial<NotificationInsert> = {},
  db: Db = defaultDb,
) {
  const [row] = await withBusyRetry(() =>
    db
      .insert(notification)
      .values({
        workspaceId,
        name: `test-notification-${unique()}`,
        provider: "email",
        data: JSON.stringify({ email: `test-${unique()}@openstatus.dev` }),
        ...overrides,
      })
      .returning(),
  );
  if (!row) throw new Error("factory insert returned no row");
  return row;
}

export async function linkNotificationToMonitor(
  notificationId: number,
  monitorId: number,
  db: Db = defaultDb,
) {
  const [row] = await withBusyRetry(() =>
    db
      .insert(notificationsToMonitors)
      .values({ notificationId, monitorId })
      .returning(),
  );
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
