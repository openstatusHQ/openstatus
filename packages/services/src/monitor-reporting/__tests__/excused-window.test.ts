import { db, eq } from "@openstatus/db";
import {
  monitor,
  monitorSlaExcusedWindow,
  monitorSlaSealedMonth,
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
} from "../../errors";
import { addMonitorReportingExcusedWindow } from "../add-excused-window";
import { archiveMonitorReporting } from "../archive";
import { createMonitorReporting } from "../create";
import { removeMonitorReportingExcusedWindow } from "../remove-excused-window";

const HOUR = 3_600_000;
const now = new Date(Date.UTC(2026, 10, 15, 12));
const oct = (d: number, h = 0) => new Date(Date.UTC(2026, 9, d, h));

let ownerCtx: ServiceContext;
let memberCtx: ServiceContext;
let otherCtx: ServiceContext;
let ownerId: number;
const workspaceIds: number[] = [];
let apiId: number;

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
});

afterAll(async () => {
  for (const id of workspaceIds) {
    await clearAuditLog(id);
    await db.delete(monitor).where(eq(monitor.workspaceId, id));
  }
});

type Tx = Parameters<Parameters<typeof withTestTransaction>[0]>[0];

async function policyIn(tx: Tx) {
  return createMonitorReporting({
    ctx: { ...ownerCtx, db: tx },
    input: { name: "Partner", target: 99_500, monitorIds: [apiId] },
  });
}

async function sealOctober(tx: Tx, policyId: number) {
  await tx.insert(monitorSlaSealedMonth).values({
    workspaceId: ownerCtx.workspace.id,
    monitorSlaPolicyId: policyId,
    monitorId: apiId,
    month: "2026-10-01",
    target: 99_500,
    strict: false,
    ok: 1000,
    degraded: 0,
    error: 0,
    total: 1000,
    up: 1000,
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

describe("addMonitorReportingExcusedWindow", () => {
  test("stores the window with who added it, audited", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const policy = await policyIn(tx);

      const row = await addMonitorReportingExcusedWindow({
        ctx,
        input: { policyId: policy.id, ...window },
        now,
      });

      expect(row).toMatchObject({
        monitorSlaPolicyId: policy.id,
        kind: "maintenance",
        reason: "Database upgrade, announced Oct 30",
        from: oct(20, 22),
        to: oct(20, 23),
        createdBy: ownerId,
      });
      const [audit] = await readAuditLog({
        workspaceId: ctx.workspace.id,
        entityType: "monitor_sla_excused_window",
        entityId: row.id,
        db: tx,
      });
      expect(audit?.action).toBe("monitor_sla_excused_window.create");
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
        await addMonitorReportingExcusedWindow({
          ctx,
          input: { policyId: policy.id, ...window, kind },
          now,
        });
      }
      const rows = await tx
        .select()
        .from(monitorSlaExcusedWindow)
        .where(eq(monitorSlaExcusedWindow.monitorSlaPolicyId, policy.id))
        .all();
      expect(rows).toHaveLength(6);
    });
  });

  test("limits: from before to, at most 7 days, a reason", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const policy = await policyIn(tx);
      const add = (patch: Partial<typeof window>) =>
        addMonitorReportingExcusedWindow({
          ctx,
          input: { policyId: policy.id, ...window, ...patch },
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

      const res = addMonitorReportingExcusedWindow({
        ctx,
        input: {
          policyId: policy.id,
          ...window,
          from: oct(31, 23),
          to: new Date(Date.UTC(2026, 10, 1, 1)),
        },
        now,
      });
      await expect(res).rejects.toBeInstanceOf(PreconditionFailedError);
      await expect(res).rejects.toThrow(/sealed/);
      // November is open
      await addMonitorReportingExcusedWindow({
        ctx,
        input: {
          policyId: policy.id,
          ...window,
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
      const res = addMonitorReportingExcusedWindow({
        ctx,
        input: {
          policyId: policy.id,
          ...window,
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
      const res = addMonitorReportingExcusedWindow({
        ctx,
        input: {
          policyId: policy.id,
          ...window,
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
      const input = { policyId: policy.id, ...window };
      await expect(
        addMonitorReportingExcusedWindow({
          ctx: { ...memberCtx, db: tx },
          input,
          now,
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      await expect(
        addMonitorReportingExcusedWindow({
          ctx: { ...otherCtx, db: tx },
          input,
          now,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
      await archiveMonitorReporting({
        ctx: { ...ownerCtx, db: tx },
        input: { id: policy.id },
      });
      await expect(
        addMonitorReportingExcusedWindow({
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
      addMonitorReportingExcusedWindow({
        ctx,
        input: { policyId: 1, ...window },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      removeMonitorReportingExcusedWindow({ ctx, input: { id: 1 } }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("removeMonitorReportingExcusedWindow", () => {
  test("removes the window, audited", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const policy = await policyIn(tx);
      const row = await addMonitorReportingExcusedWindow({
        ctx,
        input: { policyId: policy.id, ...window },
        now,
      });

      await removeMonitorReportingExcusedWindow({
        ctx,
        input: { id: row.id },
        now,
      });

      const left = await tx
        .select()
        .from(monitorSlaExcusedWindow)
        .where(eq(monitorSlaExcusedWindow.id, row.id))
        .all();
      expect(left).toEqual([]);
      const audits = await readAuditLog({
        workspaceId: ctx.workspace.id,
        entityType: "monitor_sla_excused_window",
        entityId: row.id,
        db: tx,
      });
      expect(audits.map((a) => a.action).sort()).toEqual([
        "monitor_sla_excused_window.create",
        "monitor_sla_excused_window.delete",
      ]);
    });
  });

  test("a window whose month was sealed since is kept", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const policy = await policyIn(tx);
      const row = await addMonitorReportingExcusedWindow({
        ctx,
        input: { policyId: policy.id, ...window },
        now,
      });
      await sealOctober(tx, policy.id);

      await expect(
        removeMonitorReportingExcusedWindow({
          ctx,
          input: { id: row.id },
          now,
        }),
      ).rejects.toBeInstanceOf(PreconditionFailedError);
      // and is closed for good once October is older than the previous month
      await expect(
        removeMonitorReportingExcusedWindow({
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
      const row = await addMonitorReportingExcusedWindow({
        ctx: { ...ownerCtx, db: tx },
        input: { policyId: policy.id, ...window },
        now,
      });
      await expect(
        removeMonitorReportingExcusedWindow({
          ctx: { ...otherCtx, db: tx },
          input: { id: row.id },
          now,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
