import { db, eq, inArray } from "@openstatus/db";
import {
  monitor,
  monitorHeartbeatState,
  selectWorkspaceSchema,
  workspace,
} from "@openstatus/db/src/schema";
import { createWorkspace } from "@openstatus/db/src/test/factories";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import {
  expectAuditRow,
  makeApiKeyCtx,
  makeUserCtx,
  readAuditLog,
  withTestTransaction,
} from "../../../test/helpers";
import type { DrizzleTx, ServiceContext } from "../../context";
import {
  ForbiddenError,
  PreconditionFailedError,
  ValidationError,
} from "../../errors";
import { cloneMonitor } from "../clone";
import { createMonitor } from "../create";
import {
  getHeartbeatState,
  recordHeartbeatPing,
  regenerateHeartbeatToken,
  updateMonitorHeartbeat,
} from "../heartbeat";
import { triggerMonitorRun } from "../trigger";
import {
  bulkUpdateMonitors,
  updateMonitorConfig,
  updateMonitorGeneral,
} from "../update";

const TEST_PREFIX = "svc-heartbeat-test";
const HOUR = 3_600;
const FIVE_MIN = 300;

let ctx: ServiceContext;
let workspaceId: number;

beforeAll(async () => {
  const row = selectWorkspaceSchema.parse(await createWorkspace());
  workspaceId = row.id;
  ctx = makeUserCtx(row, { userId: 1 });
});

afterAll(async () => {
  await db
    .delete(workspace)
    .where(inArray(workspace.id, [workspaceId]))
    .catch(() => undefined);
});

function createHeartbeat(tx: DrizzleTx, overrides: { active?: boolean } = {}) {
  return createMonitor({
    ctx: { ...ctx, db: tx },
    input: {
      name: `${TEST_PREFIX}-hb`,
      jobType: "heartbeat",
      url: "https://ignored.example.com",
      method: "GET",
      headers: [],
      assertions: [],
      active: overrides.active ?? true,
      heartbeatPeriod: HOUR,
      heartbeatGrace: FIVE_MIN,
    },
  });
}

async function setLastPing(tx: DrizzleTx, monitorId: number, at: Date) {
  await tx
    .insert(monitorHeartbeatState)
    .values({ monitorId, lastPingAt: at, nextDueAt: at })
    .onConflictDoUpdate({
      target: monitorHeartbeatState.monitorId,
      set: { lastPingAt: at, nextDueAt: at },
    });
}

async function readState(tx: DrizzleTx, monitorId: number) {
  return tx
    .select()
    .from(monitorHeartbeatState)
    .where(eq(monitorHeartbeatState.monitorId, monitorId))
    .get();
}

describe("createMonitor (heartbeat)", () => {
  test("stores no url, regions or schedule and mints a token", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createHeartbeat(tx);

      expect(row.jobType).toBe("heartbeat");
      expect(row.url).toBe("");
      expect(row.regions).toEqual([]);
      expect(row.periodicity).toBe("other");
      expect(row.heartbeatPeriod).toBe(HOUR);
      expect(row.heartbeatGrace).toBe(FIVE_MIN);
      expect(row.heartbeatToken).toMatch(/^[\w-]{32}$/);

      const state = await readState(tx, row.id);
      expect(state).toBeUndefined();

      await expectAuditRow({
        workspaceId,
        action: "monitor.create",
        entityType: "monitor",
        entityId: row.id,
        db: tx,
      });
      const [audit] = await readAuditLog({
        workspaceId,
        entityType: "monitor",
        entityId: row.id,
        db: tx,
      });
      expect(JSON.stringify(audit?.after)).not.toContain(row.heartbeatToken);
    });
  });

  test("requires period and grace", async () => {
    await withTestTransaction(async (tx) => {
      await expect(
        createMonitor({
          ctx: { ...ctx, db: tx },
          input: {
            name: `${TEST_PREFIX}-missing`,
            jobType: "heartbeat",
            url: "",
            method: "GET",
            headers: [],
            assertions: [],
            active: true,
          },
        }),
      ).rejects.toThrow(/heartbeatPeriod/);
    });
  });

  test("requires grace on its own", async () => {
    await withTestTransaction(async (tx) => {
      await expect(
        createMonitor({
          ctx: { ...ctx, db: tx },
          input: {
            name: `${TEST_PREFIX}-missing-grace`,
            jobType: "heartbeat",
            url: "",
            method: "GET",
            headers: [],
            assertions: [],
            active: true,
            heartbeatPeriod: HOUR,
          },
        }),
      ).rejects.toThrow(/heartbeatGrace/);
    });
  });

  test("rejects a period below one minute", async () => {
    await withTestTransaction(async (tx) => {
      await expect(
        createMonitor({
          ctx: { ...ctx, db: tx },
          input: {
            name: `${TEST_PREFIX}-short`,
            jobType: "heartbeat",
            url: "",
            method: "GET",
            headers: [],
            assertions: [],
            active: true,
            heartbeatPeriod: 30,
            heartbeatGrace: FIVE_MIN,
          },
        }),
      ).rejects.toThrow();
    });
  });

  test("rejects read-only actor", async () => {
    const readCtx = makeApiKeyCtx(ctx.workspace, {
      keyId: "k-read",
      userId: 1,
      scopes: ["read"],
    });
    await expect(
      regenerateHeartbeatToken({ ctx: readCtx, input: { id: 1 } }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      updateMonitorHeartbeat({
        ctx: readCtx,
        input: { id: 1, heartbeatPeriod: HOUR, heartbeatGrace: FIVE_MIN },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("updateMonitorHeartbeat", () => {
  test("re-anchors the deadline on the last ping", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createHeartbeat(tx);
      const lastPing = new Date("2026-01-01T00:00:00.000Z");
      await setLastPing(tx, row.id, lastPing);

      const updated = await updateMonitorHeartbeat({
        ctx: { ...ctx, db: tx },
        input: { id: row.id, heartbeatPeriod: 2 * HOUR, heartbeatGrace: 600 },
      });

      expect(updated.heartbeatPeriod).toBe(2 * HOUR);
      const state = await readState(tx, row.id);
      expect(state?.nextDueAt?.getTime()).toBe(
        lastPing.getTime() + (2 * HOUR + 600) * 1000,
      );
    });
  });

  test("an unchanged save keeps the deadline a resume granted", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createHeartbeat(tx, { active: false });
      await setLastPing(tx, row.id, new Date("2026-01-01T00:00:00.000Z"));
      await updateMonitorConfig({
        ctx: { ...ctx, db: tx },
        input: { id: row.id, active: true },
      });
      const resumed = await readState(tx, row.id);

      await updateMonitorHeartbeat({
        ctx: { ...ctx, db: tx },
        input: { id: row.id, heartbeatPeriod: HOUR, heartbeatGrace: FIVE_MIN },
      });

      const state = await readState(tx, row.id);
      expect(state?.nextDueAt?.getTime()).toBe(resumed?.nextDueAt?.getTime());
    });
  });

  test("a config change does not recover a down heartbeat", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createHeartbeat(tx);
      const lastPing = new Date("2026-01-01T00:00:00.000Z");
      await setLastPing(tx, row.id, lastPing);
      await tx
        .update(monitor)
        .set({ status: "error" })
        .where(eq(monitor.id, row.id));

      await updateMonitorHeartbeat({
        ctx: { ...ctx, db: tx },
        input: { id: row.id, heartbeatPeriod: 2 * HOUR, heartbeatGrace: 600 },
      });

      const state = await readState(tx, row.id);
      expect(state?.nextDueAt?.getTime()).toBe(lastPing.getTime());
    });
  });

  test("keeps a never-pinged heartbeat waiting", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createHeartbeat(tx);
      await updateMonitorHeartbeat({
        ctx: { ...ctx, db: tx },
        input: { id: row.id, heartbeatPeriod: 2 * HOUR, heartbeatGrace: 600 },
      });
      expect(await readState(tx, row.id)).toBeUndefined();
    });
  });

  test("rejects a non-heartbeat monitor", async () => {
    await withTestTransaction(async (tx) => {
      const http = await createMonitor({
        ctx: { ...ctx, db: tx },
        input: {
          name: `${TEST_PREFIX}-http`,
          jobType: "http",
          url: "https://example.com",
          method: "GET",
          headers: [],
          assertions: [],
          active: false,
        },
      });
      await expect(
        updateMonitorHeartbeat({
          ctx: { ...ctx, db: tx },
          input: { id: http.id, heartbeatPeriod: HOUR, heartbeatGrace: 60 },
        }),
      ).rejects.toBeInstanceOf(ValidationError);
      await expect(
        updateMonitorConfig({
          ctx: { ...ctx, db: tx },
          input: { id: http.id, heartbeatPeriod: HOUR },
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });
});

describe("regenerateHeartbeatToken", () => {
  test("rotates the token and audits the change", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createHeartbeat(tx);
      const updated = await regenerateHeartbeatToken({
        ctx: { ...ctx, db: tx },
        input: { id: row.id },
      });

      expect(updated.heartbeatToken).not.toBe(row.heartbeatToken);
      const rows = await readAuditLog({
        workspaceId,
        entityType: "monitor",
        entityId: row.id,
        db: tx,
      });
      const update = rows.find((r) => r.action === "monitor.update");
      expect(update?.changedFields).toContain("heartbeatToken");
      expect(JSON.stringify(update)).not.toContain(updated.heartbeatToken);
    });
  });
});

describe("type switching", () => {
  test("cannot switch to or from heartbeat", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createHeartbeat(tx);
      await expect(
        updateMonitorGeneral({
          ctx: { ...ctx, db: tx },
          input: {
            id: row.id,
            name: row.name,
            jobType: "http",
            url: "https://example.com",
            method: "GET",
          },
        }),
      ).rejects.toBeInstanceOf(ValidationError);

      const http = await createMonitor({
        ctx: { ...ctx, db: tx },
        input: {
          name: `${TEST_PREFIX}-http`,
          jobType: "http",
          url: "https://example.com",
          method: "GET",
          headers: [],
          assertions: [],
          active: false,
        },
      });
      await expect(
        updateMonitorGeneral({
          ctx: { ...ctx, db: tx },
          input: {
            id: http.id,
            name: http.name,
            jobType: "heartbeat",
            url: "",
            method: "GET",
          },
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });
});

describe("resume", () => {
  test("pausing and resuming restarts the deadline from now", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createHeartbeat(tx, { active: false });
      await setLastPing(tx, row.id, new Date("2026-01-01T00:00:00.000Z"));

      const before = Date.now();
      await updateMonitorConfig({
        ctx: { ...ctx, db: tx },
        input: { id: row.id, active: true },
      });

      const state = await readState(tx, row.id);
      const expected = before + (HOUR + FIVE_MIN) * 1000;
      expect(state?.nextDueAt?.getTime()).toBeGreaterThanOrEqual(expected);
      expect(state?.nextDueAt?.getTime()).toBeLessThan(expected + 10_000);
    });
  });

  test("bulk resume restarts the deadline too", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createHeartbeat(tx, { active: false });
      await setLastPing(tx, row.id, new Date("2026-01-01T00:00:00.000Z"));

      await bulkUpdateMonitors({
        ctx: { ...ctx, db: tx },
        input: { ids: [row.id], active: true },
      });

      const state = await readState(tx, row.id);
      expect(state?.nextDueAt?.getTime()).toBeGreaterThan(Date.now());
    });
  });

  test("resuming clears a failure reported before the pause", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createHeartbeat(tx, { active: false });
      await setLastPing(tx, row.id, new Date("2026-01-01T00:00:00.000Z"));
      await tx
        .update(monitorHeartbeatState)
        .set({ lastPingKind: "fail" })
        .where(eq(monitorHeartbeatState.monitorId, row.id));

      await updateMonitorConfig({
        ctx: { ...ctx, db: tx },
        input: { id: row.id, active: true },
      });

      expect((await readState(tx, row.id))?.lastPingKind).toBe("success");
    });
  });
});

describe("cloneMonitor (heartbeat)", () => {
  test("mints a fresh token", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createHeartbeat(tx);
      const clone = await cloneMonitor({
        ctx: { ...ctx, db: tx },
        input: { id: row.id },
      });
      expect(clone.heartbeatToken).toBeTruthy();
      expect(clone.heartbeatToken).not.toBe(row.heartbeatToken);
    });
  });
});

describe("getHeartbeatState", () => {
  test("returns nulls before the first ping", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createHeartbeat(tx);
      const state = await getHeartbeatState({
        ctx: { ...ctx, db: tx },
        input: { id: row.id },
      });
      expect(state).toEqual({
        lastPingAt: null,
        lastPingKind: null,
        nextDueAt: null,
      });
    });
  });
});

describe("recordHeartbeatPing", () => {
  test("an older ping landing late does not move the deadline back", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createHeartbeat(tx);
      const token = row.heartbeatToken ?? "";
      const newer = new Date("2026-01-01T00:01:00.000Z");
      const older = new Date("2026-01-01T00:00:00.000Z");

      await recordHeartbeatPing({ token, at: newer, db: tx });
      await recordHeartbeatPing({ token, at: older, db: tx });

      const state = await readState(tx, row.id);
      expect(state?.lastPingAt?.getTime()).toBe(newer.getTime());
      expect(state?.nextDueAt?.getTime()).toBe(
        newer.getTime() + (HOUR + FIVE_MIN) * 1000,
      );
    });
  });
});

describe("triggerMonitorRun (heartbeat)", () => {
  test("is rejected", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createHeartbeat(tx);
      await expect(
        triggerMonitorRun({ ctx: { ...ctx, db: tx }, input: { id: row.id } }),
      ).rejects.toBeInstanceOf(PreconditionFailedError);
    });
  });
});

// The checker cron itself also filters on jobType; these keep the stored row
// unschedulable so no other cron can pick a heartbeat up.
describe("scheduling invariants", () => {
  test("a config patch cannot give a heartbeat a target or schedule", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createHeartbeat(tx);
      for (const patch of [
        { url: "https://example.com" },
        { periodicity: "1m" as const },
        { regions: ["ams"] },
      ]) {
        await expect(
          updateMonitorConfig({
            ctx: { ...ctx, db: tx },
            input: { id: row.id, ...patch },
          }),
        ).rejects.toBeInstanceOf(ValidationError);
      }

      const stored = await tx
        .select({
          url: monitor.url,
          periodicity: monitor.periodicity,
          regions: monitor.regions,
        })
        .from(monitor)
        .where(eq(monitor.id, row.id))
        .get();
      expect(stored).toEqual({ url: "", periodicity: "other", regions: "" });
    });
  });
});
