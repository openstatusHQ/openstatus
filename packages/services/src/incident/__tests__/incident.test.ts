import { and, db, eq, sql } from "@openstatus/db";
import {
  auditLog,
  type IncidentStatus,
  incident,
  incidentEvent,
  incidentStatus,
  monitorIncidentTable,
  statusReport,
} from "@openstatus/db/src/schema";
import {
  addUserToWorkspace,
  createIncident,
  createMonitor,
  createUser,
} from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";
import { beforeAll, describe, test } from "@std/testing/bdd";

import {
  clearAuditLogFor,
  createWorkspaceFixture,
  expectAuditRow,
  makeApiKeyCtx,
  makeUserCtx,
  readAuditLog,
  withTestTransaction,
} from "../../../test/helpers";
import type { DB, ServiceContext } from "../../context";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../errors";
import type { Workspace } from "../../types";
import {
  addIncidentNote,
  allowedTransitions,
  bindIncidentSlackChannel,
  closeIncident,
  declareIncident,
  deleteIncident,
  getIncident,
  linkIncidentStatusReport,
  listIncidentEvents,
  listIncidents,
  setIncidentStatus,
  unbindIncidentSlackChannel,
  unlinkIncidentStatusReport,
  updateIncident,
} from "../index";

let workspace: Workspace;
let ownerId: number;
let adminId: number;
let memberId: number;
let outsiderId: number;
let otherWorkspace: Workspace;

beforeAll(async () => {
  const fixture = await createWorkspaceFixture("team");
  workspace = fixture.workspace;
  ownerId = fixture.userId;
  adminId = (await createUser()).id;
  memberId = (await createUser()).id;
  outsiderId = (await createUser()).id;
  await addUserToWorkspace(adminId, workspace.id, "admin");
  await addUserToWorkspace(memberId, workspace.id, "member");
  otherWorkspace = (await createWorkspaceFixture("team")).workspace;
});

const as = (userId: number, tx: DB): ServiceContext => ({
  ...makeUserCtx(workspace, { userId }),
  db: tx,
});

async function declare(tx: DB, userId = memberId) {
  return declareIncident({
    ctx: as(userId, tx),
    input: { title: "API down", severity: "major", commanderId: memberId },
  });
}

async function eventCount(tx: DB, incidentId: number) {
  const rows = await tx
    .select({ id: incidentEvent.id })
    .from(incidentEvent)
    .where(eq(incidentEvent.incidentId, incidentId))
    .all();
  return rows.length;
}

async function eventAuditCount(tx: DB, incidentId: number) {
  const rows = await tx
    .select({ id: auditLog.id })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.workspaceId, workspace.id),
        eq(auditLog.action, "incident_event.create"),
        sql`json_extract(${auditLog.metadata}, '$.incidentId') = ${incidentId}`,
      ),
    )
    .all();
  return rows.length;
}

async function expectInvariant(tx: DB, incidentId: number) {
  expect(await eventAuditCount(tx, incidentId)).toBe(
    await eventCount(tx, incidentId),
  );
}

async function incidentAudits(tx: DB, incidentId: number) {
  return readAuditLog({
    workspaceId: workspace.id,
    entityType: "incident",
    entityId: incidentId,
    db: tx,
  });
}

describe("declareIncident", () => {
  test("creates the incident, its declared event and both audit rows", async () => {
    await withTestTransaction(async (tx) => {
      const row = await declare(tx);
      expect(row.status).toBe("open");
      expect(row.declaredBy).toBe(memberId);
      expect(row.startedAt.getTime()).toBe(row.declaredAt.getTime());
      await expectAuditRow({
        workspaceId: workspace.id,
        action: "incident.create",
        entityType: "incident",
        entityId: row.id,
        actorType: "user",
        db: tx,
      });
      const events = await listIncidentEvents({
        ctx: as(memberId, tx),
        input: { id: row.id },
      });
      expect(events.map((e) => e.type)).toEqual(["declared"]);
      expect(events[0].createdByUser?.id).toBe(memberId);
      await expectInvariant(tx, row.id);
    });
  });

  test("declaring from a monitor incident takes its start and records the source", async () => {
    await withTestTransaction(async (tx) => {
      const monitor = await createMonitor(workspace.id, {}, tx);
      const startedAt = new Date(Date.now() - 3 * 60 * 60 * 1000);
      startedAt.setMilliseconds(0);
      const downtime = await tx
        .insert(monitorIncidentTable)
        .values({ workspaceId: workspace.id, monitorId: monitor.id, startedAt })
        .returning()
        .get();
      const row = await declareIncident({
        ctx: as(memberId, tx),
        input: {
          title: "Checkout down",
          severity: "critical",
          source: { type: "monitor_incident", id: downtime.id },
        },
      });
      expect(row.startedAt.getTime()).toBe(startedAt.getTime());
      const [created] = await incidentAudits(tx, row.id);
      expect(created.metadata).toEqual({
        source: "monitor_incident",
        ref: downtime.id,
      });
    });
  });

  test("links a status report at declare time, once", async () => {
    await withTestTransaction(async (tx) => {
      const report = await tx
        .insert(statusReport)
        .values({
          workspaceId: workspace.id,
          title: "Degraded",
          status: "investigating",
        })
        .returning()
        .get();
      const row = await declareIncident({
        ctx: as(memberId, tx),
        input: {
          title: "Linked",
          severity: "minor",
          statusReportId: report.id,
        },
      });
      expect(row.statusReportId).toBe(report.id);
      const events = await listIncidentEvents({
        ctx: as(memberId, tx),
        input: { id: row.id },
      });
      expect(events.map((e) => e.type).sort()).toEqual([
        "declared",
        "status_report_linked",
      ]);
      await expect(
        declareIncident({
          ctx: as(memberId, tx),
          input: {
            title: "Second",
            severity: "minor",
            statusReportId: report.id,
          },
        }),
      ).rejects.toThrow(ConflictError);
      await expectInvariant(tx, row.id);
    });
  });

  test("a commander must be a member", async () => {
    await withTestTransaction(async (tx) => {
      await expect(
        declareIncident({
          ctx: as(memberId, tx),
          input: { title: "x", severity: "minor", commanderId: outsiderId },
        }),
      ).rejects.toThrow(ValidationError);
    });
  });

  test("rejects a read-only API key", async () => {
    await expect(
      declareIncident({
        ctx: makeApiKeyCtx(workspace, { keyId: "k", scopes: ["read"] }),
        input: { title: "x", severity: "minor" },
      }),
    ).rejects.toThrow(ForbiddenError);
  });
});

describe("updateIncident", () => {
  test("one event per tracked field, one incident.update", async () => {
    await withTestTransaction(async (tx) => {
      const row = await declare(tx);
      const startedAt = new Date(row.startedAt.getTime() - 60_000);
      await updateIncident({
        ctx: as(memberId, tx),
        input: {
          id: row.id,
          severity: "critical",
          commanderId: adminId,
          startedAt,
          title: "API fully down",
        },
      });
      const events = await listIncidentEvents({
        ctx: as(memberId, tx),
        input: { id: row.id },
      });
      expect(events.map((e) => e.type).sort()).toEqual([
        "commander_changed",
        "declared",
        "severity_changed",
        "started_at_changed",
      ]);
      const updates = (await incidentAudits(tx, row.id)).filter(
        (a) => a.action === "incident.update",
      );
      expect(updates).toHaveLength(1);
      expect(updates[0].changedFields?.sort()).toEqual([
        "commanderId",
        "severity",
        "startedAt",
        "title",
      ]);
      await expectInvariant(tx, row.id);
    });
  });

  test("a title-only edit writes no event, a no-op writes nothing", async () => {
    await withTestTransaction(async (tx) => {
      const row = await declare(tx);
      await updateIncident({
        ctx: as(memberId, tx),
        input: { id: row.id, title: "Renamed" },
      });
      await updateIncident({
        ctx: as(memberId, tx),
        input: { id: row.id, title: "Renamed" },
      });
      expect(await eventCount(tx, row.id)).toBe(1);
      const updates = (await incidentAudits(tx, row.id)).filter(
        (a) => a.action === "incident.update",
      );
      expect(updates).toHaveLength(1);
    });
  });
});

describe("setIncidentStatus", () => {
  const cases: Array<[IncidentStatus, IncidentStatus, boolean]> = [];
  for (const from of incidentStatus) {
    for (const to of incidentStatus) {
      cases.push([
        from,
        to,
        allowedTransitions({ status: from, closedAt: null }).includes(to),
      ]);
    }
  }

  test("follows the transition table", async () => {
    const expected: Record<IncidentStatus, IncidentStatus[]> = {
      open: ["mitigated", "resolved", "canceled"],
      mitigated: ["open", "resolved", "canceled"],
      resolved: ["open"],
      canceled: [],
    };
    for (const [from, to, allowed] of cases) {
      expect(allowed).toBe(expected[from].includes(to));
      await withTestTransaction(async (tx) => {
        const row = await createIncident(
          workspace.id,
          {
            status: from,
            closedAt: from === "canceled" ? new Date() : null,
          },
          tx,
        );
        const run = setIncidentStatus({
          ctx: as(memberId, tx),
          input: { id: row.id, status: to },
        });
        if (allowed) {
          expect((await run).status).toBe(to);
        } else {
          await expect(run).rejects.toThrow(ConflictError);
        }
      });
    }
  });

  test("a closed incident accepts no transition", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createIncident(
        workspace.id,
        { status: "resolved", resolvedAt: new Date(), closedAt: new Date() },
        tx,
      );
      await expect(
        setIncidentStatus({
          ctx: as(memberId, tx),
          input: { id: row.id, status: "open" },
        }),
      ).rejects.toThrow(ConflictError);
    });
  });

  test("timestamps: mitigate once, resolve, reopen keeps resolved_at, cancel closes", async () => {
    await withTestTransaction(async (tx) => {
      const row = await declare(tx);
      const ctx = as(memberId, tx);
      const mitigated = await setIncidentStatus({
        ctx,
        input: { id: row.id, status: "mitigated", note: "Rolled back" },
      });
      expect(mitigated.mitigatedAt).not.toBeNull();
      await setIncidentStatus({ ctx, input: { id: row.id, status: "open" } });
      const again = await setIncidentStatus({
        ctx,
        input: { id: row.id, status: "mitigated" },
      });
      expect(again.mitigatedAt?.getTime()).toBe(
        mitigated.mitigatedAt?.getTime(),
      );
      const resolved = await setIncidentStatus({
        ctx,
        input: { id: row.id, status: "resolved" },
      });
      expect(resolved.resolvedBy).toBe(memberId);
      const reopened = await setIncidentStatus({
        ctx,
        input: { id: row.id, status: "open" },
      });
      expect(reopened.resolvedBy).toBeNull();
      expect(reopened.resolvedAt).not.toBeNull();
      const canceled = await setIncidentStatus({
        ctx,
        input: { id: row.id, status: "canceled", note: "False alarm" },
      });
      expect(canceled.closedAt).not.toBeNull();

      const events = await listIncidentEvents({ ctx, input: { id: row.id } });
      const noted = events.find((e) => e.message?.includes("Rolled back"));
      expect(noted?.type).toBe("status_changed");
      expect(events[0].type).toBe("canceled");
      expect(events[0].message).toBe("False alarm");
      await expectInvariant(tx, row.id);
    });
  });

  test("two concurrent resolves: one wins, one conflicts, one event", async () => {
    const row = await createIncident(workspace.id);
    try {
      const ctx = makeUserCtx(workspace, { userId: memberId });
      const results = await Promise.allSettled([
        setIncidentStatus({ ctx, input: { id: row.id, status: "resolved" } }),
        setIncidentStatus({ ctx, input: { id: row.id, status: "resolved" } }),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const rejected = results.find((r) => r.status === "rejected");
      expect(
        rejected?.status === "rejected" &&
          rejected.reason instanceof ConflictError,
      ).toBe(true);
      const resolvedEvents = await db
        .select()
        .from(incidentEvent)
        .where(
          and(
            eq(incidentEvent.incidentId, row.id),
            eq(incidentEvent.type, "resolved"),
          ),
        )
        .all();
      expect(resolvedEvents).toHaveLength(1);
    } finally {
      const events = await db
        .delete(incidentEvent)
        .where(eq(incidentEvent.incidentId, row.id))
        .returning({ id: incidentEvent.id });
      await db.delete(incident).where(eq(incident.id, row.id));
      await clearAuditLogFor({ entityType: "incident", entityIds: [row.id] });
      await clearAuditLogFor({
        entityType: "incident_event",
        entityIds: events.map((e) => e.id),
      });
    }
  });
});

describe("addIncidentNote", () => {
  test("appends a note with a single audit row", async () => {
    await withTestTransaction(async (tx) => {
      const row = await declare(tx);
      const before = (await incidentAudits(tx, row.id)).length;
      const note = await addIncidentNote({
        ctx: as(memberId, tx),
        input: { id: row.id, message: "Looking at the load balancer" },
      });
      expect(note.type).toBe("note");
      expect((await incidentAudits(tx, row.id)).length).toBe(before);
      await expectAuditRow({
        workspaceId: workspace.id,
        action: "incident_event.create",
        entityType: "incident_event",
        entityId: note.id,
        db: tx,
      });
      await expectInvariant(tx, row.id);
    });
  });

  test("keeps a createdAt inside the window and treats null as now", async () => {
    await withTestTransaction(async (tx) => {
      const row = await declare(tx);
      const saidAt = new Date(Date.now() - 60 * 60 * 1000);
      const backdated = await addIncidentNote({
        ctx: as(memberId, tx),
        input: { id: row.id, message: "an hour ago", createdAt: saidAt },
      });
      // `created_at` is stored in whole seconds.
      expect(
        Math.abs(backdated.createdAt.getTime() - saidAt.getTime()),
      ).toBeLessThan(1000);
      const now = await addIncidentNote({
        ctx: as(memberId, tx),
        input: { id: row.id, message: "now", createdAt: null },
      });
      expect(Math.abs(now.createdAt.getTime() - Date.now())).toBeLessThan(5000);
    });
  });

  test("rejects a createdAt in the future or older than the window", async () => {
    await withTestTransaction(async (tx) => {
      const row = await declare(tx);
      for (const createdAt of [
        new Date(Date.now() + 10 * 60 * 1000),
        new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
      ]) {
        await expect(
          addIncidentNote({
            ctx: as(memberId, tx),
            input: { id: row.id, message: "off the timeline", createdAt },
          }),
        ).rejects.toThrow();
      }
    });
  });

  test("a closed incident takes no notes", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createIncident(
        workspace.id,
        { status: "canceled", closedAt: new Date() },
        tx,
      );
      await expect(
        addIncidentNote({
          ctx: as(memberId, tx),
          input: { id: row.id, message: "late" },
        }),
      ).rejects.toThrow(ConflictError);
    });
  });
});

describe("status report link", () => {
  test("link and unlink, each audited with an event", async () => {
    await withTestTransaction(async (tx) => {
      const row = await declare(tx);
      const report = await tx
        .insert(statusReport)
        .values({
          workspaceId: workspace.id,
          title: "Outage",
          status: "investigating",
        })
        .returning()
        .get();
      const ctx = as(memberId, tx);
      const linked = await linkIncidentStatusReport({
        ctx,
        input: { id: row.id, statusReportId: report.id },
      });
      expect(linked.statusReportId).toBe(report.id);
      const unlinked = await unlinkIncidentStatusReport({
        ctx,
        input: { id: row.id },
      });
      expect(unlinked.statusReportId).toBeNull();
      const types = (await listIncidentEvents({ ctx, input: { id: row.id } }))
        .map((e) => e.type)
        .sort();
      expect(types).toEqual([
        "declared",
        "status_report_linked",
        "status_report_unlinked",
      ]);
      await expectInvariant(tx, row.id);
    });
  });

  test("a report from another workspace is not found", async () => {
    await withTestTransaction(async (tx) => {
      const row = await declare(tx);
      const report = await tx
        .insert(statusReport)
        .values({
          workspaceId: otherWorkspace.id,
          title: "Theirs",
          status: "investigating",
        })
        .returning()
        .get();
      await expect(
        linkIncidentStatusReport({
          ctx: as(memberId, tx),
          input: { id: row.id, statusReportId: report.id },
        }),
      ).rejects.toThrow(NotFoundError);
    });
  });
});

describe("slack channel binding", () => {
  test("bind, conflict on a second incident, unbind even when closed", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = as(memberId, tx);
      const first = await declare(tx);
      const second = await declare(tx);
      const bound = await bindIncidentSlackChannel({
        ctx,
        input: { id: first.id, teamId: "T1", channelId: "C_INC" },
      });
      expect(bound.slackChannelId).toBe("C_INC");
      await expect(
        bindIncidentSlackChannel({
          ctx,
          input: { id: second.id, teamId: "T1", channelId: "C_INC" },
        }),
      ).rejects.toThrow(ConflictError);
      await setIncidentStatus({
        ctx,
        input: { id: first.id, status: "canceled" },
      });
      const unbound = await unbindIncidentSlackChannel({
        ctx,
        input: { id: first.id },
      });
      expect(unbound.slackChannelId).toBeNull();
      await expectInvariant(tx, first.id);
    });
  });
});

describe("closeIncident", () => {
  test("a member who isn't commander cannot close; the commander can", async () => {
    await withTestTransaction(async (tx) => {
      const row = await declareIncident({
        ctx: as(ownerId, tx),
        input: { title: "x", severity: "minor", commanderId: adminId },
      });
      await setIncidentStatus({
        ctx: as(memberId, tx),
        input: { id: row.id, status: "resolved" },
      });
      await expect(
        closeIncident({
          ctx: as(memberId, tx),
          input: { id: row.id, skipPostmortem: true },
        }),
      ).rejects.toThrow(ForbiddenError);
      const closed = await closeIncident({
        ctx: as(adminId, tx),
        input: { id: row.id, skipPostmortem: true },
      });
      expect(closed.closedAt).not.toBeNull();
      await expectInvariant(tx, row.id);
    });
  });

  test("the commander closes even as a plain member", async () => {
    await withTestTransaction(async (tx) => {
      const row = await declare(tx);
      await setIncidentStatus({
        ctx: as(memberId, tx),
        input: { id: row.id, status: "resolved" },
      });
      const closed = await closeIncident({
        ctx: as(memberId, tx),
        input: { id: row.id, skipPostmortem: true },
      });
      expect(closed.closedAt).not.toBeNull();
    });
  });

  test("only a resolved incident closes", async () => {
    await withTestTransaction(async (tx) => {
      const row = await declare(tx);
      await expect(
        closeIncident({
          ctx: as(ownerId, tx),
          input: { id: row.id, skipPostmortem: true },
        }),
      ).rejects.toThrow(ConflictError);
    });
  });
});

describe("deleteIncident", () => {
  test("an admin deletes a fresh incident, timeline included", async () => {
    await withTestTransaction(async (tx) => {
      const row = await declare(tx);
      await deleteIncident({ ctx: as(adminId, tx), input: { id: row.id } });
      expect(await eventCount(tx, row.id)).toBe(0);
      await expectAuditRow({
        workspaceId: workspace.id,
        action: "incident.delete",
        entityType: "incident",
        entityId: row.id,
        db: tx,
      });
      await expect(
        getIncident({ ctx: as(adminId, tx), input: { id: row.id } }),
      ).resolves.toBeUndefined();
    });
  });

  test("a member cannot delete", async () => {
    await withTestTransaction(async (tx) => {
      const row = await declare(tx);
      await expect(
        deleteIncident({ ctx: as(memberId, tx), input: { id: row.id } }),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  test("an incident that was ever mitigated is history", async () => {
    await withTestTransaction(async (tx) => {
      const row = await declare(tx);
      const ctx = as(memberId, tx);
      await setIncidentStatus({
        ctx,
        input: { id: row.id, status: "mitigated" },
      });
      await setIncidentStatus({ ctx, input: { id: row.id, status: "open" } });
      await expect(
        deleteIncident({ ctx: as(ownerId, tx), input: { id: row.id } }),
      ).rejects.toThrow(ConflictError);
    });
  });
});

describe("reads", () => {
  test("list puts open incidents first and filters by status", async () => {
    await withTestTransaction(async (tx) => {
      const resolved = await createIncident(
        workspace.id,
        { status: "resolved", declaredAt: new Date() },
        tx,
      );
      const open = await createIncident(
        workspace.id,
        { status: "open", declaredAt: new Date(Date.now() - 86_400_000) },
        tx,
      );
      const ctx = as(memberId, tx);
      const ids = (await listIncidents({ ctx })).map((i) => i.id);
      expect(ids.indexOf(open.id)).toBeLessThan(ids.indexOf(resolved.id));
      const onlyResolved = await listIncidents({
        ctx,
        input: { status: ["resolved"] },
      });
      expect(onlyResolved.every((i) => i.status === "resolved")).toBe(true);
    });
  });

  test("another workspace's incident is not visible", async () => {
    await withTestTransaction(async (tx) => {
      const theirs = await createIncident(otherWorkspace.id, {}, tx);
      expect(
        await getIncident({ ctx: as(memberId, tx), input: { id: theirs.id } }),
      ).toBeUndefined();
      await expect(
        addIncidentNote({
          ctx: as(memberId, tx),
          input: { id: theirs.id, message: "x" },
        }),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
