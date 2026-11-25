import { invitation } from "@openstatus/db/src/schema";
import { beforeAll, describe, expect, test } from "vitest";

import { getInvitation } from "..";
import {
  createWorkspaceFixture,
  makeApiKeyCtx,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { DrizzleTx, ServiceContext } from "../../context";
import { ForbiddenError, NotFoundError } from "../../errors";

let teamCtx: ServiceContext;
let otherCtx: ServiceContext;

beforeAll(async () => {
  teamCtx = makeUserCtx((await createWorkspaceFixture("team")).workspace, {
    userId: 1,
  });
  otherCtx = makeUserCtx((await createWorkspaceFixture("team")).workspace, {
    userId: 2,
  });
});

async function insertInvitation(tx: DrizzleTx, workspaceId: number) {
  const [row] = await tx
    .insert(invitation)
    .values({
      email: `get-inv-${Math.random().toString(36).slice(2, 8)}@acme.com`,
      role: "member",
      workspaceId,
      token: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 86_400_000),
    })
    .returning();
  if (!row) throw new Error("insert returned no row");
  return row;
}

describe("getInvitation", () => {
  test("returns an invitation of the caller's workspace", async () => {
    await withTestTransaction(async (tx) => {
      const inv = await insertInvitation(tx, teamCtx.workspace.id);
      const got = await getInvitation({
        ctx: { ...teamCtx, db: tx },
        input: { id: inv.id },
      });
      expect(got).toMatchObject({
        id: inv.id,
        email: inv.email,
        token: inv.token,
      });
    });
  });

  test("another workspace's invitation is NotFound", async () => {
    await withTestTransaction(async (tx) => {
      const inv = await insertInvitation(tx, otherCtx.workspace.id);
      const err = await getInvitation({
        ctx: { ...teamCtx, db: tx },
        input: { id: inv.id },
      }).catch((e) => e);
      expect(err).toBeInstanceOf(NotFoundError);
      expect((err as NotFoundError).entity).toBe("invitation");
    });
  });

  test("needs admin", async () => {
    await withTestTransaction(async (tx) => {
      const inv = await insertInvitation(tx, teamCtx.workspace.id);
      await expect(
        getInvitation({
          ctx: {
            ...makeApiKeyCtx(teamCtx.workspace, {
              keyId: "k",
              scopes: ["write"],
            }),
            db: tx,
          },
          input: { id: inv.id },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});
