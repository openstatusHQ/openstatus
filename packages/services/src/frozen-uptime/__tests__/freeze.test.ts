import { eq } from "@openstatus/db";
import {
  frozenMonitorUptime,
  monitor,
  workspace,
} from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import { beforeAll, describe, test } from "@std/testing/bdd";

import { SEEDED_WORKSPACE_TEAM_ID } from "../../../test/fixtures";
import {
  loadSeededWorkspace,
  makeApiKeyCtx,
  makeSystemCtx,
  readAuditLog,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { ForbiddenError, NotFoundError } from "../../errors";
import { freezeMonitorMonth } from "../freeze";
import type { FreezeMonitorMonthInput } from "../schemas";

let systemCtx: ServiceContext;
let readOnlyCtx: ServiceContext;

beforeAll(async () => {
  const team = await loadSeededWorkspace(SEEDED_WORKSPACE_TEAM_ID);
  systemCtx = makeSystemCtx(team, { job: "uptime-freeze" });
  readOnlyCtx = makeApiKeyCtx(team, {
    keyId: "k",
    userId: 1,
    scopes: ["read"],
  });
});

async function insertTestMonitor(tx: NonNullable<ServiceContext["db"]>) {
  return tx
    .insert(monitor)
    .values({
      workspaceId: SEEDED_WORKSPACE_TEAM_ID,
      active: true,
      url: "https://example.com",
      name: "svc-frozen-uptime-monitor",
      method: "GET",
      periodicity: "10m",
      regions: "ams",
      jobType: "http",
    })
    .returning()
    .get();
}

function makeInput(
  monitorId: number,
  overrides: Partial<FreezeMonitorMonthInput> = {},
): FreezeMonitorMonthInput {
  return {
    monitorId,
    month: "2026-06-01",
    days: [{ day: "2026-06-01", ok: 42, degraded: 0, error: 1 }],
    ...overrides,
  };
}

describe("freezeMonitorMonth", () => {
  test("inserts a frozen month — and emits NO audit row (deliberate exception)", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...systemCtx, db: tx };
      const testMonitor = await insertTestMonitor(tx);
      const input = makeInput(testMonitor.id);

      const row = await freezeMonitorMonth({ ctx, input });

      expect(row).not.toBeNull();
      expect(row?.workspaceId).toBe(SEEDED_WORKSPACE_TEAM_ID);
      expect(row?.month).toBe("2026-06-01");
      expect(row?.days).toEqual(input.days);

      const persisted = await tx
        .select()
        .from(frozenMonitorUptime)
        .where(eq(frozenMonitorUptime.monitorId, input.monitorId))
        .all();
      expect(persisted.length).toBe(1);

      const auditRows = await readAuditLog({
        workspaceId: SEEDED_WORKSPACE_TEAM_ID,
        entityType: "frozen_monitor_uptime",
        db: tx,
      });
      expect(auditRows.length).toBe(0);
    });
  });

  test("re-run on same (monitorId, month) returns null and writes nothing", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...systemCtx, db: tx };
      const testMonitor = await insertTestMonitor(tx);
      const input = makeInput(testMonitor.id);

      const first = await freezeMonitorMonth({ ctx, input });
      expect(first).not.toBeNull();

      // same key, different payload: the frozen month must stay untouched
      const second = await freezeMonitorMonth({
        ctx,
        input: {
          ...input,
          days: [{ day: "2026-06-01", ok: 0, degraded: 0, error: 0 }],
        },
      });
      expect(second).toBeNull();

      const persisted = await tx
        .select()
        .from(frozenMonitorUptime)
        .where(eq(frozenMonitorUptime.monitorId, input.monitorId))
        .all();
      expect(persisted.length).toBe(1);
      expect(persisted[0].days[0].ok).toBe(42);

      const auditRows = await readAuditLog({
        workspaceId: SEEDED_WORKSPACE_TEAM_ID,
        entityType: "frozen_monitor_uptime",
        db: tx,
      });
      expect(auditRows.length).toBe(0);
    });
  });

  test("same monitor, different month inserts a second row", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...systemCtx, db: tx };
      const testMonitor = await insertTestMonitor(tx);
      const input = makeInput(testMonitor.id);

      const june = await freezeMonitorMonth({ ctx, input });
      const july = await freezeMonitorMonth({
        ctx,
        input: {
          ...input,
          month: "2026-07-01",
          days: [{ ...input.days[0], day: "2026-07-01" }],
        },
      });
      expect(june).not.toBeNull();
      expect(july).not.toBeNull();

      const persisted = await tx
        .select()
        .from(frozenMonitorUptime)
        .where(eq(frozenMonitorUptime.monitorId, input.monitorId))
        .all();
      expect(persisted.length).toBe(2);
    });
  });

  test("rejects a monitor from another workspace", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...systemCtx, db: tx };
      const foreignWorkspace = await tx
        .insert(workspace)
        .values({ slug: "svc-frozen-uptime-foreign-ws" })
        .returning()
        .get();
      const foreignMonitor = await tx
        .insert(monitor)
        .values({
          workspaceId: foreignWorkspace.id,
          active: true,
          url: "https://example.com",
          name: "svc-frozen-uptime-foreign-monitor",
          method: "GET",
          periodicity: "10m",
          regions: "ams",
          jobType: "http",
        })
        .returning()
        .get();

      await expect(
        freezeMonitorMonth({ ctx, input: makeInput(foreignMonitor.id) }),
      ).rejects.toThrow(NotFoundError);

      const persisted = await tx
        .select()
        .from(frozenMonitorUptime)
        .where(eq(frozenMonitorUptime.monitorId, foreignMonitor.id))
        .all();
      expect(persisted.length).toBe(0);
    });
  });

  test("rejects read-only actor", async () => {
    // requireScope fires before any DB lookup, so fake ids are fine
    await expect(
      freezeMonitorMonth({ ctx: readOnlyCtx, input: makeInput(1) }),
    ).rejects.toThrow(ForbiddenError);
  });
});
