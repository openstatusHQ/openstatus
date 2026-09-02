import { and, count, db, eq, isNull } from "@openstatus/db";
import {
  monitorTransition,
  notificationOutbox,
  incidentTable,
  monitor,
  monitorStatusTable,
} from "@openstatus/db/src/schema";
import {
  createMonitor,
  createNotification,
  createTestWorkspace,
  linkNotificationToMonitor,
} from "@openstatus/db/src/test/factories";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
} from "@openstatus/test-utils";

import { drainOutbox } from "./outbox";
import { applyStatusTransition, isStaleCheck } from "./transition";

const REGIONS = ["ams", "arn", "atl", "bog", "bom", "bos"] as const;
const DEADLINE_SECONDS = 300;

let workspaceId: number;

beforeAll(async () => {
  const { workspace } = await createTestWorkspace();
  workspaceId = workspace.id;
});

afterAll(async () => {
  await db.delete(monitor).where(eq(monitor.workspaceId, workspaceId)).run();
});

async function makeMonitor(regionCount: number, withNotification = true) {
  const regions = REGIONS.slice(0, regionCount);
  const row = await createMonitor(workspaceId, {
    regions: regions.join(","),
  });
  if (withNotification) {
    const notif = await createNotification(workspaceId);
    await linkNotificationToMonitor(notif.id, row.id);
  }
  return { monitorId: row.id, regions };
}

async function seedRegionStatus(
  monitorId: number,
  regions: readonly string[],
  status: "active" | "error" | "degraded",
) {
  if (regions.length === 0) return;
  await db
    .insert(monitorStatusTable)
    .values(
      regions.map((region) => ({
        monitorId,
        region,
        status,
        cronTimestamp: 0,
      })),
    )
    .run();
}

function transitionInput(
  monitorId: number,
  region: string,
  cronTimestamp: number,
) {
  return {
    monitorId,
    region,
    status: "error" as const,
    cronTimestamp,
    deadlineSeconds: DEADLINE_SECONDS,
    rolloutPct: 100,
  };
}

describe("quorum", () => {
  const cases: { regions: number; affected: number }[] = [];
  for (let regions = 1; regions <= 6; regions++) {
    for (let affected = 1; affected <= regions; affected++) {
      cases.push({ regions, affected });
    }
  }

  for (const { regions, affected } of cases) {
    test(`${affected} of ${regions} regions in error`, async () => {
      const { monitorId, regions: list } = await makeMonitor(regions, false);
      await seedRegionStatus(monitorId, list.slice(0, affected - 1), "error");

      const result = await applyStatusTransition(
        transitionInput(monitorId, list[affected - 1], Date.now()),
      );

      // Matches the pre-existing `affected >= regions / 2 || regions === 1`.
      const expected = affected >= regions / 2 || regions === 1;

      expect(result.kind).toBe("evaluated");
      if (result.kind !== "evaluated") return;
      expect(result.quorumCount).toBe(affected);
      expect(result.regionCount).toBe(regions);
      expect(result.transitioned).toBe(expected);
    });
  }
});

describe("fast path", () => {
  test("an unchanged region status writes nothing and short-circuits", async () => {
    const { monitorId, regions } = await makeMonitor(1);
    const first = await applyStatusTransition(
      transitionInput(monitorId, regions[0], Date.now()),
    );
    expect(first.kind).toBe("evaluated");

    const second = await applyStatusTransition(
      transitionInput(monitorId, regions[0], Date.now() + 1),
    );
    expect(second.kind).toBe("unchanged");
  });

  test("an older cronTimestamp is rejected", async () => {
    const { monitorId, regions } = await makeMonitor(1);
    const now = Date.now();
    await applyStatusTransition(transitionInput(monitorId, regions[0], now));

    const stale = await applyStatusTransition({
      monitorId,
      region: regions[0],
      status: "active",
      cronTimestamp: now - 60_000,
      deadlineSeconds: DEADLINE_SECONDS,
      rolloutPct: 100,
    });

    expect(stale.kind).toBe("unchanged");

    const rows = await db
      .select({ status: monitorStatusTable.status })
      .from(monitorStatusTable)
      .where(
        and(
          eq(monitorStatusTable.monitorId, monitorId),
          eq(monitorStatusTable.region, regions[0]),
        ),
      )
      .all();
    expect(rows[0]?.status).toBe("error");
  });
});

describe("replay", () => {
  test("repeating the same check produces one incident and one outbox row", async () => {
    const { monitorId, regions } = await makeMonitor(1);
    const cronTimestamp = Date.now();

    for (let i = 0; i < 5; i++) {
      await applyStatusTransition(
        transitionInput(monitorId, regions[0], cronTimestamp),
      );
    }

    const incidents = await db
      .select({ total: count() })
      .from(incidentTable)
      .where(
        and(
          eq(incidentTable.monitorId, monitorId),
          isNull(incidentTable.resolvedAt),
        ),
      )
      .all();
    expect(incidents[0]?.total).toBe(1);

    const outbox = await db
      .select({ total: count() })
      .from(notificationOutbox)
      .where(eq(notificationOutbox.monitorId, monitorId))
      .all();
    expect(outbox[0]?.total).toBe(1);
  });
});

describe("decision journal", () => {
  test("records the quorum inputs and the outcome", async () => {
    const { monitorId, regions } = await makeMonitor(3);
    const cronTimestamp = Date.now();

    await applyStatusTransition(
      transitionInput(monitorId, regions[0], cronTimestamp),
    );

    const rows = await db
      .select()
      .from(monitorTransition)
      .where(eq(monitorTransition.monitorId, monitorId))
      .all();

    expect(rows.length).toBe(1);
    expect(rows[0]?.quorumCount).toBe(1);
    expect(rows[0]?.regionCount).toBe(3);
    expect(rows[0]?.transitioned).toBe(false);
    expect(rows[0]?.fromStatus).toBe("active");
    expect(rows[0]?.toStatus).toBe("error");
  });
});

describe("recovery", () => {
  test("resolves the open incident and enqueues a recovery", async () => {
    const { monitorId, regions } = await makeMonitor(1);
    const down = Date.now();
    await applyStatusTransition(transitionInput(monitorId, regions[0], down));

    const recovery = await applyStatusTransition({
      monitorId,
      region: regions[0],
      status: "active",
      cronTimestamp: down + 60_000,
      deadlineSeconds: DEADLINE_SECONDS,
      rolloutPct: 100,
    });

    expect(recovery.kind).toBe("evaluated");
    if (recovery.kind !== "evaluated") return;
    expect(recovery.transitioned).toBe(true);
    expect(recovery.outboxRows.length).toBe(1);

    const open = await db
      .select({ total: count() })
      .from(incidentTable)
      .where(
        and(
          eq(incidentTable.monitorId, monitorId),
          isNull(incidentTable.resolvedAt),
        ),
      )
      .all();
    expect(open[0]?.total).toBe(0);

    const events = await db
      .select({ eventType: notificationOutbox.eventType })
      .from(notificationOutbox)
      .where(eq(notificationOutbox.monitorId, monitorId))
      .all();
    expect(events.map((row) => row.eventType).sort()).toEqual([
      "alert",
      "recovery",
    ]);
  });
});

describe("concurrency", () => {
  test("parallel region failures produce exactly one incident", async () => {
    const { monitorId, regions } = await makeMonitor(4);
    const cronTimestamp = Date.now();

    await Promise.all(
      regions.map((region) =>
        applyStatusTransition(
          transitionInput(monitorId, region, cronTimestamp),
        ),
      ),
    );

    const incidents = await db
      .select({ total: count() })
      .from(incidentTable)
      .where(eq(incidentTable.monitorId, monitorId))
      .all();
    expect(incidents[0]?.total).toBe(1);

    const outbox = await db
      .select({ total: count() })
      .from(notificationOutbox)
      .where(eq(notificationOutbox.monitorId, monitorId))
      .all();
    expect(outbox[0]?.total).toBe(1);

    const monitorRow = await db
      .select({ status: monitor.status })
      .from(monitor)
      .where(eq(monitor.id, monitorId))
      .all();
    expect(monitorRow[0]?.status).toBe("error");
  });
});

describe("isStaleCheck", () => {
  test("accepts a fresh payload and rejects an old one", () => {
    const now = 1_000_000;
    expect(isStaleCheck(now - 1000, 600_000, now)).toBe(false);
    expect(isStaleCheck(now - 700_000, 600_000, now)).toBe(true);
  });
});

describe("degraded", () => {
  test("enqueues a degraded notification and resolves an open incident", async () => {
    const { monitorId, regions } = await makeMonitor(1);
    const down = Date.now();
    await applyStatusTransition(transitionInput(monitorId, regions[0], down));

    const degraded = await applyStatusTransition({
      monitorId,
      region: regions[0],
      status: "degraded",
      cronTimestamp: down + 60_000,
      deadlineSeconds: DEADLINE_SECONDS,
      rolloutPct: 100,
    });

    expect(degraded.kind).toBe("evaluated");
    if (degraded.kind !== "evaluated") return;
    expect(degraded.transitioned).toBe(true);
    expect(degraded.outboxRows.length).toBe(1);
    expect(degraded.incidentId).not.toBe(null);

    const events = await db
      .select({
        eventType: notificationOutbox.eventType,
        incidentId: notificationOutbox.incidentId,
      })
      .from(notificationOutbox)
      .where(eq(notificationOutbox.monitorId, monitorId))
      .all();
    expect(events.map((row) => row.eventType).sort()).toEqual([
      "alert",
      "degraded",
    ]);
    // the degraded row captured the incident before it was resolved
    for (const row of events) expect(row.incidentId).not.toBe(null);

    const open = await db
      .select({ total: count() })
      .from(incidentTable)
      .where(
        and(
          eq(incidentTable.monitorId, monitorId),
          isNull(incidentTable.resolvedAt),
        ),
      )
      .all();
    expect(open[0]?.total).toBe(0);
  });
});

describe("rollout gate", () => {
  test("a row written outside the rollout is not redelivered when the gate opens", async () => {
    const { monitorId, regions } = await makeMonitor(1);

    const result = await applyStatusTransition({
      monitorId,
      region: regions[0],
      status: "error",
      cronTimestamp: Date.now(),
      deadlineSeconds: DEADLINE_SECONDS,
      rolloutPct: 0,
    });

    expect(result.kind).toBe("evaluated");
    if (result.kind !== "evaluated") return;
    expect(result.transitioned).toBe(true);

    const rows = await db
      .select()
      .from(notificationOutbox)
      .where(eq(notificationOutbox.monitorId, monitorId))
      .all();
    expect(rows.length).toBe(1);
    expect(rows[0]?.deliveryStatus).toBe("settled");
    expect(rows[0]?.outcome).toBe("inline");

    // The inline sender already delivered this one; opening the gate must not
    // make the drainer claim it a second time.
    const summary = await drainOutbox({
      timeoutMs: 100,
      rolloutPct: 100,
      monitorIds: [monitorId],
    });
    expect(summary.claimed).toBe(0);
  });

  test("a row written inside the rollout is claimable", async () => {
    const { monitorId, regions } = await makeMonitor(1);

    await applyStatusTransition({
      monitorId,
      region: regions[0],
      status: "error",
      cronTimestamp: Date.now(),
      deadlineSeconds: DEADLINE_SECONDS,
      rolloutPct: 100,
    });

    const rows = await db
      .select()
      .from(notificationOutbox)
      .where(eq(notificationOutbox.monitorId, monitorId))
      .all();
    expect(rows[0]?.deliveryStatus).toBe("pending");
    expect(rows[0]?.outcome).toBe(null);
  });
});
