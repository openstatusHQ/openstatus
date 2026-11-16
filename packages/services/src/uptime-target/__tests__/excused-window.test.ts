import { db, eq } from "@openstatus/db";
import {
  monitor,
  monitorMaintenanceWindow,
  monitorMaintenanceWindowToMonitor,
  uptimeTargetExcusedWindow,
  uptimeTargetExcusedWindowToMonitor,
  uptimeTargetSealedMonth,
} from "@openstatus/db/src/schema";
import {
  addUserToWorkspace,
  createMonitor,
  createUser,
} from "@openstatus/db/src/test/factories";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import {
  clearAuditLog,
  createWorkspaceFixture,
  makeApiKeyCtx,
  makeUserCtx,
  readAuditLog,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import {
  ForbiddenError,
  NotFoundError,
  PreconditionFailedError,
  ValidationError,
} from "../../errors";
import { addUptimeTargetExcusedWindow } from "../add-excused-window";
import { archiveUptimeTarget } from "../archive";
import { createUptimeTarget } from "../create";
import { removeUptimeTargetExcusedWindow } from "../remove-excused-window";

const HOUR = 3_600_000;
const now = new Date(Date.UTC(2026, 10, 15, 12));
const oct = (d: number, h = 0) => new Date(Date.UTC(2026, 9, d, h));

let ownerCtx: ServiceContext;
let memberCtx: ServiceContext;
let otherCtx: ServiceContext;
let ownerId: number;
const workspaceIds: number[] = [];
let apiId: number;
let webId: number;
let outsideId: number;

beforeAll(async () => {
  const team = await createWorkspaceFixture("team");
  const other = await createWorkspaceFixture("team");
  workspaceIds.push(team.workspace.id, other.workspace.id);
  ownerId = team.userId;
  ownerCtx = makeUserCtx(team.workspace, { userId: team.userId });
  otherCtx = makeUserCtx(other.workspace, { userId: other.userId });
  const member = await createUser();
  await addUserToWorkspace(member.id, team.workspace.id, "member");
  memberCtx = makeUserCtx(team.workspace, { userId: member.id });
  apiId = (
    await createMonitor(team.workspace.id, { name: "API", regions: "fra" })
  ).id;
  webId = (
    await createMonitor(team.workspace.id, { name: "Web", regions: "fra" })
  ).id;
  outsideId = (
    await createMonitor(team.workspace.id, { name: "Docs", regions: "fra" })
  ).id;
});

afterAll(async () => {
  for (const id of workspaceIds) {
    await clearAuditLog(id);
    await db.delete(monitor).where(eq(monitor.workspaceId, id));
  }
});

type Tx = Parameters<Parameters<typeof withTestTransaction>[0]>[0];

async function policyIn(tx: Tx) {
  return createUptimeTarget({
    ctx: { ...ownerCtx, db: tx },
    input: { name: "Partner", target: 99_500, monitorIds: [apiId, webId] },
  });
}

async function sealOctober(tx: Tx, policyId: number) {
  await tx.insert(uptimeTargetSealedMonth).values({
    workspaceId: ownerCtx.workspace.id,
    uptimeTargetId: policyId,
    monitorId: apiId,
    month: "2026-10-01",
    target: 99_500,
    strict: false,
    measuredMs: 1000 * 60_000,
    downMs: 0,
    excusedMs: 0,
    unmeasuredMs: 0,
    uptime: 100_000,
    met: true,
  });
}

const window = {
  kind: "maintenance" as const,
  reason: "Database upgrade, announced Oct 30",
  from: oct(20, 22),
  to: oct(20, 23),
};

describe("addUptimeTargetExcusedWindow", () => {
  test("stores the window with who added it, audited", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const policy = await policyIn(tx);

      const row = await addUptimeTargetExcusedWindow({
        ctx,
        input: { policyId: policy.id, ...window, monitorIds: [apiId] },
        now,
      });

      expect(row).toMatchObject({
        uptimeTargetId: policy.id,
        kind: "maintenance",
        reason: "Database upgrade, announced Oct 30",
        from: oct(20, 22),
        to: oct(20, 23),
        createdBy: ownerId,
      });
      const [audit] = await readAuditLog({
        workspaceId: ctx.workspace.id,
        entityType: "uptime_target_excused_window",
        entityId: row.id,
        db: tx,
      });
      expect(audit?.action).toBe("uptime_target_excused_window.create");
    });
  });

  test("stores the monitors it excuses, members of the policy only", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const policy = await policyIn(tx);

      const row = await addUptimeTargetExcusedWindow({
        ctx,
        input: {
          policyId: policy.id,
          ...window,
          monitorIds: [webId, apiId, apiId],
        },
        now,
      });
      const both = [apiId, webId].sort((a, b) => a - b);
      expect(row.monitorIds).toEqual(both);
      const links = await tx
        .select()
        .from(uptimeTargetExcusedWindowToMonitor)
        .where(
          eq(
            uptimeTargetExcusedWindowToMonitor.uptimeTargetExcusedWindowId,
            row.id,
          ),
        )
        .all();
      expect(links.map((l) => l.monitorId).sort((a, b) => a - b)).toEqual(both);

      await expect(
        addUptimeTargetExcusedWindow({
          ctx,
          input: {
            policyId: policy.id,
            ...window,
            monitorIds: [apiId, outsideId],
          },
          now,
        }),
      ).rejects.toBeInstanceOf(ValidationError);
      await expect(
        addUptimeTargetExcusedWindow({
          ctx,
          input: { policyId: policy.id, ...window, monitorIds: [] },
          now,
        }),
      ).rejects.toThrow(/at least one monitor/);
    });
  });

  test("records the maintenance window it was prefilled from", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const policy = await policyIn(tx);
      const insertWindow = async (
        workspaceId: number,
        monitorIds: number[],
        range = { from: window.from, to: window.to },
      ) => {
        const mw = await tx
          .insert(monitorMaintenanceWindow)
          .values({
            workspaceId,
            title: "DB upgrade",
            mode: "continue",
            ...range,
          })
          .returning()
          .get();
        if (monitorIds.length > 0) {
          await tx.insert(monitorMaintenanceWindowToMonitor).values(
            monitorIds.map((monitorId) => ({
              monitorMaintenanceWindowId: mw.id,
              monitorId,
            })),
          );
        }
        return mw;
      };
      const add = (monitorMaintenanceWindowId: number) =>
        addUptimeTargetExcusedWindow({
          ctx,
          input: {
            policyId: policy.id,
            ...window,
            monitorIds: [apiId],
            monitorMaintenanceWindowId,
          },
          now,
        });

      const mw = await insertWindow(ownerCtx.workspace.id, [apiId]);
      const row = await add(mw.id);
      expect(row.monitorMaintenanceWindowId).toBe(mw.id);

      const foreign = await insertWindow(otherCtx.workspace.id, []);
      await expect(add(foreign.id)).rejects.toBeInstanceOf(NotFoundError);

      const otherMonitor = await insertWindow(ownerCtx.workspace.id, [webId]);
      await expect(add(otherMonitor.id)).rejects.toBeInstanceOf(
        ValidationError,
      );

      const adjacent = await insertWindow(ownerCtx.workspace.id, [apiId], {
        from: window.to,
        to: new Date(window.to.getTime() + HOUR),
      });
      await expect(add(adjacent.id)).rejects.toThrow(/must overlap/);
    });
  });

  test("every kind is accepted", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const policy = await policyIn(tx);
      for (const kind of [
        "maintenance",
        "emergency",
        "third_party",
        "customer_caused",
        "force_majeure",
        "other",
      ] as const) {
        await addUptimeTargetExcusedWindow({
          ctx,
          input: { policyId: policy.id, ...window, monitorIds: [apiId], kind },
          now,
        });
      }
      const rows = await tx
        .select()
        .from(uptimeTargetExcusedWindow)
        .where(eq(uptimeTargetExcusedWindow.uptimeTargetId, policy.id))
        .all();
      expect(rows).toHaveLength(6);
    });
  });

  test("limits: from before to, at most 7 days, a reason", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const policy = await policyIn(tx);
      const add = (patch: Partial<typeof window>) =>
        addUptimeTargetExcusedWindow({
          ctx,
          input: {
            policyId: policy.id,
            ...window,
            monitorIds: [apiId],
            ...patch,
          },
          now,
        });
      await expect(add({ to: window.from })).rejects.toThrow(/end after/);
      await expect(
        add({
          from: oct(1),
          to: new Date(oct(1).getTime() + 7 * 24 * HOUR + 1),
        }),
      ).rejects.toThrow(/7 days/);
      await expect(add({ reason: "   " })).rejects.toThrow();
      await add({
        from: oct(1),
        to: new Date(oct(1).getTime() + 7 * 24 * HOUR),
      });
    });
  });

  test("a window touching a sealed month is refused", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const policy = await policyIn(tx);
      await sealOctober(tx, policy.id);

      const res = addUptimeTargetExcusedWindow({
        ctx,
        input: {
          policyId: policy.id,
          ...window,
          monitorIds: [apiId],
          from: oct(31, 23),
          to: new Date(Date.UTC(2026, 10, 1, 1)),
        },
        now,
      });
      await expect(res).rejects.toBeInstanceOf(PreconditionFailedError);
      await expect(res).rejects.toThrow(/sealed/);
      // November is open
      await addUptimeTargetExcusedWindow({
        ctx,
        input: {
          policyId: policy.id,
          ...window,
          monitorIds: [apiId],
          from: new Date(Date.UTC(2026, 10, 1)),
          to: new Date(Date.UTC(2026, 10, 1, 1)),
        },
        now,
      });
    });
  });

  test("a window in a month older than the previous one is refused", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const policy = await policyIn(tx);
      const res = addUptimeTargetExcusedWindow({
        ctx,
        input: {
          policyId: policy.id,
          ...window,
          monitorIds: [apiId],
          from: new Date(Date.UTC(2026, 8, 30, 23)),
          to: oct(1, 1),
        },
        now,
      });
      await expect(res).rejects.toBeInstanceOf(PreconditionFailedError);
      await expect(res).rejects.toThrow(/previous month/);
    });
  });

  test("a window reaching into a future month is refused", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const policy = await policyIn(tx);
      const res = addUptimeTargetExcusedWindow({
        ctx,
        input: {
          policyId: policy.id,
          ...window,
          monitorIds: [apiId],
          from: new Date(Date.UTC(2026, 10, 30, 23)),
          to: new Date(Date.UTC(2026, 11, 1, 1)),
        },
        now,
      });
      await expect(res).rejects.toBeInstanceOf(PreconditionFailedError);
      await expect(res).rejects.toThrow(/current and the previous month/);
    });
  });

  test("owners and admins only, own workspace, active policy, write scope", async () => {
    await withTestTransaction(async (tx) => {
      const policy = await policyIn(tx);
      const input = { policyId: policy.id, ...window, monitorIds: [apiId] };
      await expect(
        addUptimeTargetExcusedWindow({
          ctx: { ...memberCtx, db: tx },
          input,
          now,
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      await expect(
        addUptimeTargetExcusedWindow({
          ctx: { ...otherCtx, db: tx },
          input,
          now,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
      await archiveUptimeTarget({
        ctx: { ...ownerCtx, db: tx },
        input: { id: policy.id },
      });
      await expect(
        addUptimeTargetExcusedWindow({
          ctx: { ...ownerCtx, db: tx },
          input,
          now,
        }),
      ).rejects.toBeInstanceOf(PreconditionFailedError);
    });
  });

  test("rejects read-only actor", async () => {
    const ctx = makeApiKeyCtx(ownerCtx.workspace, {
      keyId: "k",
      scopes: ["monitors:read"],
    });
    await expect(
      addUptimeTargetExcusedWindow({
        ctx,
        input: { policyId: 1, ...window, monitorIds: [apiId] },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      removeUptimeTargetExcusedWindow({ ctx, input: { id: 1 } }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("removeUptimeTargetExcusedWindow", () => {
  test("removes the window, audited", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const policy = await policyIn(tx);
      const row = await addUptimeTargetExcusedWindow({
        ctx,
        input: { policyId: policy.id, ...window, monitorIds: [apiId] },
        now,
      });

      await removeUptimeTargetExcusedWindow({
        ctx,
        input: { id: row.id },
        now,
      });

      const left = await tx
        .select()
        .from(uptimeTargetExcusedWindow)
        .where(eq(uptimeTargetExcusedWindow.id, row.id))
        .all();
      expect(left).toEqual([]);
      const audits = await readAuditLog({
        workspaceId: ctx.workspace.id,
        entityType: "uptime_target_excused_window",
        entityId: row.id,
        db: tx,
      });
      expect(audits.map((a) => a.action).sort()).toEqual([
        "uptime_target_excused_window.create",
        "uptime_target_excused_window.delete",
      ]);
    });
  });

  test("a window whose month was sealed since is kept", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const policy = await policyIn(tx);
      const row = await addUptimeTargetExcusedWindow({
        ctx,
        input: { policyId: policy.id, ...window, monitorIds: [apiId] },
        now,
      });
      await sealOctober(tx, policy.id);

      await expect(
        removeUptimeTargetExcusedWindow({
          ctx,
          input: { id: row.id },
          now,
        }),
      ).rejects.toBeInstanceOf(PreconditionFailedError);
      // and is closed for good once October is older than the previous month
      await expect(
        removeUptimeTargetExcusedWindow({
          ctx,
          input: { id: row.id },
          now: new Date(Date.UTC(2026, 11, 5)),
        }),
      ).rejects.toBeInstanceOf(PreconditionFailedError);
    });
  });

  test("another workspace's window is not found", async () => {
    await withTestTransaction(async (tx) => {
      const policy = await policyIn(tx);
      const row = await addUptimeTargetExcusedWindow({
        ctx: { ...ownerCtx, db: tx },
        input: { policyId: policy.id, ...window, monitorIds: [apiId] },
        now,
      });
      await expect(
        removeUptimeTargetExcusedWindow({
          ctx: { ...otherCtx, db: tx },
          input: { id: row.id },
          now,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
