import { db, eq } from "@openstatus/db";
import {
  monitor,
  notificationDeadLetter,
  notificationOutbox,
  notificationTrigger,
} from "@openstatus/db/src/schema";
import {
  createMonitor,
  createNotification,
} from "@openstatus/db/src/test/factories";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import {
  type WorkspaceFixture,
  createWorkspaceFixture,
} from "../../../test/helpers";
import {
  claimOutboxRows,
  deadLetterOutboxRows,
  listExpiredOutboxRows,
  releaseWorkerOutboxClaims,
  rescheduleOutboxRows,
  settleDeliveredOutboxRows,
} from "../index.ts";

// Committed rows: the outbox writes run as db.batch, which a test transaction
// cannot. Every claim is scoped to this suite's monitor.
let fixture: WorkspaceFixture;
let monitorId: number;
let notificationId: number;
let otherNotificationId: number;

beforeAll(async () => {
  fixture = await createWorkspaceFixture();
  monitorId = (await createMonitor(fixture.workspace.id)).id;
  notificationId = (await createNotification(fixture.workspace.id)).id;
  otherNotificationId = (await createNotification(fixture.workspace.id)).id;
});

afterEach(async () => {
  await db
    .delete(notificationOutbox)
    .where(eq(notificationOutbox.monitorId, monitorId));
  await db
    .delete(notificationDeadLetter)
    .where(eq(notificationDeadLetter.monitorId, monitorId));
  await db
    .delete(notificationTrigger)
    .where(eq(notificationTrigger.monitorId, monitorId));
});

afterAll(async () => {
  await db.delete(monitor).where(eq(monitor.workspaceId, fixture.workspace.id));
});

async function insertRow(
  overrides: {
    notificationId?: number;
    cronTimestamp?: number;
    deadlineOffsetSeconds?: number;
  } = {},
) {
  const now = Math.floor(Date.now() / 1000);
  const cronTimestamp = overrides.cronTimestamp ?? Date.now();
  const target = overrides.notificationId ?? notificationId;
  const [row] = await db
    .insert(notificationOutbox)
    .values({
      dedupKey: `${cronTimestamp}:${monitorId}:services-test:${target}`,
      monitorId,
      workspaceId: fixture.workspace.id,
      notificationId: target,
      provider: "email",
      eventType: "alert",
      fromStatus: "active",
      toStatus: "error",
      cronTimestamp,
      payload: { regions: ["ams"] },
      nextAttemptAt: now,
      deadlineAt: now + (overrides.deadlineOffsetSeconds ?? 300),
      createdAt: now,
    })
    .returning();
  if (!row) throw new Error("outbox insert returned no row");
  return row;
}

const claim = (workerId: string, rolloutPct = 100) =>
  claimOutboxRows({
    workerId,
    limit: 20,
    rolloutPct,
    leaseSeconds: 30,
    monitorIds: [monitorId],
  });

describe("claimOutboxRows", () => {
  test("claims only the oldest pending row per monitor and notification", async () => {
    const first = await insertRow({ cronTimestamp: 1000 });
    await insertRow({ cronTimestamp: 2000 });
    const other = await insertRow({
      notificationId: otherNotificationId,
      cronTimestamp: 1000,
    });

    const claimed = await claim("worker-a");
    expect(claimed.map((row) => row.id).sort()).toEqual(
      [first.id, other.id].sort(),
    );
    expect(claimed.every((row) => row.attempts === 1)).toBe(true);
    expect(claimed.every((row) => row.lockedBy === "worker-a")).toBe(true);

    // leased rows are not claimable by another worker
    expect(await claim("worker-b")).toEqual([]);
  });

  test("a rollout below the monitor's bucket claims nothing", async () => {
    await insertRow();
    expect(await claim("worker-a", monitorId % 100)).toEqual([]);
    expect(await claim("worker-a", 100)).toHaveLength(1);
  });

  test("a rescheduled row waits for its next attempt", async () => {
    const row = await insertRow();
    await claim("worker-a");
    await rescheduleOutboxRows([
      {
        id: row.id,
        error: "x".repeat(3000),
        nextAttemptAt: Math.floor(Date.now() / 1000) + 600,
      },
    ]);
    expect(await claim("worker-a")).toEqual([]);

    const stored = await db
      .select()
      .from(notificationOutbox)
      .where(eq(notificationOutbox.id, row.id))
      .get();
    expect(stored?.lockedBy).toBeNull();
    expect(stored?.lastError).toHaveLength(2000);
  });

  test("shutdown release keeps the leases of rows still sending", async () => {
    const sending = await insertRow({ cronTimestamp: 1000 });
    const idle = await insertRow({
      notificationId: otherNotificationId,
      cronTimestamp: 1000,
    });
    await claim("worker-a");

    await releaseWorkerOutboxClaims({
      workerId: "worker-a",
      exceptIds: [sending.id],
    });

    const rows = await db
      .select()
      .from(notificationOutbox)
      .where(eq(notificationOutbox.monitorId, monitorId))
      .all();
    const lockOf = (id: number) => rows.find((r) => r.id === id)?.lockedBy;
    expect(lockOf(sending.id)).toBe("worker-a");
    expect(lockOf(idle.id)).toBeNull();
  });
});

describe("settling and dead-lettering", () => {
  test("a delivered row is settled and its trigger written", async () => {
    const row = await insertRow();
    await settleDeliveredOutboxRows([row]);

    const stored = await db
      .select()
      .from(notificationOutbox)
      .where(eq(notificationOutbox.id, row.id))
      .get();
    expect(stored?.deliveryStatus).toBe("settled");
    expect(stored?.outcome).toBe("delivered");

    const triggers = await db
      .select()
      .from(notificationTrigger)
      .where(eq(notificationTrigger.monitorId, monitorId))
      .all();
    expect(triggers).toHaveLength(1);
    expect(triggers[0]?.cronTimestamp).toBe(row.cronTimestamp);
  });

  test("a dead letter moves the row out of the outbox", async () => {
    const row = await insertRow();
    await deadLetterOutboxRows([{ row, error: "boom" }]);

    const outbox = await db
      .select()
      .from(notificationOutbox)
      .where(eq(notificationOutbox.id, row.id))
      .all();
    expect(outbox).toHaveLength(0);

    const dead = await db
      .select()
      .from(notificationDeadLetter)
      .where(eq(notificationDeadLetter.outboxId, row.id))
      .all();
    expect(dead).toHaveLength(1);
    expect(dead[0]?.finalError).toBe("boom");
  });

  test("lists pending rows whose deadline passed before the cutoff", async () => {
    const expired = await insertRow({ deadlineOffsetSeconds: -7200 });
    await insertRow({
      notificationId: otherNotificationId,
      deadlineOffsetSeconds: 300,
    });

    const rows = await listExpiredOutboxRows({
      before: Math.floor(Date.now() / 1000) - 3600,
      limit: 200,
    });
    const ours = rows.filter((row) => row.monitorId === monitorId);
    expect(ours.map((row) => row.id)).toEqual([expired.id]);
  });
});
