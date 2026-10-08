import {
  addUserToWorkspace,
  createUser,
} from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";
import { beforeAll, describe, test } from "@std/testing/bdd";

import { createWorkspaceFixture, makeSystemCtx } from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { getMemberDisplayName } from "../index.ts";

let ctx: ServiceContext;
let workspaceId: number;

beforeAll(async () => {
  const fixture = await createWorkspaceFixture("team");
  workspaceId = fixture.workspace.id;
  ctx = makeSystemCtx(fixture.workspace, { job: "slack-user-automap" });
});

describe("getMemberDisplayName", () => {
  test("prefers the explicit name over first and last", async () => {
    const member = await createUser({ name: "Max K." });
    await addUserToWorkspace(member.id, workspaceId, "member");
    expect(
      await getMemberDisplayName({ ctx, input: { userId: member.id } }),
    ).toBe("Max K.");
  });

  test("falls back to first and last name", async () => {
    const member = await createUser({ name: null });
    await addUserToWorkspace(member.id, workspaceId, "member");
    expect(
      await getMemberDisplayName({ ctx, input: { userId: member.id } }),
    ).toBe("Test User");
  });

  test("returns null for a user who is not a member here", async () => {
    const outsider = await createUser();
    expect(
      await getMemberDisplayName({ ctx, input: { userId: outsider.id } }),
    ).toBeNull();
  });
});
