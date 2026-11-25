import { db, eq } from "@openstatus/db";
import {
  monitor,
  monitorTransition,
  notification,
  notificationOutbox,
} from "@openstatus/db/src/schema";
import {
  createMonitor,
  createNotification,
} from "@openstatus/db/src/test/factories";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import {
  type WorkspaceFixture,
  createWorkspaceFixture,
  withTestTransaction,
} from "../../../test/helpers";
import type { DB } from "../../context";
import {
  claimNotificationTrigger,
  listOutboxRowsWithoutTrigger,
  listTriggersWithoutOutboxRow,
  pruneNotificationOutbox,
} from "../index.ts";

let fixture: WorkspaceFixture;

beforeAll(async () => {
  fixture = await createWorkspaceFixture();
});

afterAll(async () => {
  const workspaceId = fixture.workspace.id;
  await db.delete(monitor).where(eq(monitor.workspaceId, workspaceId)).run();
  await db
    .delete(notification)
    .where(eq(notification.workspaceId, workspaceId))
    .run();
});

function outboxRow(args: {
  monitorId: number;
  notificationId: number;
  cronTimestamp: number;
  createdAt: number;
}) {
  return {
    ...args,
    dedupKey: `test-${crypto.randomUUID()}`,
    provider: "email" as const,
    eventType: "alert" as const,
    fromStatus: "active" as const,
    toStatus: "error" as const,
    payload: { regions: ["ams"] },
    nextAttemptAt: args.createdAt,
    deadlineAt: args.createdAt,
  };
}

async function pair(tx: DB) {
  const m = await createMonitor(fixture.workspace.id, {}, tx);
  const n = await createNotification(fixture.workspace.id, {}, tx);
  return { monitorId: m.id, notificationId: n.id };
}

describe("outbox shadow", () => {
  test("lists each side's rows that the other side lacks, since the cutoff", async () => {
    await withTestTransaction(async (tx) => {
      const since = Date.now() - 60_000;
      const now = Math.floor(Date.now() / 1000);
      const matched = await pair(tx);
      const outboxOnly = await pair(tx);
      const triggerOnly = await pair(tx);
      const stale = await pair(tx);

      await tx
        .insert(notificationOutbox)
        .values([
          outboxRow({ ...matched, cronTimestamp: since + 1, createdAt: now }),
          outboxRow({ ...outboxOnly, cronTimestamp: since, createdAt: now }),
          outboxRow({ ...stale, cronTimestamp: since - 1, createdAt: now }),
        ])
        .run();
      for (const input of [
        { ...matched, cronTimestamp: since + 1 },
        { ...triggerOnly, cronTimestamp: since + 2 },
      ]) {
        await claimNotificationTrigger({ input, db: tx });
      }

      const missingTrigger = await listOutboxRowsWithoutTrigger({
        since,
        db: tx,
      });
      const missingOutbox = await listTriggersWithoutOutboxRow({
        since,
        db: tx,
      });
      const mine = new Set(
        [matched, outboxOnly, triggerOnly, stale].map((p) => p.monitorId),
      );
      const own = <T extends { monitorId: number | null }>(rows: T[]) =>
        rows.filter((r) => r.monitorId !== null && mine.has(r.monitorId));

      expect(own(missingTrigger)).toEqual([
        { ...outboxOnly, cronTimestamp: since },
      ]);
      expect(own(missingOutbox)).toEqual([
        { ...triggerOnly, cronTimestamp: since + 2 },
      ]);
    });
  });
});

describe("pruneNotificationOutbox", () => {
  test("deletes only rows created before each cutoff", async () => {
    const p = await pair(db);
    // epoch-adjacent timestamps: no real row is this old
    await db
      .insert(notificationOutbox)
      .values([
        outboxRow({ ...p, cronTimestamp: 1, createdAt: 10 }),
        outboxRow({ ...p, cronTimestamp: 2, createdAt: 30 }),
      ])
      .run();
    const transition = {
      monitorId: p.monitorId,
      region: "ams",
      fromStatus: "active" as const,
      toStatus: "error" as const,
      quorumCount: 1,
      regionCount: 1,
      transitioned: true,
    };
    await db
      .insert(monitorTransition)
      .values([
        { ...transition, cronTimestamp: 1, createdAt: 10 },
        { ...transition, cronTimestamp: 2, createdAt: 50 },
      ])
      .run();

    const result = await pruneNotificationOutbox({
      outboxCutoff: 20,
      decisionCutoff: 40,
    });
    expect(result.outboxDeleted).toBeGreaterThanOrEqual(1);
    expect(result.decisionsDeleted).toBeGreaterThanOrEqual(1);

    const outbox = await db
      .select({ createdAt: notificationOutbox.createdAt })
      .from(notificationOutbox)
      .where(eq(notificationOutbox.monitorId, p.monitorId))
      .all();
    expect(outbox).toEqual([{ createdAt: 30 }]);
    const decisions = await db
      .select({ createdAt: monitorTransition.createdAt })
      .from(monitorTransition)
      .where(eq(monitorTransition.monitorId, p.monitorId))
      .all();
    expect(decisions).toEqual([{ createdAt: 50 }]);
  });
});
