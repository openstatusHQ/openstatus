import { eq } from "@openstatus/db";
import { incident, slackUser } from "@openstatus/db/src/schema";
import {
  addUserToWorkspace,
  createPage,
  createSlackUser,
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
import type { DB } from "../../context";
import { removeMemberInWorkspace } from "../../member/internal";
import { createStatusReport } from "../../status-report/create";
import { deleteStatusReport } from "../../status-report/delete";
import type { Workspace } from "../../types";
import { deleteAccount } from "../../user/delete";
import {
  closeIncident,
  declareIncident,
  listIncidentEvents,
  setIncidentStatus,
} from "../index";

let workspace: Workspace;
let ownerId: number;
let pageId: number;

beforeAll(async () => {
  const fixture = await createWorkspaceFixture("team");
  workspace = fixture.workspace;
  ownerId = fixture.userId;
  pageId = (await createPage(workspace.id)).id;
});

const as = (userId: number, tx: DB) => ({
  ...makeUserCtx(workspace, { userId }),
  db: tx,
});

async function incidentRow(tx: DB, id: number) {
  return tx.select().from(incident).where(eq(incident.id, id)).get();
}

describe("member removal", () => {
  test("clears the commander of open incidents, keeps closed ones, drops slack links", async () => {
    const leaver = await createUser();
    await addUserToWorkspace(leaver.id, workspace.id, "member");
    await withTestTransaction(async (tx) => {
      const ctx = as(ownerId, tx);
      const open = await declareIncident({
        ctx,
        input: { title: "open", severity: "major", commanderId: leaver.id },
      });
      const closed = await declareIncident({
        ctx,
        input: { title: "closed", severity: "minor", commanderId: leaver.id },
      });
      await setIncidentStatus({
        ctx,
        input: { id: closed.id, status: "resolved" },
      });
      await closeIncident({ ctx, input: { id: closed.id } });
      const link = await createSlackUser(workspace.id, leaver.id, {}, tx);

      await removeMemberInWorkspace({ tx, ctx, userId: leaver.id });

      expect((await incidentRow(tx, open.id))?.commanderId).toBeNull();
      expect((await incidentRow(tx, closed.id))?.commanderId).toBe(leaver.id);
      const events = await listIncidentEvents({ ctx, input: { id: open.id } });
      expect(events[0].type).toBe("commander_changed");
      expect(events[0].createdBy).toBe(ownerId);
      expect(
        await tx
          .select()
          .from(slackUser)
          .where(eq(slackUser.id, link.id))
          .get(),
      ).toBeUndefined();
    });
  });
});

describe("account deletion", () => {
  test("clears the deleted user's commands and slack links", async () => {
    const leaver = await createUser();
    await addUserToWorkspace(leaver.id, workspace.id, "member");
    await withTestTransaction(async (tx) => {
      const open = await declareIncident({
        ctx: as(ownerId, tx),
        input: { title: "open", severity: "major", commanderId: leaver.id },
      });
      await createSlackUser(workspace.id, leaver.id, {}, tx);
      await deleteAccount({ ctx: as(leaver.id, tx) });
      expect((await incidentRow(tx, open.id))?.commanderId).toBeNull();
      expect(
        await tx
          .select()
          .from(slackUser)
          .where(eq(slackUser.userId, leaver.id))
          .all(),
      ).toHaveLength(0);
    });
  });
});

describe("status reports", () => {
  test("creating a report for an incident links it in the same transaction", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = as(ownerId, tx);
      const inc = await declareIncident({
        ctx,
        input: { title: "API", severity: "major" },
      });
      const { statusReport } = await createStatusReport({
        ctx,
        input: {
          title: "API degraded",
          status: "investigating",
          message: "Looking into it",
          date: new Date(),
          pageId,
          pageComponentIds: [],
          incidentId: inc.id,
        },
      });
      expect((await incidentRow(tx, inc.id))?.statusReportId).toBe(
        statusReport.id,
      );
    });
  });

  test("deleting a linked report unlinks the incident, audited", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = as(ownerId, tx);
      const inc = await declareIncident({
        ctx,
        input: { title: "API", severity: "major" },
      });
      const { statusReport } = await createStatusReport({
        ctx,
        input: {
          title: "API degraded",
          status: "investigating",
          message: "Looking into it",
          date: new Date(),
          pageId,
          pageComponentIds: [],
          incidentId: inc.id,
        },
      });
      await deleteStatusReport({ ctx, input: { id: statusReport.id } });
      expect((await incidentRow(tx, inc.id))?.statusReportId).toBeNull();
      const events = await listIncidentEvents({ ctx, input: { id: inc.id } });
      expect(events[0].type).toBe("status_report_unlinked");
      await expectAuditRow({
        workspaceId: workspace.id,
        action: "incident.update",
        entityType: "incident",
        entityId: inc.id,
        db: tx,
      });
    });
  });
});
