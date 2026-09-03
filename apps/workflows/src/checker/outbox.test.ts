import { and, count, db, eq } from "@openstatus/db";
import type { NotificationOutboxPayload } from "@openstatus/db/src/schema";
import {
  notificationOutbox,
  monitor,
  notificationDeadLetter,
  notificationTrigger,
} from "@openstatus/db/src/schema";
import {
  createMonitor,
  createNotification,
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
  type Stub,
  stub,
  test,
} from "@openstatus/test-utils";

import { checkerAudit } from "../utils/audit-log";
import { drainOutbox, shutdownOutbox, sweepExpiredOutbox } from "./outbox";
import { providerToFunction } from "./utils";

// Deno has no module mocking; stub the singleton the drainer resolves at call
// time, as alerting.test.ts does.
// biome-ignore lint/suspicious/noExplicitAny: heterogeneous provider stubs
type AnyStub = Stub<any>;
let stubs: AnyStub[] = [];

let workspaceId: number;
let monitorId: number;
let notificationId: number;

const PAYLOAD: NotificationOutboxPayload = { regions: ["ams"] };

beforeAll(async () => {
  const { workspace } = await createTestWorkspace();
  workspaceId = workspace.id;
  const monitorRow = await createMonitor(workspaceId, { regions: "ams" });
  monitorId = monitorRow.id;
  const notif = await createNotification(workspaceId, { provider: "email" });
  notificationId = notif.id;
  await linkNotificationToMonitor(notificationId, monitorId);
});

afterAll(async () => {
  await db.delete(monitor).where(eq(monitor.workspaceId, workspaceId)).run();
});

beforeEach(() => {
  stubs = [];
  stubs.push(
    stub(checkerAudit, "publishAuditLog", () => Promise.resolve()) as AnyStub,
  );
});

afterEach(async () => {
  for (const s of stubs) s.restore();
  stubs = [];
  await db
    .delete(notificationOutbox)
    .where(eq(notificationOutbox.monitorId, monitorId))
    .run();
  await db
    .delete(notificationDeadLetter)
    .where(eq(notificationDeadLetter.monitorId, monitorId))
    .run();
  await db
    .delete(notificationTrigger)
    .where(eq(notificationTrigger.monitorId, monitorId))
    .run();
});

async function insertOutboxRow(overrides: {
  cronTimestamp: number;
  eventType?: "alert" | "recovery";
  deadlineOffsetSeconds?: number;
  attempts?: number;
  lockedBy?: string;
  lockedUntilOffsetSeconds?: number;
}) {
  const now = Math.floor(Date.now() / 1000);
  const [row] = await db
    .insert(notificationOutbox)
    .values({
      dedupKey: `${overrides.cronTimestamp}:${monitorId}:test:${notificationId}`,
      monitorId,
      workspaceId,
      notificationId,
      provider: "email",
      eventType: overrides.eventType ?? "alert",
      fromStatus: "active",
      toStatus: "error",
      cronTimestamp: overrides.cronTimestamp,
      incidentId: null,
      payload: PAYLOAD,
      attempts: overrides.attempts ?? 0,
      lockedBy: overrides.lockedBy ?? null,
      lockedUntil:
        overrides.lockedUntilOffsetSeconds === undefined
          ? null
          : now + overrides.lockedUntilOffsetSeconds,
      nextAttemptAt: now,
      deadlineAt: now + (overrides.deadlineOffsetSeconds ?? 300),
      createdAt: now,
    })
    .returning();
  if (!row) throw new Error("outbox insert returned no row");
  return row;
}

describe("drainOutbox", () => {
  test("delivers a row, marks it done and records the send", async () => {
    stubs.push(
      stub(providerToFunction.email, "sendAlert", () => Promise.resolve()),
    );
    await insertOutboxRow({ cronTimestamp: Date.now() });

    const summary = await drainOutbox({
      timeoutMs: 500,
      rolloutPct: 100,
      monitorIds: [monitorId],
    });

    expect(summary.delivered).toBe(1);
    expect(summary.dead).toBe(0);

    const rows = await db
      .select()
      .from(notificationOutbox)
      .where(eq(notificationOutbox.monitorId, monitorId))
      .all();
    expect(rows[0]?.deliveryStatus).toBe("settled");
    expect(rows[0]?.deliveredAt).not.toBe(null);
    expect(rows[0]?.lockedUntil).toBe(null);

    const triggers = await db
      .select({ total: count() })
      .from(notificationTrigger)
      .where(eq(notificationTrigger.monitorId, monitorId))
      .all();
    expect(triggers[0]?.total).toBe(1);
  });

  test("dead-letters a row past its deadline and frees the channel", async () => {
    stubs.push(
      stub(providerToFunction.email, "sendAlert", () =>
        Promise.reject(new Error("provider down")),
      ),
    );
    await insertOutboxRow({
      cronTimestamp: Date.now(),
      deadlineOffsetSeconds: 1,
    });

    const summary = await drainOutbox({
      timeoutMs: 500,
      rolloutPct: 100,
      monitorIds: [monitorId],
    });

    expect(summary.dead).toBe(1);

    const remaining = await db
      .select({ total: count() })
      .from(notificationOutbox)
      .where(eq(notificationOutbox.monitorId, monitorId))
      .all();
    expect(remaining[0]?.total).toBe(0);

    const dead = await db
      .select()
      .from(notificationDeadLetter)
      .where(eq(notificationDeadLetter.monitorId, monitorId))
      .all();
    expect(dead.length).toBe(1);
    expect(dead[0]?.finalError).toContain("provider down");
  });

  test("a hanging provider is bounded by the timeout", async () => {
    stubs.push(
      stub(
        providerToFunction.email,
        "sendAlert",
        () => new Promise<void>(() => {}),
      ),
    );
    await insertOutboxRow({
      cronTimestamp: Date.now(),
      deadlineOffsetSeconds: 1,
    });

    const started = Date.now();
    const summary = await drainOutbox({
      timeoutMs: 100,
      rolloutPct: 100,
      monitorIds: [monitorId],
    });

    expect(summary.dead).toBe(1);
    expect(Date.now() - started).toBeLessThan(5000);
  });

  test("claims only the oldest pending row per channel", async () => {
    stubs.push(
      stub(providerToFunction.email, "sendAlert", () => Promise.resolve()),
    );
    stubs.push(
      stub(providerToFunction.email, "sendRecovery", () => Promise.resolve()),
    );

    const base = Date.now();
    const first = await insertOutboxRow({
      cronTimestamp: base,
      eventType: "alert",
    });
    await insertOutboxRow({
      cronTimestamp: base + 1000,
      eventType: "recovery",
    });

    const summary = await drainOutbox({
      timeoutMs: 500,
      rolloutPct: 100,
      monitorIds: [monitorId],
    });
    expect(summary.claimed).toBe(1);

    const done = await db
      .select({ id: notificationOutbox.id })
      .from(notificationOutbox)
      .where(
        and(
          eq(notificationOutbox.monitorId, monitorId),
          eq(notificationOutbox.deliveryStatus, "settled"),
        ),
      )
      .all();
    expect(done.length).toBe(1);
    expect(done[0]?.id).toBe(first.id);

    const second = await drainOutbox({
      timeoutMs: 500,
      rolloutPct: 100,
      monitorIds: [monitorId],
    });
    expect(second.claimed).toBe(1);
  });

  test("an sms row over quota is recorded, not delivered", async () => {
    stubs.push(
      stub(providerToFunction.sms, "sendAlert", () => Promise.resolve()),
    );

    const { workspace: smsWorkspace } = await createTestWorkspace({
      plan: "free",
    });
    const smsMonitor = await createMonitor(smsWorkspace.id, {
      regions: "ams",
    });
    const smsNotification = await createNotification(smsWorkspace.id, {
      provider: "sms",
      data: JSON.stringify({ sms: "+10000000000" }),
    });
    await linkNotificationToMonitor(smsNotification.id, smsMonitor.id);

    // free plan allows zero SMS, so a single recorded send is already over.
    await db
      .insert(notificationTrigger)
      .values({
        monitorId: smsMonitor.id,
        notificationId: smsNotification.id,
        cronTimestamp: Date.now(),
      })
      .run();

    const now = Math.floor(Date.now() / 1000);
    await db
      .insert(notificationOutbox)
      .values({
        dedupKey: `sms:${smsMonitor.id}:${smsNotification.id}`,
        monitorId: smsMonitor.id,
        workspaceId: smsWorkspace.id,
        notificationId: smsNotification.id,
        provider: "sms",
        eventType: "alert",
        fromStatus: "active",
        toStatus: "error",
        cronTimestamp: Date.now(),
        payload: PAYLOAD,
        nextAttemptAt: now,
        deadlineAt: now + 300,
        createdAt: now,
      })
      .run();

    const summary = await drainOutbox({
      timeoutMs: 500,
      rolloutPct: 100,
      monitorIds: [smsMonitor.id],
    });
    expect(summary.skipped).toBe(1);

    const rows = await db
      .select()
      .from(notificationOutbox)
      .where(eq(notificationOutbox.notificationId, smsNotification.id))
      .all();
    expect(rows[0]?.deliveryStatus).toBe("settled");
    expect(rows[0]?.deliveredAt).toBe(null);
    expect(rows[0]?.lastError).toBe("sms-quota-exceeded");

    await db.delete(monitor).where(eq(monitor.id, smsMonitor.id)).run();
  });
});

describe("retry", () => {
  test("a failed send is handed back with its backoff recorded", async () => {
    stubs.push(
      stub(providerToFunction.email, "sendAlert", () =>
        Promise.reject(new Error("provider down")),
      ),
    );
    await insertOutboxRow({ cronTimestamp: Date.now() });

    const summary = await drainOutbox({
      timeoutMs: 500,
      rolloutPct: 100,
      monitorIds: [monitorId],
    });

    expect(summary.retried).toBe(1);
    expect(summary.dead).toBe(0);
    expect(summary.nextRetryMs).not.toBe(null);

    const now = Math.floor(Date.now() / 1000);
    const rows = await db
      .select()
      .from(notificationOutbox)
      .where(eq(notificationOutbox.monitorId, monitorId))
      .all();
    expect(rows[0]?.deliveryStatus).toBe("pending");
    expect(rows[0]?.attempts).toBe(1);
    expect(rows[0]?.lockedBy).toBe(null);
    expect(rows[0]?.lockedUntil).toBe(null);
    expect(rows[0]?.lastError).toContain("provider down");
    expect(rows[0]?.nextAttemptAt).toBeGreaterThan(now);

    // The backoff is the claim predicate, so nothing is claimable until it ends.
    const again = await drainOutbox({
      timeoutMs: 500,
      rolloutPct: 100,
      monitorIds: [monitorId],
    });
    expect(again.claimed).toBe(0);
  });

  test("a lapsed lease lets the other machine take the row over", async () => {
    stubs.push(
      stub(providerToFunction.email, "sendAlert", () => Promise.resolve()),
    );
    // A worker that died mid-attempt: still claimed, lease already expired.
    await insertOutboxRow({
      cronTimestamp: Date.now(),
      attempts: 1,
      lockedBy: "dead-worker",
      lockedUntilOffsetSeconds: -1,
    });

    const summary = await drainOutbox({
      timeoutMs: 500,
      rolloutPct: 100,
      monitorIds: [monitorId],
    });

    expect(summary.delivered).toBe(1);

    const rows = await db
      .select()
      .from(notificationOutbox)
      .where(eq(notificationOutbox.monitorId, monitorId))
      .all();
    expect(rows[0]?.deliveryStatus).toBe("settled");
    expect(rows[0]?.attempts).toBe(2);
  });

  test("a live lease is left alone", async () => {
    stubs.push(
      stub(providerToFunction.email, "sendAlert", () => Promise.resolve()),
    );
    await insertOutboxRow({
      cronTimestamp: Date.now(),
      attempts: 1,
      lockedBy: "peer-worker",
      lockedUntilOffsetSeconds: 60,
    });

    const summary = await drainOutbox({
      timeoutMs: 500,
      rolloutPct: 100,
      monitorIds: [monitorId],
    });

    expect(summary.claimed).toBe(0);

    const rows = await db
      .select()
      .from(notificationOutbox)
      .where(eq(notificationOutbox.monitorId, monitorId))
      .all();
    expect(rows[0]?.lockedBy).toBe("peer-worker");
    expect(rows[0]?.deliveryStatus).toBe("pending");
  });
});

describe("shutdownOutbox", () => {
  test("does not release a row whose send is already in flight", async () => {
    let dispatched = false;
    let release: () => void = () => {};
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    stubs.push(
      stub(providerToFunction.email, "sendAlert", () => {
        dispatched = true;
        return pending;
      }),
    );

    const row = await insertOutboxRow({ cronTimestamp: Date.now() });
    const drain = drainOutbox({
      timeoutMs: 5000,
      rolloutPct: 100,
      monitorIds: [monitorId],
    });

    while (!dispatched) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    // Grace expires while the provider call is still outstanding.
    await shutdownOutbox(50);

    const during = await db
      .select()
      .from(notificationOutbox)
      .where(eq(notificationOutbox.id, row.id))
      .all();
    expect(during[0]?.lockedBy).not.toBe(null);
    expect(during[0]?.deliveryStatus).toBe("pending");
    // The lease covers one delivery batch, not the whole message.
    expect(during[0]?.lockedUntil).toBeLessThan(during[0]?.deadlineAt ?? 0);

    release();
    await drain;

    const after = await db
      .select()
      .from(notificationOutbox)
      .where(eq(notificationOutbox.id, row.id))
      .all();
    expect(after[0]?.deliveryStatus).toBe("settled");
  });

  test("hands claimed work back instead of delivering it", async () => {
    stubs.push(
      stub(providerToFunction.email, "sendAlert", () => Promise.resolve()),
    );
    await insertOutboxRow({ cronTimestamp: Date.now() });

    await shutdownOutbox();

    const summary = await drainOutbox({
      timeoutMs: 100,
      rolloutPct: 100,
      monitorIds: [monitorId],
    });
    expect(summary.released).toBe(1);
    expect(summary.delivered).toBe(0);

    const rows = await db
      .select()
      .from(notificationOutbox)
      .where(eq(notificationOutbox.monitorId, monitorId))
      .all();
    expect(rows[0]?.deliveryStatus).toBe("pending");
    expect(rows[0]?.lockedBy).toBe(null);
    expect(rows[0]?.lockedUntil).toBe(null);
  });
});

describe("sweepExpiredOutbox", () => {
  test("never-owned rows are discarded, abandoned rows dead-letter", async () => {
    const twoHoursAgo = Math.floor(Date.now() / 1000) - 2 * 60 * 60;

    const [neverOwned] = await db
      .insert(notificationOutbox)
      .values({
        dedupKey: `expired-never:${monitorId}`,
        monitorId,
        workspaceId,
        notificationId,
        provider: "email",
        eventType: "alert",
        fromStatus: "active",
        toStatus: "error",
        cronTimestamp: Date.now(),
        payload: PAYLOAD,
        nextAttemptAt: twoHoursAgo,
        deadlineAt: twoHoursAgo,
        createdAt: twoHoursAgo,
      })
      .returning();

    await db
      .insert(notificationOutbox)
      .values({
        dedupKey: `expired-abandoned:${monitorId}`,
        monitorId,
        workspaceId,
        notificationId,
        provider: "email",
        eventType: "alert",
        fromStatus: "active",
        toStatus: "error",
        cronTimestamp: Date.now() + 1,
        payload: PAYLOAD,
        attempts: 2,
        nextAttemptAt: twoHoursAgo,
        deadlineAt: twoHoursAgo,
        createdAt: twoHoursAgo,
      })
      .run();

    await sweepExpiredOutbox();

    const remaining = await db
      .select({ total: count() })
      .from(notificationOutbox)
      .where(eq(notificationOutbox.monitorId, monitorId))
      .all();
    expect(remaining[0]?.total).toBe(0);

    const dead = await db
      .select()
      .from(notificationDeadLetter)
      .where(eq(notificationDeadLetter.monitorId, monitorId))
      .all();
    expect(dead.length).toBe(1);
    expect(dead[0]?.attempts).toBe(2);
    expect(neverOwned).not.toBe(undefined);
  });
});
