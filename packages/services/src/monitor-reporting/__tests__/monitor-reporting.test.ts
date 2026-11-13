import { db, eq } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";
import {
  addUserToWorkspace,
  createMonitor,
  createUser,
} from "@openstatus/db/src/test/factories";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import {
  clearAuditLog,
  createWorkspaceFixture,
  expectAuditRow,
  makeApiKeyCtx,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { ForbiddenError, NotFoundError, ValidationError } from "../../errors";
import { deleteMonitor, deleteMonitors } from "../../monitor/delete";
import { createMonitorReporting } from "../create";
import { listMonitorReportings } from "../list";

let ownerCtx: ServiceContext;
let adminCtx: ServiceContext;
let memberCtx: ServiceContext;
let freeCtx: ServiceContext;
const workspaceIds: number[] = [];
let apiId: number;
let webId: number;
let heartbeatId: number;
let privateOnlyId: number;
let deletedId: number;
let foreignId: number;

beforeAll(async () => {
  const team = await createWorkspaceFixture("team");
  const free = await createWorkspaceFixture("free");
  const other = await createWorkspaceFixture("team");
  workspaceIds.push(team.workspace.id, free.workspace.id, other.workspace.id);
  ownerCtx = makeUserCtx(team.workspace, { userId: team.userId });
  freeCtx = makeUserCtx(free.workspace, { userId: free.userId });

  const admin = await createUser();
  await addUserToWorkspace(admin.id, team.workspace.id, "admin");
  adminCtx = makeUserCtx(team.workspace, { userId: admin.id });
  const member = await createUser();
  await addUserToWorkspace(member.id, team.workspace.id, "member");
  memberCtx = makeUserCtx(team.workspace, { userId: member.id });

  const ws = team.workspace.id;
  apiId = (await createMonitor(ws, { name: "API", regions: "fra,iad" })).id;
  webId = (
    await createMonitor(ws, { name: "Web", jobType: "tcp", regions: "fra" })
  ).id;
  heartbeatId = (
    await createMonitor(ws, { name: "Cron", jobType: "heartbeat" })
  ).id;
  privateOnlyId = (await createMonitor(ws, { name: "Intranet", regions: "" }))
    .id;
  deletedId = (
    await createMonitor(ws, { regions: "fra", deletedAt: new Date() })
  ).id;
  foreignId = (await createMonitor(other.workspace.id, { regions: "fra" })).id;
});

afterAll(async () => {
  for (const id of workspaceIds) {
    await clearAuditLog(id);
    await db.delete(monitor).where(eq(monitor.workspaceId, id));
  }
});

describe("createMonitorReporting", () => {
  test("an owner creates a policy over eligible monitors, audited", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const policy = await createMonitorReporting({
        ctx,
        input: {
          name: "Enterprise",
          target: 99_500,
          monitorIds: [apiId, webId],
        },
      });

      expect(policy).toMatchObject({
        name: "Enterprise",
        target: 99_500,
        strict: false,
        monitorIds: [apiId, webId],
      });
      await expectAuditRow({
        workspaceId: ctx.workspace.id,
        action: "monitor_sla_policy.create",
        entityType: "monitor_sla_policy",
        entityId: policy.id,
        db: tx,
      });
    });
  });

  test("an admin can create too", async () => {
    await withTestTransaction(async (tx) => {
      const policy = await createMonitorReporting({
        ctx: { ...adminCtx, db: tx },
        input: { name: "Admin's", target: 99_000, monitorIds: [apiId] },
      });
      expect(policy.id).toBeGreaterThan(0);
    });
  });

  test("a member cannot create", async () => {
    await expect(
      createMonitorReporting({
        ctx: memberCtx,
        input: { name: "Nope", target: 99_000, monitorIds: [apiId] },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  test("rejects read-only actor", async () => {
    const ctx = makeApiKeyCtx(ownerCtx.workspace, {
      keyId: "k",
      userId: 1,
      scopes: ["read"],
    });
    await expect(
      createMonitorReporting({
        ctx,
        input: { name: "Nope", target: 99_000, monitorIds: [apiId] },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  test("rejects other-group key", async () => {
    const ctx = makeApiKeyCtx(ownerCtx.workspace, {
      keyId: "k",
      scopes: ["pages:write"],
    });
    await expect(
      createMonitorReporting({
        ctx,
        input: { name: "Nope", target: 99_000, monitorIds: [apiId] },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  test("refused without the monitor-sla limit", async () => {
    await expect(
      createMonitorReporting({
        ctx: freeCtx,
        input: { name: "Nope", target: 99_000, monitorIds: [] },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  test("an ineligible monitor is rejected by name and reason", async () => {
    await expect(
      createMonitorReporting({
        ctx: ownerCtx,
        input: {
          name: "Bad",
          target: 99_000,
          monitorIds: [apiId, heartbeatId],
        },
      }),
    ).rejects.toThrow(
      new ValidationError(
        'Monitor "Cron" cannot be under a reporting: heartbeat monitors have no run verdicts.',
      ),
    );
    await expect(
      createMonitorReporting({
        ctx: ownerCtx,
        input: { name: "Bad", target: 99_000, monitorIds: [privateOnlyId] },
      }),
    ).rejects.toThrow(
      'Monitor "Intranet" cannot be under a reporting: it runs from private locations only.',
    );
  });

  test("deleted and foreign monitors are not found", async () => {
    for (const id of [deletedId, foreignId]) {
      await expect(
        createMonitorReporting({
          ctx: ownerCtx,
          input: { name: "Bad", target: 99_000, monitorIds: [id] },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    }
  });

  test("the target is thousandths of a percent, above 0 and up to 100%", async () => {
    for (const target of [0, 100_001, 99.5]) {
      await expect(
        createMonitorReporting({
          ctx: ownerCtx,
          input: { name: "Bad", target, monitorIds: [] },
        }),
      ).rejects.toThrow();
    }
  });
});

describe("listMonitorReportings", () => {
  test("a workspace has many policies and a monitor can be in several", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const a = await createMonitorReporting({
        ctx,
        input: { name: "A", target: 99_900, monitorIds: [apiId, webId] },
      });
      const b = await createMonitorReporting({
        ctx,
        input: { name: "B", target: 99_000, monitorIds: [apiId] },
      });

      const policies = await listMonitorReportings({
        ctx: { ...memberCtx, db: tx },
      });

      expect(policies.map((p) => [p.id, p.monitors.map((m) => m.id)])).toEqual([
        [a.id, [apiId, webId]],
        [b.id, [apiId]],
      ]);
      expect(policies[0]?.monitors[0]).toMatchObject({
        id: apiId,
        name: "API",
      });
    });
  });

  test("reads are refused without the limit", async () => {
    await expect(
      listMonitorReportings({ ctx: freeCtx }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  test("rejects other-group key", async () => {
    const ctx = makeApiKeyCtx(ownerCtx.workspace, {
      keyId: "k",
      scopes: ["pages:read"],
    });
    await expect(listMonitorReportings({ ctx })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  test("deleting a monitor removes it from its policies", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const policy = await createMonitorReporting({
        ctx,
        input: { name: "Del", target: 99_000, monitorIds: [apiId, webId] },
      });

      await deleteMonitor({ ctx, input: { id: webId } });

      const [listed] = await listMonitorReportings({ ctx });
      expect(listed?.id).toBe(policy.id);
      expect(listed?.monitors.map((m) => m.id)).toEqual([apiId]);
    });
  });

  test("bulk-deleting monitors removes them from their policies", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      await createMonitorReporting({
        ctx,
        input: { name: "Bulk", target: 99_000, monitorIds: [apiId, webId] },
      });

      await deleteMonitors({ ctx, input: { ids: [apiId, webId] } });

      const [listed] = await listMonitorReportings({ ctx });
      expect(listed?.monitors).toEqual([]);
    });
  });
});
