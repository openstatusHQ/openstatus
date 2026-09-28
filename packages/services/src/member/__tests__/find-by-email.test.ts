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
  makeSystemCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { findMemberIdByEmail } from "../index.ts";

let ctx: ServiceContext;
let workspaceId: number;
let MEMBER_ID: number;
let MEMBER_EMAIL: string;

beforeAll(async () => {
  const fixture = await createWorkspaceFixture("team");
  workspaceId = fixture.workspace.id;
  ctx = makeSystemCtx(fixture.workspace, { job: "slack-user-automap" });
  const member = await createUser({
    email: `Mixed.Case-${Date.now()}@Example.com`,
  });
  MEMBER_ID = member.id;
  MEMBER_EMAIL = member.email as string;
  await addUserToWorkspace(MEMBER_ID, workspaceId, "member");
});

describe("findMemberIdByEmail", () => {
  test("matches case-insensitively", async () => {
    expect(
      await findMemberIdByEmail({
        ctx,
        input: { email: ` ${MEMBER_EMAIL.toUpperCase()} ` },
      }),
    ).toBe(MEMBER_ID);
  });

  test("returns null for a user with the email who is not a member here", async () => {
    const outsider = await createUser();
    expect(
      await findMemberIdByEmail({
        ctx,
        input: { email: outsider.email as string },
      }),
    ).toBeNull();
  });

  test("returns null when two members share the email", async () => {
    await withTestTransaction(async (tx) => {
      const twin = await createUser({ email: MEMBER_EMAIL.toLowerCase() }, tx);
      await addUserToWorkspace(twin.id, workspaceId, "member", tx);
      expect(
        await findMemberIdByEmail({
          ctx: { ...ctx, db: tx },
          input: { email: MEMBER_EMAIL },
        }),
      ).toBeNull();
    });
  });

  test("ignores soft-deleted members", async () => {
    await withTestTransaction(async (tx) => {
      const gone = await createUser(
        { email: `gone-${Date.now()}@example.com` },
        tx,
      );
      await addUserToWorkspace(gone.id, workspaceId, "member", tx);
      await tx
        .update(user)
        .set({ deletedAt: new Date() })
        .where(eq(user.id, gone.id));
      expect(
        await findMemberIdByEmail({
          ctx: { ...ctx, db: tx },
          input: { email: gone.email as string },
        }),
      ).toBeNull();
    });
  });

  test("never matches an empty email", async () => {
    await withTestTransaction(async (tx) => {
      const blank = await createUser({ email: "" }, tx);
      await addUserToWorkspace(blank.id, workspaceId, "member", tx);
      expect(
        await findMemberIdByEmail({
          ctx: { ...ctx, db: tx },
          input: { email: "   " },
        }),
      ).toBeNull();
    });
  });
});
