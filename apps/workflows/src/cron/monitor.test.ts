import { and, db, eq } from "@openstatus/db";
import {
  monitor,
  monitorIncidentTable,
  session,
} from "@openstatus/db/src/schema";
import {
  createMonitor,
  createTestWorkspace,
} from "@openstatus/db/src/test/factories";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { store, sendBatchEmailHtml } = vi.hoisted(() => ({
  store: new Map<string, unknown>(),
  sendBatchEmailHtml: vi.fn(async (_emails: { to: string }[]) => undefined),
}));

// the module builds its Redis client on import; an in-memory map stands in
vi.mock("@openstatus/upstash", async (original) => ({
  ...(await original<typeof import("@openstatus/upstash")>()),
  Redis: {
    fromEnv: () => ({
      exists: async (key: string) => (store.has(key) ? 1 : 0),
      set: async (key: string, value: unknown) => {
        store.set(key, value);
      },
      del: async (key: string) => {
        store.delete(key);
      },
    }),
  },
}));
vi.mock("@openstatus/emails/src/send", () => ({ sendBatchEmailHtml }));

import { Step14Days, Step3Days, StepPaused } from "./monitor";

const DAY_MS = 86_400_000;

async function inactiveUser(plan: "free" | "team" = "free") {
  const { workspace, user } = await createTestWorkspace({ plan });
  const active = await createMonitor(workspace.id, { active: true });
  return { workspace, user, active };
}

async function logIn(userId: number, expires: Date) {
  await db.insert(session).values({
    sessionToken: `test-session-${crypto.randomUUID()}`,
    userId,
    expires,
  });
}

async function isActive(monitorId: number) {
  const row = await db
    .select({ active: monitor.active })
    .from(monitor)
    .where(eq(monitor.id, monitorId))
    .get();
  return row?.active;
}

const recipients = () =>
  sendBatchEmailHtml.mock.calls.flatMap(([emails]) => emails.map((e) => e.to));

beforeEach(() => {
  store.clear();
  sendBatchEmailHtml.mockClear();
});

describe.each([
  ["Step14Days", Step14Days],
  ["Step3Days", Step3Days],
] as const)("%s", (_name, step) => {
  test("warns an inactive user once per workflow run", async () => {
    const { user } = await inactiveUser();
    const run = Date.now() - DAY_MS;

    await step(user.id, run);
    await step(user.id, run);

    expect(recipients()).toEqual([user.email]);
  });

  test("stops the workflow when the user came back since it started", async () => {
    const { user } = await inactiveUser();
    const run = Date.now() - DAY_MS;
    store.set(`workflow:user:${user.id}`, run);
    await logIn(user.id, new Date(run + 30 * DAY_MS));

    await step(user.id, run);

    expect(recipients()).toEqual([]);
    expect(store.has(`workflow:user:${user.id}`)).toBe(false);
  });
});

describe("StepPaused", () => {
  test("pauses the active monitors, tells the user and ends the workflow", async () => {
    const { workspace, user, active } = await inactiveUser();
    const alreadyPaused = await createMonitor(workspace.id, { active: false });
    const run = Date.now() - 14 * DAY_MS;
    store.set(`workflow:user:${user.id}`, run);

    await StepPaused(user.id, run);

    expect(await isActive(active.id)).toBe(false);
    expect(await isActive(alreadyPaused.id)).toBe(false);
    expect(recipients()).toEqual([user.email]);
    expect(store.has(`workflow:user:${user.id}`)).toBe(false);
  });

  test("resolves the open outage of a monitor it pauses", async () => {
    const { workspace, user, active } = await inactiveUser();
    await db
      .update(monitor)
      .set({ status: "error" })
      .where(eq(monitor.id, active.id));
    await db.insert(monitorIncidentTable).values({
      workspaceId: workspace.id,
      monitorId: active.id,
      startedAt: new Date(Date.now() - 60_000),
    });

    await StepPaused(user.id, Date.now() - 14 * DAY_MS);

    const outage = await db
      .select()
      .from(monitorIncidentTable)
      .where(and(eq(monitorIncidentTable.monitorId, active.id)))
      .get();
    expect(outage?.resolvedAt).toBeInstanceOf(Date);
    expect(outage?.autoResolved).toBe(true);
  });

  test("leaves the monitors of a user who came back", async () => {
    const { user, active } = await inactiveUser();
    const run = Date.now() - 14 * DAY_MS;
    await logIn(user.id, new Date(run + 30 * DAY_MS));

    await StepPaused(user.id, run);

    expect(await isActive(active.id)).toBe(true);
    expect(recipients()).toEqual([]);
  });

  test("never pauses the monitors of a paid workspace", async () => {
    const { user, active } = await inactiveUser("team");

    await StepPaused(user.id, Date.now() - 14 * DAY_MS);

    expect(await isActive(active.id)).toBe(true);
  });

  test("ends the workflow even when the email fails", async () => {
    const { user } = await inactiveUser();
    const run = Date.now() - 14 * DAY_MS;
    store.set(`workflow:user:${user.id}`, run);
    sendBatchEmailHtml.mockRejectedValueOnce(new Error("resend down"));

    await expect(StepPaused(user.id, run)).rejects.toThrow("resend down");

    expect(store.has(`workflow:user:${user.id}`)).toBe(false);
  });
});
