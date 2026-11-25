import { db, eq, inArray } from "@openstatus/db";
import {
  monitor,
  notification,
  notificationTrigger,
} from "@openstatus/db/src/schema";
import {
  createMonitor,
  createNotification,
} from "@openstatus/db/src/test/factories";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import {
  type WorkspaceFixture,
  createWorkspaceFixture,
} from "../../../test/helpers";
import { loadSmsQuotaBlocked } from "../index.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

// Committed rows: the quota reads in one db.batch, which a test transaction cannot run.
let team: WorkspaceFixture;
let free: WorkspaceFixture;
let notificationIds: number[] = [];

beforeAll(async () => {
  team = await createWorkspaceFixture("team", {
    limits: JSON.stringify({ "sms-limit": 2 }),
  });
  free = await createWorkspaceFixture("free");
});

afterAll(async () => {
  if (notificationIds.length > 0) {
    await db
      .delete(notificationTrigger)
      .where(inArray(notificationTrigger.notificationId, notificationIds));
    await db
      .delete(notification)
      .where(inArray(notification.id, notificationIds));
  }
  for (const { workspace } of [team, free]) {
    await db.delete(monitor).where(eq(monitor.workspaceId, workspace.id));
  }
});

async function recordSends(workspaceId: number, cronTimestamps: number[]) {
  const m = await createMonitor(workspaceId);
  const n = await createNotification(workspaceId, {
    provider: "sms",
    data: JSON.stringify({ sms: "+10000000000" }),
  });
  notificationIds.push(n.id);
  if (cronTimestamps.length === 0) return;
  await db.insert(notificationTrigger).values(
    cronTimestamps.map((cronTimestamp) => ({
      monitorId: m.id,
      notificationId: n.id,
      cronTimestamp,
    })),
  );
}

describe("loadSmsQuotaBlocked", () => {
  test("no workspaces asked about returns an empty map", async () => {
    expect((await loadSmsQuotaBlocked({ workspaceIds: [] })).size).toBe(0);
  });

  test("counts sends of the last 30 days in milliseconds against the limit", async () => {
    const now = Date.now();
    // two recent sends: at the limit, not over it; the old ones fall outside the window
    await recordSends(team.workspace.id, [
      now - DAY_MS,
      now - 2 * DAY_MS,
      now - 31 * DAY_MS,
      now - 40 * DAY_MS,
    ]);
    await recordSends(free.workspace.id, [now]);

    const blocked = await loadSmsQuotaBlocked({
      workspaceIds: [team.workspace.id, free.workspace.id],
    });
    expect(blocked.get(team.workspace.id)).toBe(false);
    expect(blocked.get(free.workspace.id)).toBe(true);

    await recordSends(team.workspace.id, [now]);
    const after = await loadSmsQuotaBlocked({
      workspaceIds: [team.workspace.id],
    });
    expect(after.get(team.workspace.id)).toBe(true);
  });
});
