import { eq } from "@openstatus/db";
import { user } from "@openstatus/db/src/schema";
import {
  addUserToWorkspace,
  createUser,
} from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";
import { beforeAll, describe, test } from "@std/testing/bdd";

import {
  createWorkspaceFixture,
  expectAuditRow,
  makeSystemCtx,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import { ForbiddenError } from "../../errors";
import type { Workspace } from "../../types";
import {
  createSlackUserMapping,
  deleteSlackUserMappings,
  getSlackUserMapping,
} from "../index";

let workspace: Workspace;
let memberId: number;

beforeAll(async () => {
  const fixture = await createWorkspaceFixture("team");
  workspace = fixture.workspace;
  memberId = (await createUser()).id;
  await addUserToWorkspace(memberId, workspace.id, "member");
});

describe("slack user mapping", () => {
  test("create + get round-trip, audited", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...makeSystemCtx(workspace, { job: "test" }), db: tx };
      const row = await createSlackUserMapping({
        ctx,
        input: { teamId: "T1", slackUserId: "U1", userId: memberId },
      });
      expect(
        await getSlackUserMapping({
          ctx,
          input: { teamId: "T1", slackUserId: "U1" },
        }),
      ).toBe(memberId);
      await expectAuditRow({
        workspaceId: workspace.id,
        action: "slack_user.create",
        entityType: "slack_user",
        entityId: row.id,
        actorType: "system",
        db: tx,
      });
    });
  });

  test("re-linking to another member replaces the row", async () => {
    const other = await createUser();
    await addUserToWorkspace(other.id, workspace.id, "member");
    await withTestTransaction(async (tx) => {
      const ctx = { ...makeSystemCtx(workspace, { job: "test" }), db: tx };
      const first = await createSlackUserMapping({
        ctx,
        input: { teamId: "T2", slackUserId: "U2", userId: memberId },
      });
      await createSlackUserMapping({
        ctx,
        input: { teamId: "T2", slackUserId: "U2", userId: other.id },
      });
      expect(
        await getSlackUserMapping({
          ctx,
          input: { teamId: "T2", slackUserId: "U2" },
        }),
      ).toBe(other.id);
      await expectAuditRow({
        workspaceId: workspace.id,
        action: "slack_user.delete",
        entityType: "slack_user",
        entityId: first.id,
        db: tx,
      });
    });
  });

  test("rejects a user who is not a member", async () => {
    const outsider = await createUser();
    await withTestTransaction(async (tx) => {
      const ctx = {
        ...makeUserCtx(workspace, { userId: outsider.id }),
        db: tx,
      };
      await expect(
        createSlackUserMapping({
          ctx,
          input: { teamId: "T3", slackUserId: "U3", userId: outsider.id },
        }),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  test("a deleted user no longer resolves", async () => {
    const gone = await createUser();
    await addUserToWorkspace(gone.id, workspace.id, "member");
    await withTestTransaction(async (tx) => {
      const ctx = { ...makeSystemCtx(workspace, { job: "test" }), db: tx };
      await createSlackUserMapping({
        ctx,
        input: { teamId: "T4", slackUserId: "U4", userId: gone.id },
      });
      await tx
        .update(user)
        .set({ deletedAt: new Date() })
        .where(eq(user.id, gone.id));
      expect(
        await getSlackUserMapping({
          ctx,
          input: { teamId: "T4", slackUserId: "U4" },
        }),
      ).toBeNull();
    });
  });

  test("deleteSlackUserMappings by user removes and audits each row", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...makeSystemCtx(workspace, { job: "test" }), db: tx };
      await createSlackUserMapping({
        ctx,
        input: { teamId: "T5", slackUserId: "U5", userId: memberId },
      });
      const count = await deleteSlackUserMappings({
        tx,
        ctx,
        where: { userId: memberId },
      });
      expect(count).toBeGreaterThanOrEqual(1);
      expect(
        await getSlackUserMapping({
          ctx,
          input: { teamId: "T5", slackUserId: "U5" },
        }),
      ).toBeNull();
    });
  });
});
