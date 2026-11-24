import { eq } from "@openstatus/db";
import { monitor, monitorHeartbeatState } from "@openstatus/db/src/schema";
import { createMonitor } from "@openstatus/db/src/test/factories";
import { beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  makeApiKeyCtx,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { DrizzleTx, ServiceContext } from "../../context";
import { ForbiddenError, NotFoundError } from "../../errors";
import { listHeartbeatStates } from "../heartbeat";
import { getMonitorRow, listMonitorRows, parseMonitorRow } from "../list";

let teamCtx: ServiceContext;
let otherCtx: ServiceContext;

beforeAll(async () => {
  teamCtx = makeUserCtx((await createWorkspaceFixture("team")).workspace, {
    userId: 1,
  });
  otherCtx = makeUserCtx((await createWorkspaceFixture("team")).workspace, {
    userId: 2,
  });
});

const keyCtx = (
  tx: DrizzleTx,
  scopes: ["monitors:read"] | ["pages:write"],
) => ({
  ...makeApiKeyCtx(teamCtx.workspace, { keyId: "k", scopes }),
  db: tx,
});

describe("getMonitorRow", () => {
  test("returns the raw row in the caller's workspace", async () => {
    await withTestTransaction(async (tx) => {
      const m = await createMonitor(teamCtx.workspace.id, { name: "API" }, tx);
      const row = await getMonitorRow({
        ctx: { ...teamCtx, db: tx },
        input: { id: m.id },
      });
      expect(row).toMatchObject({ id: m.id, name: "API" });
      expect(typeof row.regions).toBe("string");
    });
  });

  test("a foreign or soft-deleted monitor is NotFound", async () => {
    await withTestTransaction(async (tx) => {
      const foreign = await createMonitor(otherCtx.workspace.id, {}, tx);
      const deleted = await createMonitor(
        teamCtx.workspace.id,
        { deletedAt: new Date() },
        tx,
      );
      for (const id of [foreign.id, deleted.id]) {
        await expect(
          getMonitorRow({ ctx: { ...teamCtx, db: tx }, input: { id } }),
        ).rejects.toBeInstanceOf(NotFoundError);
      }
    });
  });

  test("needs monitors:read", async () => {
    await withTestTransaction(async (tx) => {
      const m = await createMonitor(teamCtx.workspace.id, {}, tx);
      await expect(
        getMonitorRow({
          ctx: keyCtx(tx, ["pages:write"]),
          input: { id: m.id },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});

describe("parseMonitorRow", () => {
  test("parses a stored row and answers null for one that no longer matches", async () => {
    await withTestTransaction(async (tx) => {
      const m = await createMonitor(teamCtx.workspace.id, {}, tx);
      const parsed = parseMonitorRow(m);
      expect(parsed?.id).toBe(m.id);
      expect(Array.isArray(parsed?.regions)).toBe(true);
      expect(parseMonitorRow({ ...m, periodicity: "13s" })).toBeNull();
    });
  });
});

describe("listMonitorRows", () => {
  test("pages through the workspace's live monitors in id order", async () => {
    await withTestTransaction(async (tx) => {
      const ws = teamCtx.workspace.id;
      const ids = [];
      for (let i = 0; i < 3; i++)
        ids.push((await createMonitor(ws, {}, tx)).id);
      await createMonitor(ws, { deletedAt: new Date() }, tx);
      await createMonitor(otherCtx.workspace.id, {}, tx);

      const ctx = { ...teamCtx, db: tx };
      const all = await listMonitorRows({
        ctx,
        input: { limit: 100, offset: 0 },
      });
      const mine = all.monitors
        .map((m) => m.id)
        .filter((id) => ids.includes(id));
      expect(mine).toEqual([...ids].sort((a, b) => a - b));
      expect(all.monitors.every((m) => m.deletedAt == null)).toBe(true);

      const page = await listMonitorRows({
        ctx,
        input: { limit: 1, offset: 1 },
      });
      expect(page.monitors).toHaveLength(1);
      expect(page.monitors[0]?.id).toBe(all.monitors[1]?.id);
      expect(page.totalSize).toBe(all.totalSize);
    });
  });

  test("skips rows that no longer parse but still counts them", async () => {
    await withTestTransaction(async (tx) => {
      const ws = teamCtx.workspace.id;
      const broken = await createMonitor(ws, {}, tx);
      await tx
        .update(monitor)
        // safe: bypasses the enum to simulate a legacy row
        .set({ periodicity: "13s" as never })
        .where(eq(monitor.id, broken.id));
      const ctx = { ...teamCtx, db: tx };
      const result = await listMonitorRows({
        ctx,
        input: { limit: 100, offset: 0 },
      });
      expect(result.monitors.map((m) => m.id)).not.toContain(broken.id);
      expect(result.totalSize).toBe(result.monitors.length + 1);
    });
  });

  test("rejects a non-positive limit or a negative offset", async () => {
    for (const input of [
      { limit: 0, offset: 0 },
      { limit: 10, offset: -1 },
    ]) {
      await expect(listMonitorRows({ ctx: teamCtx, input })).rejects.toThrow();
    }
  });

  test("needs monitors:read", async () => {
    await withTestTransaction(async (tx) => {
      await expect(
        listMonitorRows({
          ctx: keyCtx(tx, ["pages:write"]),
          input: { limit: 10, offset: 0 },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});

describe("listHeartbeatStates", () => {
  test("returns pinged monitors of the workspace only", async () => {
    await withTestTransaction(async (tx) => {
      const ws = teamCtx.workspace.id;
      const pinged = await createMonitor(ws, { jobType: "heartbeat" }, tx);
      const never = await createMonitor(ws, { jobType: "heartbeat" }, tx);
      const foreign = await createMonitor(
        otherCtx.workspace.id,
        { jobType: "heartbeat" },
        tx,
      );
      const at = new Date("2026-01-01T00:00:00Z");
      const due = new Date("2026-01-01T00:05:00Z");
      await tx.insert(monitorHeartbeatState).values([
        {
          monitorId: pinged.id,
          lastPingAt: at,
          lastPingKind: "fail",
          nextDueAt: due,
        },
        { monitorId: never.id },
        { monitorId: foreign.id, lastPingAt: at },
      ]);

      const states = await listHeartbeatStates({
        ctx: { ...teamCtx, db: tx },
        input: { monitorIds: [pinged.id, never.id, foreign.id] },
      });
      expect([...states.keys()]).toEqual([pinged.id]);
      expect(states.get(pinged.id)).toEqual({
        at,
        kind: "fail",
        nextDueAt: due,
      });
    });
  });

  test("skips soft-deleted and non-heartbeat monitors", async () => {
    await withTestTransaction(async (tx) => {
      const ws = teamCtx.workspace.id;
      const deleted = await createMonitor(
        ws,
        { jobType: "heartbeat", deletedAt: new Date() },
        tx,
      );
      const http = await createMonitor(ws, { jobType: "http" }, tx);
      const at = new Date("2026-01-01T00:00:00Z");
      await tx.insert(monitorHeartbeatState).values([
        { monitorId: deleted.id, lastPingAt: at },
        { monitorId: http.id, lastPingAt: at },
      ]);
      const states = await listHeartbeatStates({
        ctx: { ...teamCtx, db: tx },
        input: { monitorIds: [deleted.id, http.id] },
      });
      expect(states.size).toBe(0);
    });
  });

  test("an empty id list needs no query", async () => {
    const states = await listHeartbeatStates({
      ctx: teamCtx,
      input: { monitorIds: [] },
    });
    expect(states.size).toBe(0);
  });
});
