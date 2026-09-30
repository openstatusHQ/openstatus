import { and, eq, sql } from "@openstatus/db";
import { auditLog, incidentEvent } from "@openstatus/db/src/schema";
import {
  addUserToWorkspace,
  createUser,
} from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";
import { beforeAll, describe, test } from "@std/testing/bdd";

import {
  createWorkspaceFixture,
  expectAuditRow,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { DB, ServiceContext } from "../../context";
import { ConflictError, ForbiddenError } from "../../errors";
import type { Workspace } from "../../types";
import {
  approvePostmortem,
  closeIncident,
  declareIncident,
  draftPostmortem,
  getIncident,
  getPostmortem,
  setIncidentStatus,
} from "../index";

let workspace: Workspace;
let ownerId: number;
let memberId: number;

beforeAll(async () => {
  const fixture = await createWorkspaceFixture("team");
  workspace = fixture.workspace;
  ownerId = fixture.userId;
  memberId = (await createUser()).id;
  await addUserToWorkspace(memberId, workspace.id, "member");
});

const as = (userId: number, tx: DB): ServiceContext => ({
  ...makeUserCtx(workspace, { userId }),
  db: tx,
});

async function resolved(tx: DB) {
  const row = await declareIncident({
    ctx: as(memberId, tx),
    input: { title: "API down", severity: "major", commanderId: ownerId },
  });
  await setIncidentStatus({
    ctx: as(memberId, tx),
    input: { id: row.id, status: "resolved" },
  });
  return row;
}

async function eventTypes(tx: DB, incidentId: number) {
  const rows = await tx
    .select({ type: incidentEvent.type })
    .from(incidentEvent)
    .where(eq(incidentEvent.incidentId, incidentId))
    .all();
  return rows.map((r) => r.type);
}

async function eventAudits(tx: DB, incidentId: number) {
  const rows = await tx
    .select({ id: auditLog.id })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.action, "incident_event.create"),
        sql`json_extract(${auditLog.metadata}, '$.incidentId') = ${incidentId}`,
      ),
    )
    .all();
  return rows.length;
}

describe("postmortem", () => {
  test("draft, redraft, approve and close; every event audited", async () => {
    await withTestTransaction(async (tx) => {
      const row = await resolved(tx);
      const draft = await draftPostmortem({
        ctx: as(memberId, tx),
        input: {
          id: row.id,
          content: "## Summary\n\nFirst",
          draftedBy: "agent",
          sourceTranscript: "U1: it's down",
        },
      });
      expect(draft.status).toBe("draft");
      expect(draft.createdBy).toBe(memberId);
      await expectAuditRow({
        workspaceId: workspace.id,
        action: "incident_postmortem.create",
        entityType: "incident_postmortem",
        entityId: draft.id,
        db: tx,
      });

      const redraft = await draftPostmortem({
        ctx: as(ownerId, tx),
        input: { id: row.id, content: "## Summary\n\nSecond" },
      });
      expect(redraft.id).toBe(draft.id);
      expect(redraft.sourceTranscript).toBe("U1: it's down");
      expect(redraft.updatedBy).toBe(ownerId);

      await expect(
        closeIncident({ ctx: as(ownerId, tx), input: { id: row.id } }),
      ).rejects.toThrow(ConflictError);

      const approved = await approvePostmortem({
        ctx: as(ownerId, tx),
        input: { id: row.id, close: true },
      });
      expect(approved.status).toBe("approved");
      expect(approved.approvedBy).toBe(ownerId);
      expect(
        (await getIncident({ ctx: as(ownerId, tx), input: { id: row.id } }))
          ?.closedAt,
      ).not.toBeNull();

      const types = await eventTypes(tx, row.id);
      expect(types).toContain("postmortem_drafted");
      expect(types).toContain("postmortem_approved");
      expect(types).toContain("closed");
      expect(await eventAudits(tx, row.id)).toBe(types.length);
    });
  });

  test("editing an approved postmortem keeps it approved; the agent can't redraft it", async () => {
    await withTestTransaction(async (tx) => {
      const row = await resolved(tx);
      await draftPostmortem({
        ctx: as(memberId, tx),
        input: { id: row.id, content: "v1" },
      });
      await approvePostmortem({
        ctx: as(ownerId, tx),
        input: { id: row.id },
      });
      const edited = await draftPostmortem({
        ctx: as(memberId, tx),
        input: { id: row.id, content: "v2" },
      });
      expect(edited.status).toBe("approved");
      expect(edited.content).toBe("v2");
      expect(await eventTypes(tx, row.id)).toContain("postmortem_updated");
      await expect(
        draftPostmortem({
          ctx: as(memberId, tx),
          input: { id: row.id, content: "v3", draftedBy: "agent" },
        }),
      ).rejects.toThrow(ConflictError);
      expect(
        (await getPostmortem({ ctx: as(memberId, tx), input: { id: row.id } }))
          ?.content,
      ).toBe("v2");
    });
  });

  test("only admin, owner or the commander approves", async () => {
    await withTestTransaction(async (tx) => {
      const row = await resolved(tx);
      await draftPostmortem({
        ctx: as(memberId, tx),
        input: { id: row.id, content: "v1" },
      });
      await expect(
        approvePostmortem({ ctx: as(memberId, tx), input: { id: row.id } }),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  test("a reopened incident can't have its postmortem approved", async () => {
    await withTestTransaction(async (tx) => {
      const row = await resolved(tx);
      await draftPostmortem({
        ctx: as(memberId, tx),
        input: { id: row.id, content: "v1" },
      });
      await setIncidentStatus({
        ctx: as(memberId, tx),
        input: { id: row.id, status: "open" },
      });
      await expect(
        approvePostmortem({
          ctx: as(ownerId, tx),
          input: { id: row.id, close: false },
        }),
      ).rejects.toThrow(ConflictError);
    });
  });

  test("an unresolved incident has no postmortem yet", async () => {
    await withTestTransaction(async (tx) => {
      const row = await declareIncident({
        ctx: as(memberId, tx),
        input: { title: "x", severity: "minor" },
      });
      await expect(
        draftPostmortem({
          ctx: as(memberId, tx),
          input: { id: row.id, content: "too early" },
        }),
      ).rejects.toThrow(ConflictError);
    });
  });
});
