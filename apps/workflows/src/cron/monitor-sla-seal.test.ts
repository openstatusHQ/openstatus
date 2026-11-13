import { db, eq } from "@openstatus/db";
import {
  monitor,
  monitorSlaPolicy,
  monitorSlaPolicyToMonitor,
} from "@openstatus/db/src/schema";
import {
  createMonitor,
  createTestWorkspace,
} from "@openstatus/db/src/test/factories";
import type { sendMonitorSlaMissed } from "@openstatus/emails";
import { afterAll, describe, expect, test } from "vitest";

import { runMonitorSlaSealTick } from "./monitor-sla-seal";
import { SCHEDULED_TASKS } from "./scheduler";

const OCT_END = Date.UTC(2026, 10, 1);
const now = new Date(OCT_END + 4 * 24 * 3_600_000);
const beforeOctEnd = new Date(Date.UTC(2026, 9, 10));
const HOUR = 3_600_000;

type EpisodesPipes = NonNullable<
  NonNullable<Parameters<typeof runMonitorSlaSealTick>[0]>["episodesPipes"]
>;
// six hours down from Oct 10, ok otherwise
const pipe: EpisodesPipes["http"] = async ({
  monitorIds,
  fromDate,
  toDate,
}) => {
  const down = beforeOctEnd.getTime();
  const parts = [
    { kind: "ok" as const, startedAt: fromDate, endedAt: down },
    { kind: "error" as const, startedAt: down, endedAt: down + 6 * HOUR },
    { kind: "ok" as const, startedAt: down + 6 * HOUR, endedAt: toDate },
  ];
  return {
    data: monitorIds.flatMap((monitorId) =>
      parts.map((p) => ({
        monitorId,
        ...p,
        runs: (p.endedAt - p.startedAt) / 600_000,
        weightedMs: p.endedAt - p.startedAt,
      })),
    ),
  };
};
const episodesPipes: EpisodesPipes = {
  http: pipe,
  tcp: pipe,
  dns: pipe,
  icmp: pipe,
  grpc: pipe,
};
// Oct 10 to Nov 1, six hours down
const UPTIME = Math.floor(((528 - 6) * 100_000) / 528);

describe("monitor-sla-seal", () => {
  test("runs daily with a check-in", () => {
    const task = SCHEDULED_TASKS.find((t) => t.name === "monitor-sla-seal");
    expect(task).toMatchObject({ expression: "47 5 * * *", checkIn: true });
  });

  test("leaves a month open for corrections for 72 hours after it ends in every zone", async () => {
    // October ends first at Oct 31 10:00 UTC, in UTC+14
    const res = await runMonitorSlaSealTick({
      now: new Date(Date.UTC(2026, 10, 3, 9)),
      policyIds: [],
    });
    expect(res).toEqual({
      month: "2026-10-01",
      sealed: 0,
      skipped: "correction-window",
      unavailable: 0,
      unavailablePolicyIds: [],
      notified: 0,
    });
  });
});

describe("monitor-sla-seal miss email", () => {
  const policyIds: number[] = [];
  const monitorIds: number[] = [];

  afterAll(async () => {
    for (const id of policyIds) {
      await db.delete(monitorSlaPolicy).where(eq(monitorSlaPolicy.id, id));
    }
    for (const id of monitorIds) {
      await db.delete(monitor).where(eq(monitor.id, id));
    }
  });

  async function missedPolicy() {
    const { workspace, user } = await createTestWorkspace();
    const m = await createMonitor(workspace.id, {
      name: "Checkout API",
      jobType: "http",
      regions: "ams",
      periodicity: "10m",
    });
    monitorIds.push(m.id);
    const policy = await db
      .insert(monitorSlaPolicy)
      .values({
        workspaceId: workspace.id,
        name: "Partner contract",
        target: 99_500,
        createdAt: beforeOctEnd,
      })
      .returning()
      .get();
    policyIds.push(policy.id);
    await db.insert(monitorSlaPolicyToMonitor).values({
      monitorSlaPolicyId: policy.id,
      monitorId: m.id,
      createdAt: beforeOctEnd,
    });
    return { user, m, policy };
  }

  test("two machines sealing together send one email to the owners", async () => {
    const { user, m, policy } = await missedPolicy();

    const sent: Parameters<typeof sendMonitorSlaMissed>[0][] = [];
    const send: typeof sendMonitorSlaMissed = async (req) => {
      sent.push(req);
      return "email_1";
    };
    const tick = () =>
      runMonitorSlaSealTick({
        now,
        policyIds: [policy.id],
        episodesPipes,
        sleep: async () => {},
        send,
        dashboardUrl: "https://app.test",
      });
    const results = await Promise.all([tick(), tick()]);

    expect(results.map((r) => r.notified).sort()).toEqual([0, 1]);
    expect(sent).toEqual([
      {
        to: [user.email],
        idempotencyKey: `monitor-sla-miss:${policy.id}:2026-10-01`,
        policyName: "Partner contract",
        month: "2026-10-01",
        workspaceName: expect.any(String),
        monitors: [
          { id: m.id, name: "Checkout API", uptime: UPTIME, target: 99_500 },
        ],
        url: `https://app.test/sla-policies/monitors/${policy.id}`,
      },
    ]);

    await tick();
    expect(sent).toHaveLength(1);
  });

  test("a failed or skipped send is not counted, and is never retried", async () => {
    const { policy } = await missedPolicy();
    let calls = 0;
    const tick = (send: typeof sendMonitorSlaMissed) =>
      runMonitorSlaSealTick({
        now,
        policyIds: [policy.id],
        episodesPipes,
        sleep: async () => {},
        send,
        dashboardUrl: "https://app.test",
      });

    const failed = await tick(async () => {
      calls++;
      throw new Error("Resend rejected");
    });
    expect(failed.notified).toBe(0);

    const again = await tick(async () => {
      calls++;
      return "email_1";
    });
    expect(again.notified).toBe(0);
    expect(calls).toBe(1);
  });

  test("a send that returns no id (outside production) is not counted", async () => {
    const { policy } = await missedPolicy();
    const res = await runMonitorSlaSealTick({
      now,
      policyIds: [policy.id],
      episodesPipes,
      sleep: async () => {},
      send: async () => undefined,
      dashboardUrl: "https://app.test",
    });
    expect(res.notified).toBe(0);
  });
});
