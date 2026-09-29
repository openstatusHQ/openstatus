import { db } from "@openstatus/db";
import {
  addUserToWorkspace,
  createUser,
} from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";
import { beforeAll, describe, test } from "@std/testing/bdd";

import {
  createWorkspaceFixture,
  makeApiKeyCtx,
  makeSlackCtx,
  makeSystemCtx,
  makeUserCtx,
} from "../../../test/helpers";
import { ForbiddenError } from "../../errors";
import type { Workspace } from "../../types";
import { requireRole } from "../require-role";

let workspace: Workspace;
let ownerId: number;
let adminId: number;
let memberId: number;
let outsiderId: number;

beforeAll(async () => {
  const fixture = await createWorkspaceFixture("team");
  workspace = fixture.workspace;
  ownerId = fixture.userId;
  adminId = (await createUser()).id;
  memberId = (await createUser()).id;
  outsiderId = (await createUser()).id;
  await addUserToWorkspace(adminId, workspace.id, "admin");
  await addUserToWorkspace(memberId, workspace.id, "member");
});

describe("requireRole", () => {
  test("user with an allowed role passes", async () => {
    await requireRole(db, makeUserCtx(workspace, { userId: ownerId }), [
      "owner",
      "admin",
    ]);
    await requireRole(db, makeUserCtx(workspace, { userId: adminId }), [
      "owner",
      "admin",
    ]);
  });

  test("member is rejected from an admin-only check", async () => {
    await expect(
      requireRole(db, makeUserCtx(workspace, { userId: memberId }), [
        "owner",
        "admin",
      ]),
    ).rejects.toThrow(ForbiddenError);
  });

  test("orUserId lets the named user through", async () => {
    await requireRole(
      db,
      makeUserCtx(workspace, { userId: memberId }),
      ["owner", "admin"],
      { orUserId: memberId },
    );
  });

  test("non-member is rejected even from member-level checks", async () => {
    await expect(
      requireRole(db, makeUserCtx(workspace, { userId: outsiderId }), [
        "owner",
        "admin",
        "member",
      ]),
    ).rejects.toThrow(ForbiddenError);
  });

  test("slack actor resolves through its linked user", async () => {
    const ctx = makeSlackCtx(workspace, {
      teamId: "T1",
      slackUserId: "U1",
      userId: adminId,
    });
    await requireRole(db, ctx, ["owner", "admin"]);
  });

  test("api key without a user passes member-level only", async () => {
    const ctx = makeApiKeyCtx(workspace, { keyId: "k1" });
    await requireRole(db, ctx, ["owner", "admin", "member"]);
    await expect(requireRole(db, ctx, ["owner", "admin"])).rejects.toThrow(
      ForbiddenError,
    );
  });

  test("system always passes", async () => {
    await requireRole(db, makeSystemCtx(workspace, { job: "test" }), ["owner"]);
  });
});
