import { db, eq } from "@openstatus/db";
import {
  frozenMonitorUptime,
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

describe("monitor-sla-seal", () => {
  test("runs daily with a check-in", () => {
    const task = SCHEDULED_TASKS.find((t) => t.name === "monitor-sla-seal");
    expect(task).toMatchObject({ expression: "47 5 * * *", checkIn: true });
  });

  test("leaves a month open for corrections for 72 hours after it ends", async () => {
    const res = await runMonitorSlaSealTick({
      now: new Date(Date.UTC(2026, 10, 3, 12)),
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
  let policyId: number | undefined;
  let monitorId: number | undefined;

  afterAll(async () => {
    if (policyId) {
      await db
        .delete(monitorSlaPolicy)
        .where(eq(monitorSlaPolicy.id, policyId));
    }
    if (monitorId) {
      await db
        .delete(frozenMonitorUptime)
        .where(eq(frozenMonitorUptime.monitorId, monitorId));
      await db.delete(monitor).where(eq(monitor.id, monitorId));
    }
  });

  test("two machines sealing together send one email to the owners", async () => {
    const { workspace, user } = await createTestWorkspace();
    const m = await createMonitor(workspace.id, {
      name: "Checkout API",
      jobType: "http",
      regions: "ams",
      periodicity: "10m",
    });
    monitorId = m.id;
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
    policyId = policy.id;
    await db.insert(monitorSlaPolicyToMonitor).values({
      monitorSlaPolicyId: policy.id,
      monitorId: m.id,
      createdAt: beforeOctEnd,
    });
    await db.insert(frozenMonitorUptime).values({
      workspaceId: workspace.id,
      monitorId: m.id,
      month: "2026-10-01",
      days: [
        {
          day: "2026-10-01",
          requests: { ok: 10, degraded: 0, error: 0 },
          runs: { ok: 990, degraded: 0, error: 10 },
        },
      ],
    });

    const sent: Parameters<typeof sendMonitorSlaMissed>[0][] = [];
    const send: typeof sendMonitorSlaMissed = async (req) => {
      sent.push(req);
      return "email_1";
    };
    const tick = () =>
      runMonitorSlaSealTick({
        now,
        policyIds: [policy.id],
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
          { id: m.id, name: "Checkout API", uptime: 99_000, target: 99_500 },
        ],
        url: `https://app.test/sla-policies/monitors/${policy.id}`,
      },
    ]);

    await tick();
    expect(sent).toHaveLength(1);
  });
});
