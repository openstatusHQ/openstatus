import { and, db, eq, isNull } from "@openstatus/db";
import {
  maintenance,
  maintenancesToPageComponents,
  monitor,
  monitorHeartbeatState,
  monitorIncidentTable,
  notificationOutbox,
  page,
  pageComponent,
} from "@openstatus/db/src/schema";
import {
  createMonitor,
  createNotification,
  createPage,
  createPageComponent,
  createTestWorkspace,
  linkNotificationToMonitor,
} from "@openstatus/db/src/test/factories";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
  type MockInstance,
} from "vitest";

import { providerToFunction } from "../checker/utils";
import { stubPublishAuditLog } from "../test/stub-audit-log";
import { handleHeartbeatSweepCron, missedPingMessage } from "./heartbeat-sweep";

const HOUR_MS = 3_600_000;
const GRACE_MS = 300_000;

let stubs: MockInstance[] = [];
let workspaceId: number;

beforeAll(async () => {
  const { workspace } = await createTestWorkspace();
  workspaceId = workspace.id;
});

beforeEach(() => {
  stubs = [
    stubPublishAuditLog(),
    vi
      .spyOn(providerToFunction.email, "sendAlert")
      .mockImplementation(() => Promise.resolve()),
    vi
      .spyOn(providerToFunction.email, "sendRecovery")
      .mockImplementation(() => Promise.resolve()),
  ];
});

afterEach(() => {
  for (const s of stubs) s.mockRestore();
  stubs = [];
});

afterAll(async () => {
  await db
    .delete(maintenance)
    .where(eq(maintenance.workspaceId, workspaceId))
    .run();
  await db
    .delete(pageComponent)
    .where(eq(pageComponent.workspaceId, workspaceId))
    .run();
  await db.delete(page).where(eq(page.workspaceId, workspaceId)).run();
  await db.delete(monitor).where(eq(monitor.workspaceId, workspaceId)).run();
});

async function createHeartbeat(lastPingAt: number | null) {
  const row = await createMonitor(workspaceId, {
    jobType: "heartbeat",
    url: "",
    regions: "",
    periodicity: "other",
    active: true,
    heartbeatToken: crypto.randomUUID(),
    heartbeatPeriod: HOUR_MS / 1000,
    heartbeatGrace: GRACE_MS / 1000,
  });
  if (lastPingAt !== null) await ping(row.id, lastPingAt);
  const notif = await createNotification(workspaceId);
  await linkNotificationToMonitor(notif.id, row.id);
  return row;
}

async function ping(monitorId: number, at: number) {
  const values = {
    lastPingAt: new Date(at),
    nextDueAt: new Date(at + HOUR_MS + GRACE_MS),
  };
  await db
    .insert(monitorHeartbeatState)
    .values({ monitorId, ...values })
    .onConflictDoUpdate({ target: monitorHeartbeatState.monitorId, set: values })
    .run();
}

async function statusOf(monitorId: number) {
  const row = await db
    .select({ status: monitor.status })
    .from(monitor)
    .where(eq(monitor.id, monitorId))
    .get();
  return row?.status;
}

async function openIncidents(monitorId: number) {
  return db
    .select()
    .from(monitorIncidentTable)
    .where(
      and(
        eq(monitorIncidentTable.monitorId, monitorId),
        isNull(monitorIncidentTable.resolvedAt),
      ),
    )
    .all();
}

async function outboxFor(monitorId: number) {
  return db
    .select()
    .from(notificationOutbox)
    .where(eq(notificationOutbox.monitorId, monitorId))
    .all();
}

describe("handleHeartbeatSweepCron", () => {
  test("an overdue heartbeat goes down with an incident and an alert", async () => {
    const lastPing = Date.now() - 2 * HOUR_MS;
    const row = await createHeartbeat(lastPing);

    await handleHeartbeatSweepCron();

    expect(await statusOf(row.id)).toBe("error");
    const incidents = await openIncidents(row.id);
    expect(incidents).toHaveLength(1);
    expect(incidents[0]?.startedAt?.getTime()).toBe(
      Math.floor((lastPing + HOUR_MS + GRACE_MS) / 1000) * 1000,
    );
    const outbox = await outboxFor(row.id);
    expect(outbox.map((r) => r.eventType)).toEqual(["alert"]);
  });

  test("a second sweep does not alert again", async () => {
    const row = await createHeartbeat(Date.now() - 2 * HOUR_MS);

    await handleHeartbeatSweepCron();
    await handleHeartbeatSweepCron();

    expect(await outboxFor(row.id)).toHaveLength(1);
    expect(await openIncidents(row.id)).toHaveLength(1);
  });

  test("a ping after the miss recovers it and resolves the incident", async () => {
    const row = await createHeartbeat(Date.now() - 2 * HOUR_MS);
    await handleHeartbeatSweepCron();
    expect(await statusOf(row.id)).toBe("error");

    await ping(row.id, Date.now());
    await handleHeartbeatSweepCron();

    expect(await statusOf(row.id)).toBe("active");
    expect(await openIncidents(row.id)).toHaveLength(0);
    const events = (await outboxFor(row.id)).map((r) => r.eventType).sort();
    expect(events).toEqual(["alert", "recovery"]);
  });

  test("a heartbeat on time is left alone", async () => {
    const row = await createHeartbeat(Date.now());
    await handleHeartbeatSweepCron();
    expect(await statusOf(row.id)).toBe("active");
    expect(await outboxFor(row.id)).toHaveLength(0);
  });

  test("a heartbeat waiting for its first ping never alerts", async () => {
    const row = await createHeartbeat(null);
    await db
      .insert(monitorHeartbeatState)
      .values({ monitorId: row.id, lastPingAt: null, nextDueAt: null })
      .run();

    await handleHeartbeatSweepCron();

    expect(await statusOf(row.id)).toBe("active");
    expect(await outboxFor(row.id)).toHaveLength(0);
  });

  test("a paused heartbeat is skipped", async () => {
    const row = await createHeartbeat(Date.now() - 2 * HOUR_MS);
    await db
      .update(monitor)
      .set({ active: false })
      .where(eq(monitor.id, row.id))
      .run();

    await handleHeartbeatSweepCron();

    expect(await statusOf(row.id)).toBe("active");
  });

  test("a heartbeat in maintenance is skipped", async () => {
    const row = await createHeartbeat(Date.now() - 2 * HOUR_MS);
    const statusPage = await createPage(workspaceId);
    const component = await createPageComponent(workspaceId, statusPage.id, {
      type: "monitor",
      monitorId: row.id,
    });
    const [window] = await db
      .insert(maintenance)
      .values({
        title: "db upgrade",
        message: "",
        from: new Date(Date.now() - HOUR_MS),
        to: new Date(Date.now() + HOUR_MS),
        workspaceId,
        pageId: statusPage.id,
      })
      .returning();
    if (!window) throw new Error("maintenance insert returned no row");
    await db
      .insert(maintenancesToPageComponents)
      .values({ maintenanceId: window.id, pageComponentId: component.id })
      .run();

    await handleHeartbeatSweepCron();

    expect(await statusOf(row.id)).toBe("active");
  });
});

test("missedPingMessage", () => {
  expect(
    missedPingMessage({
      last_ping_at: Date.UTC(2026, 0, 1),
      heartbeat_period: 86_400,
      heartbeat_grace: 1_800,
    }),
  ).toBe(
    "No ping since 2026-01-01T00:00:00.000Z, expected every 1d (+30m grace)",
  );
});
