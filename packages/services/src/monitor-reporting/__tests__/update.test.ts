import { db, eq } from "@openstatus/db";
import {
  monitor,
  monitorSlaPolicy,
  monitorSlaPolicyToMonitor,
} from "@openstatus/db/src/schema";
import { defaultIncidentSlaTargets } from "@openstatus/db/src/schema/incident_sla_policies/constants";
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
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../errors";
import { deleteIncidentReporting } from "../../incident-reporting/delete";
import { upsertIncidentReporting } from "../../incident-reporting/upsert";
import { archiveMonitorReporting } from "../archive";
import { createMonitorReporting } from "../create";
import { getMonitorReporting, getMonitorReportingSummary } from "../get";
import { updateMonitorReporting } from "../update";
import {
  episodesPipesFrom,
  noEpisodes,
  runsEvery,
} from "./fixtures/episodes-pipes";

const now = new Date(Date.UTC(2026, 10, 15, 12));

let ownerCtx: ServiceContext;
let adminCtx: ServiceContext;
let memberCtx: ServiceContext;
let freeCtx: ServiceContext;
let otherCtx: ServiceContext;
const workspaceIds: number[] = [];
let apiId: number;
let webId: number;
let heartbeatId: number;

beforeAll(async () => {
  const team = await createWorkspaceFixture("team");
  const free = await createWorkspaceFixture("free");
  const other = await createWorkspaceFixture("team");
  workspaceIds.push(team.workspace.id, free.workspace.id, other.workspace.id);
  ownerCtx = makeUserCtx(team.workspace, { userId: team.userId });
  freeCtx = makeUserCtx(free.workspace, { userId: free.userId });
  otherCtx = makeUserCtx(other.workspace, { userId: other.userId });

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
});

afterAll(async () => {
  for (const id of workspaceIds) {
    await clearAuditLog(id);
    await db.delete(monitor).where(eq(monitor.workspaceId, id));
  }
});

describe("updateMonitorReporting", () => {
  test("an owner changes name, target and strict, audited with before and after", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const created = await createMonitorReporting({
        ctx,
        input: { name: "Enterprise", target: 99_500, monitorIds: [apiId] },
      });

      const updated = await updateMonitorReporting({
        ctx,
        input: {
          id: created.id,
          name: "Partner",
          target: 99_900,
          strict: true,
        },
      });

      expect(updated).toMatchObject({
        id: created.id,
        name: "Partner",
        target: 99_900,
        strict: true,
        monitorIds: [apiId],
      });
      const [row] = await readAuditLog({
        workspaceId: ctx.workspace.id,
        entityType: "monitor_sla_policy",
        entityId: created.id,
        db: tx,
      });
      expect(row?.action).toBe("monitor_sla_policy.update");
      expect(row?.before).toMatchObject({
        name: "Enterprise",
        target: 99_500,
        strict: false,
        monitorIds: [apiId],
      });
      expect(row?.after).toMatchObject({
        name: "Partner",
        target: 99_900,
        strict: true,
        monitorIds: [apiId],
      });
    });
  });

  test("strict applies from the next month: the previous one keeps counting slow time as up", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const policy = await createMonitorReporting({
        ctx,
        input: { name: "Strict", target: 99_500, monitorIds: [apiId] },
      });
      await tx
        .update(monitorSlaPolicyToMonitor)
        .set({ createdAt: new Date(Date.UTC(2026, 0, 1)) })
        .where(eq(monitorSlaPolicyToMonitor.monitorSlaPolicyId, policy.id));
      // October is still judged on episodes; all of Oct 20 slow
      const early = new Date(Date.UTC(2026, 10, 3, 12));
      const slow = Date.UTC(2026, 9, 20);
      const episodesPipes = episodesPipesFrom(() =>
        runsEvery(Date.UTC(2026, 9, 1), early.getTime(), 600_000, (t) =>
          t >= slow && t < slow + 86_400_000 ? "degraded" : "ok",
        ),
      );

      const read = () =>
        getMonitorReporting({
          ctx,
          input: { id: policy.id },
          now: early,
          episodesPipes,
        });
      expect((await read()).monitors[0]?.months.at(-2)).toMatchObject({
        state: "preview",
        uptime: 100_000,
        met: true,
      });

      await updateMonitorReporting({
        ctx,
        input: { id: policy.id, strict: true },
      });

      const after = await read();
      expect(after.strict).toBe(true);
      expect(after.monitors[0]?.months.at(-2)).toMatchObject({
        state: "preview",
        terms: { strict: false },
        uptime: 100_000,
        met: true,
      });
      expect(after.missed.months).toBe(0);
    });
  });

  test("an added monitor is covered from when it joined, removing keeps the others' start", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const policy = await createMonitorReporting({
        ctx,
        input: { name: "Members", target: 99_000, monitorIds: [apiId] },
      });
      const longAgo = new Date(Date.UTC(2026, 0, 1));
      await tx
        .update(monitorSlaPolicyToMonitor)
        .set({ createdAt: longAgo })
        .where(eq(monitorSlaPolicyToMonitor.monitorId, apiId));
      const added = await updateMonitorReporting({
        ctx,
        input: { id: policy.id, monitorIds: [webId, apiId] },
      });
      expect(added.monitorIds).toEqual([apiId, webId].sort((a, b) => a - b));

      const res = await getMonitorReporting({
        ctx,
        input: { id: policy.id },
        now,
        episodesPipes: noEpisodes,
      });
      const web = res.monitors.find((m) => m.id === webId);
      expect(web?.months.find((m) => m.month === "2026-03-01")).toMatchObject({
        state: "none",
        met: null,
      });

      const memberships = await tx
        .select()
        .from(monitorSlaPolicyToMonitor)
        .where(eq(monitorSlaPolicyToMonitor.monitorSlaPolicyId, policy.id))
        .all();
      expect(memberships.find((m) => m.monitorId === apiId)?.createdAt).toEqual(
        longAgo,
      );

      const removed = await updateMonitorReporting({
        ctx,
        input: { id: policy.id, monitorIds: [apiId] },
      });
      expect(removed.monitorIds).toEqual([apiId]);
      const [listed] = await tx
        .select()
        .from(monitorSlaPolicyToMonitor)
        .where(eq(monitorSlaPolicyToMonitor.monitorSlaPolicyId, policy.id))
        .all();
      expect(listed).toMatchObject({ monitorId: apiId, createdAt: longAgo });
    });
  });

  test("an ineligible monitor cannot be added", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const policy = await createMonitorReporting({
        ctx,
        input: { name: "Bad", target: 99_000, monitorIds: [apiId] },
      });
      await expect(
        updateMonitorReporting({
          ctx,
          input: { id: policy.id, monitorIds: [apiId, heartbeatId] },
        }),
      ).rejects.toThrow(
        new ValidationError(
          'Monitor "Cron" cannot be under a reporting: heartbeat monitors have no run verdicts.',
        ),
      );
    });
  });

  test("a save without changes writes no audit row", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const policy = await createMonitorReporting({
        ctx,
        input: { name: "Same", target: 99_000, monitorIds: [apiId] },
      });
      await updateMonitorReporting({
        ctx,
        input: { id: policy.id, name: "Same", monitorIds: [apiId] },
      });
      const rows = await readAuditLog({
        workspaceId: ctx.workspace.id,
        entityType: "monitor_sla_policy",
        entityId: policy.id,
        db: tx,
      });
      expect(rows.map((r) => r.action)).toEqual(["monitor_sla_policy.create"]);
    });
  });

  test("an admin can edit, a member cannot", async () => {
    await withTestTransaction(async (tx) => {
      const policy = await createMonitorReporting({
        ctx: { ...ownerCtx, db: tx },
        input: { name: "Roles", target: 99_000, monitorIds: [] },
      });
      const updated = await updateMonitorReporting({
        ctx: { ...adminCtx, db: tx },
        input: { id: policy.id, name: "Admin's" },
      });
      expect(updated.name).toBe("Admin's");
      await expect(
        updateMonitorReporting({
          ctx: { ...memberCtx, db: tx },
          input: { id: policy.id, name: "Nope" },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  test("a policy of another workspace is not found", async () => {
    await withTestTransaction(async (tx) => {
      const policy = await createMonitorReporting({
        ctx: { ...ownerCtx, db: tx },
        input: { name: "Mine", target: 99_000, monitorIds: [] },
      });
      await expect(
        updateMonitorReporting({
          ctx: { ...otherCtx, db: tx },
          input: { id: policy.id, name: "Theirs" },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  test("refused without the limit, for read-only and other-group keys", async () => {
    await expect(
      updateMonitorReporting({ ctx: freeCtx, input: { id: 1, name: "x" } }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    for (const scopes of [["read"], ["pages:write"]]) {
      const ctx = makeApiKeyCtx(ownerCtx.workspace, {
        keyId: "k",
        scopes,
      });
      await expect(
        updateMonitorReporting({ ctx, input: { id: 1, name: "x" } }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    }
  });
});

describe("createMonitorReporting strict", () => {
  test("a policy can be created strict", async () => {
    await withTestTransaction(async (tx) => {
      const policy = await createMonitorReporting({
        ctx: { ...ownerCtx, db: tx },
        input: { name: "Strict", target: 99_000, strict: true, monitorIds: [] },
      });
      expect(policy.strict).toBe(true);
    });
  });
});

describe("support terms: the linked incident policy", () => {
  const incidentInput = {
    targets: defaultIncidentSlaTargets,
    resolutionStop: "mitigated" as const,
    creditPerMissPct: 5,
  };

  test("a policy links the workspace's incident policy and unlinks it with null, audited", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const incident = await upsertIncidentReporting({
        ctx,
        input: incidentInput,
      });
      const policy = await createMonitorReporting({
        ctx,
        input: { name: "Enterprise", target: 99_500, monitorIds: [apiId] },
      });
      expect(policy.incidentSlaPolicyId).toBeNull();

      const linked = await updateMonitorReporting({
        ctx,
        input: { id: policy.id, incidentSlaPolicyId: incident.id },
        now,
      });
      expect(linked.incidentSlaPolicyId).toBe(incident.id);
      const [row] = await readAuditLog({
        workspaceId: ctx.workspace.id,
        entityType: "monitor_sla_policy",
        entityId: policy.id,
        db: tx,
      });
      expect(row?.before).toMatchObject({ incidentSlaPolicyId: null });
      expect(row?.after).toMatchObject({ incidentSlaPolicyId: incident.id });

      const unlinked = await updateMonitorReporting({
        ctx,
        input: { id: policy.id, incidentSlaPolicyId: null },
        now,
      });
      expect(unlinked.incidentSlaPolicyId).toBeNull();
    });
  });

  test("a second policy cannot link it; the refusal names the holder", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const incident = await upsertIncidentReporting({
        ctx,
        input: incidentInput,
      });
      const holder = await createMonitorReporting({
        ctx,
        input: { name: "Enterprise", target: 99_500, monitorIds: [apiId] },
      });
      const other = await createMonitorReporting({
        ctx,
        input: { name: "Partner", target: 99_000, monitorIds: [webId] },
      });
      await updateMonitorReporting({
        ctx,
        input: { id: holder.id, incidentSlaPolicyId: incident.id },
        now,
      });

      const refused = updateMonitorReporting({
        ctx,
        input: { id: other.id, incidentSlaPolicyId: incident.id },
        now,
      });
      await expect(refused).rejects.toBeInstanceOf(ConflictError);
      await expect(refused).rejects.toThrow(/"Enterprise"/);

      // saving the holder again is not a second link
      await expect(
        updateMonitorReporting({
          ctx,
          input: {
            id: holder.id,
            incidentSlaPolicyId: incident.id,
            name: "Ent",
          },
          now,
        }),
      ).resolves.toMatchObject({ incidentSlaPolicyId: incident.id });
      const summary = await getMonitorReportingSummary({
        ctx,
        input: { id: other.id },
        now,
      });
      expect(summary.incidentLinkHolder).toEqual({
        id: holder.id,
        name: "Ent",
      });
    });
  });

  test("a link taken by a concurrent save is refused by the index, naming the holder", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const incident = await upsertIncidentReporting({
        ctx,
        input: incidentInput,
      });
      const holder = await createMonitorReporting({
        ctx,
        input: { name: "Enterprise", target: 99_500, monitorIds: [apiId] },
      });
      const other = await createMonitorReporting({
        ctx,
        input: { name: "Partner", target: 99_000, monitorIds: [webId] },
      });
      await tx
        .update(monitorSlaPolicy)
        .set({ incidentSlaPolicyId: incident.id })
        .where(eq(monitorSlaPolicy.id, holder.id));

      const refused = updateMonitorReporting({
        ctx,
        input: { id: other.id, incidentSlaPolicyId: incident.id },
        now,
      });
      await expect(refused).rejects.toBeInstanceOf(ConflictError);
      await expect(refused).rejects.toThrow(
        'The incident policy is already linked to "Enterprise". Unlink it there first.',
      );
    });
  });

  test("turning the incident policy off audits the unlink on the holder", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const incident = await upsertIncidentReporting({
        ctx,
        input: incidentInput,
      });
      const policy = await createMonitorReporting({
        ctx,
        input: { name: "Enterprise", target: 99_500, monitorIds: [apiId] },
      });
      await updateMonitorReporting({
        ctx,
        input: { id: policy.id, incidentSlaPolicyId: incident.id },
        now,
      });
      await clearAuditLog(ctx.workspace.id, { db: tx });

      await deleteIncidentReporting({ ctx });
      const rows = await readAuditLog({
        workspaceId: ctx.workspace.id,
        entityType: "monitor_sla_policy",
        entityId: policy.id,
        db: tx,
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        action: "monitor_sla_policy.update",
        before: { incidentSlaPolicyId: incident.id, target: 99_500 },
        after: { incidentSlaPolicyId: null, target: 99_500 },
      });
    });
  });

  test("another workspace's incident policy is not found", async () => {
    await withTestTransaction(async (tx) => {
      const foreign = await upsertIncidentReporting({
        ctx: { ...otherCtx, db: tx },
        input: incidentInput,
      });
      const ctx = { ...ownerCtx, db: tx };
      const policy = await createMonitorReporting({
        ctx,
        input: { name: "Enterprise", target: 99_500, monitorIds: [apiId] },
      });
      await expect(
        updateMonitorReporting({
          ctx,
          input: { id: policy.id, incidentSlaPolicyId: foreign.id },
          now,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  test("turning the incident policy off unlinks it; archiving a holder frees the link", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const incident = await upsertIncidentReporting({
        ctx,
        input: incidentInput,
      });
      const policy = await createMonitorReporting({
        ctx,
        input: { name: "Enterprise", target: 99_500, monitorIds: [apiId] },
      });
      await updateMonitorReporting({
        ctx,
        input: { id: policy.id, incidentSlaPolicyId: incident.id },
        now,
      });
      await deleteIncidentReporting({ ctx });
      expect(
        (
          await getMonitorReportingSummary({
            ctx,
            input: { id: policy.id },
            now,
          })
        ).incidentSlaPolicyId,
      ).toBeNull();

      const again = await upsertIncidentReporting({
        ctx,
        input: incidentInput,
      });
      await updateMonitorReporting({
        ctx,
        input: { id: policy.id, incidentSlaPolicyId: again.id },
        now,
      });
      const archived = await archiveMonitorReporting({
        ctx,
        input: { id: policy.id },
      });
      expect(archived.incidentSlaPolicyId).toBeNull();
      const next = await createMonitorReporting({
        ctx,
        input: { name: "Partner", target: 99_000, monitorIds: [webId] },
      });
      await expect(
        updateMonitorReporting({
          ctx,
          input: { id: next.id, incidentSlaPolicyId: again.id },
          now,
        }),
      ).resolves.toMatchObject({ incidentSlaPolicyId: again.id });
    });
  });
});
