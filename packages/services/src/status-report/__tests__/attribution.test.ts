import { db, eq } from "@openstatus/db";
import {
  page,
  statusReport,
  statusReportUpdate,
} from "@openstatus/db/src/schema";
import { createUser } from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";
import { beforeAll, describe, test } from "@std/testing/bdd";

import {
  createWorkspaceFixture,
  makeApiKeyCtx,
  makeSystemCtx,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { DB, ServiceContext } from "../../context";
import { addStatusReportUpdate } from "../add-update";
import { createStatusReport } from "../create";
import { deleteStatusReportUpdate } from "../delete";
import { getStatusReport } from "../list";
import { updateStatusReport, updateStatusReportUpdate } from "../update";

const TEST_PREFIX = "svc-status-report-attribution";

let teamCtx: ServiceContext;
let ownerId: number;
let pageId: number;

beforeAll(async () => {
  const fixture = await createWorkspaceFixture("team");
  ownerId = fixture.userId;
  teamCtx = makeUserCtx(fixture.workspace, { userId: ownerId });
  const row = await db
    .insert(page)
    .values({
      workspaceId: fixture.workspace.id,
      title: `${TEST_PREFIX}-page`,
      description: "",
      slug: `${TEST_PREFIX}-${fixture.workspace.id}`,
      customDomain: "",
    })
    .returning()
    .get();
  pageId = row.id;
});

async function create(ctx: ServiceContext, title: string) {
  return createStatusReport({
    ctx,
    input: {
      title: `${TEST_PREFIX}-${title}`,
      status: "investigating",
      message: "m",
      date: new Date(),
      pageId,
      pageComponentIds: [],
    },
  });
}

async function readReport(tx: DB, id: number) {
  const row = await tx
    .select()
    .from(statusReport)
    .where(eq(statusReport.id, id))
    .get();
  if (!row) throw new Error(`report ${id} missing`);
  return row;
}

async function readUpdate(tx: DB, id: number) {
  const row = await tx
    .select()
    .from(statusReportUpdate)
    .where(eq(statusReportUpdate.id, id))
    .get();
  if (!row) throw new Error(`update ${id} missing`);
  return row;
}

describe("status report attribution", () => {
  test("user actor stamps report and initial update", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { statusReport: report, initialUpdate } = await create(ctx, "user");

      expect(report.createdBy).toBe(ownerId);
      expect(report.updatedBy).toBe(ownerId);
      expect(initialUpdate.createdBy).toBe(ownerId);
      expect(initialUpdate.updatedBy).toBe(ownerId);

      const full = await getStatusReport({ ctx, input: { id: report.id } });
      expect(full.createdByUser).toEqual({ id: ownerId, name: "Test User" });
      expect(full.updatedByUser).toEqual({ id: ownerId, name: "Test User" });
      expect(full.updates[0].createdByUser).toEqual({
        id: ownerId,
        name: "Test User",
      });
    });
  });

  test("api key with a user stamps; without a user leaves NULL", async () => {
    await withTestTransaction(async (tx) => {
      const withUser = {
        ...makeApiKeyCtx(teamCtx.workspace, {
          keyId: "k-user",
          userId: ownerId,
          scopes: ["write"],
        }),
        db: tx,
      };
      const { statusReport: stamped } = await create(withUser, "key-user");
      expect(stamped.createdBy).toBe(ownerId);

      const withoutUser = {
        ...makeApiKeyCtx(teamCtx.workspace, {
          keyId: "k-anon",
          scopes: ["write"],
        }),
        db: tx,
      };
      const { statusReport: anonymous, initialUpdate } = await create(
        withoutUser,
        "key-anon",
      );
      expect(anonymous.createdBy).toBeNull();
      expect(anonymous.updatedBy).toBeNull();
      expect(initialUpdate.createdBy).toBeNull();

      const full = await getStatusReport({
        ctx: withoutUser,
        input: { id: anonymous.id },
      });
      expect(full.createdByUser).toBeNull();
      expect(full.updatedByUser).toBeNull();
    });
  });

  test("system actor leaves NULL", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = {
        ...makeSystemCtx(teamCtx.workspace, { job: "test" }),
        db: tx,
      };
      const { statusReport: report, initialUpdate } = await create(
        ctx,
        "system",
      );
      expect(report.createdBy).toBeNull();
      expect(initialUpdate.createdBy).toBeNull();
    });
  });

  test("edits move updated_by but keep created_by", async () => {
    await withTestTransaction(async (tx) => {
      const editor = await createUser({}, tx);
      const creatorCtx = { ...teamCtx, db: tx };
      const editorCtx = {
        ...makeUserCtx(teamCtx.workspace, { userId: editor.id }),
        db: tx,
      };
      const { statusReport: report, initialUpdate } = await create(
        creatorCtx,
        "edits",
      );

      // adding an update stamps the update and touches the report
      const { statusReportUpdate: added } = await addStatusReportUpdate({
        ctx: editorCtx,
        input: {
          statusReportId: report.id,
          status: "identified",
          message: "found it",
        },
      });
      expect(added.createdBy).toBe(editor.id);
      expect(added.updatedBy).toBe(editor.id);
      let current = await readReport(tx, report.id);
      expect(current.createdBy).toBe(ownerId);
      expect(current.updatedBy).toBe(editor.id);

      // editing the report's metadata
      await updateStatusReport({
        ctx: creatorCtx,
        input: { id: report.id, title: `${TEST_PREFIX}-renamed` },
      });
      current = await readReport(tx, report.id);
      expect(current.updatedBy).toBe(ownerId);

      // editing an update row
      await updateStatusReportUpdate({
        ctx: editorCtx,
        input: { id: initialUpdate.id, message: "reworded" },
      });
      const edited = await readUpdate(tx, initialUpdate.id);
      expect(edited.createdBy).toBe(ownerId);
      expect(edited.updatedBy).toBe(editor.id);

      // deleting the latest update is an edit of the report
      await deleteStatusReportUpdate({
        ctx: editorCtx,
        input: { id: added.id },
      });
      current = await readReport(tx, report.id);
      expect(current.status).toBe("investigating");
      expect(current.updatedBy).toBe(editor.id);

      // same even when the status does not change
      const { statusReportUpdate: repeated } = await addStatusReportUpdate({
        ctx: creatorCtx,
        input: {
          statusReportId: report.id,
          status: "investigating",
          message: "still looking",
        },
      });
      current = await readReport(tx, report.id);
      expect(current.updatedBy).toBe(ownerId);
      await deleteStatusReportUpdate({
        ctx: editorCtx,
        input: { id: repeated.id },
      });
      current = await readReport(tx, report.id);
      expect(current.status).toBe("investigating");
      expect(current.updatedBy).toBe(editor.id);
    });
  });

  test("soft-deleted author reads as 'Deleted user'", async () => {
    await withTestTransaction(async (tx) => {
      const gone = await createUser(
        {
          name: "",
          firstName: "",
          lastName: "",
          email: "",
          deletedAt: new Date(),
        },
        tx,
      );
      const ctx = {
        ...makeUserCtx(teamCtx.workspace, { userId: gone.id }),
        db: tx,
      };
      const { statusReport: report } = await create(ctx, "deleted");
      const full = await getStatusReport({ ctx, input: { id: report.id } });
      expect(full.createdByUser).toEqual({ id: gone.id, name: "Deleted user" });
    });
  });
});
