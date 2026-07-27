import { eq } from "@openstatus/db";
import { invitation, usersToWorkspaces } from "@openstatus/db/src/schema";
import { createUser } from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";
import { beforeAll, describe, test } from "@std/testing/bdd";

import {
  createWorkspaceFixture,
  expectAuditRow,
  makeApiKeyCtx,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import {
  ForbiddenError,
  LimitExceededError,
  NotFoundError,
} from "../../errors";
import {
  acceptInvitation,
  createInvitation,
  deleteInvitation,
  getInvitationByToken,
  listInvitations,
} from "../index.ts";

const TEST_PREFIX = "svc-inv-test";

let teamCtx: ServiceContext;
let teamUserId: number;
let freeCtx: ServiceContext;
let acceptingUserId: number;

beforeAll(async () => {
  const team = await createWorkspaceFixture("team");
  teamUserId = team.userId;
  teamCtx = makeUserCtx(team.workspace, { userId: teamUserId });

  // The free workspace's owner membership already occupies its single
  // `members: 1` slot, so `createInvitation` reaches the cap.
  const free = await createWorkspaceFixture("free");
  freeCtx = makeUserCtx(free.workspace, { userId: free.userId });

  // `acceptInvitation` inserts a `users_to_workspaces` row, which has an FK
  // on `user.id`.
  acceptingUserId = (await createUser()).id;
});

describe("createInvitation", () => {
  test("creates an invitation scoped to the caller's workspace", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const email = `${TEST_PREFIX}-${Date.now()}@example.com`;
      const row = await createInvitation({
        ctx,
        input: { email },
      });

      expect(row.email).toBe(email);
      expect(row.workspaceId).toBe(teamCtx.workspace.id);
      expect(row.token).toBeDefined();
      expect(row.expiresAt.getTime()).toBeGreaterThan(Date.now());

      await expectAuditRow({
        workspaceId: teamCtx.workspace.id,
        action: "invitation.create",
        entityType: "invitation",
        entityId: row.id,
        db: tx,
      });
    });
  });

  test("rejects read-only actor", async () => {
    await withTestTransaction(async (tx) => {
      const readOnlyCtx = {
        ...makeApiKeyCtx(teamCtx.workspace, {
          keyId: "k-read",
          userId: teamUserId,
          scopes: ["read"],
        }),
        db: tx,
      };
      await expect(
        createInvitation({
          ctx: readOnlyCtx,
          input: { email: "rejects-read@test.dev" },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  test("enforces the members plan cap on free workspace", async () => {
    await withTestTransaction(async (tx) => {
      // Free plan has `members: 1` — the owner already occupies that slot.
      await expect(
        createInvitation({
          ctx: { ...freeCtx, db: tx },
          input: { email: `${TEST_PREFIX}-overflow@example.com` },
        }),
      ).rejects.toBeInstanceOf(LimitExceededError);
    });
  });
});

describe("listInvitations", () => {
  test("returns pending invitations for the workspace only", async () => {
    await withTestTransaction(async (tx) => {
      const teamCtxTx = { ...teamCtx, db: tx };
      const freeCtxTx = { ...freeCtx, db: tx };
      const email = `${TEST_PREFIX}-list-${Date.now()}@example.com`;
      const created = await createInvitation({
        ctx: teamCtxTx,
        input: { email },
      });

      const rows = await listInvitations({ ctx: teamCtxTx });
      const ids = rows.map((r) => r.id);
      expect(ids).toContain(created.id);

      const freeRows = await listInvitations({ ctx: freeCtxTx });
      expect(freeRows.map((r) => r.id)).not.toContain(created.id);
    });
  });
});

describe("getInvitationByToken", () => {
  test("resolves by token + email", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const email = `${TEST_PREFIX}-token-${Date.now()}@example.com`;
      const created = await createInvitation({
        ctx,
        input: { email },
      });

      const row = await getInvitationByToken({
        ctx,
        input: { token: created.token, email },
      });
      expect(row.id).toBe(created.id);
      expect(row.workspace.id).toBe(teamCtx.workspace.id);
    });
  });

  test("rejects a valid token for the wrong email", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const email = `${TEST_PREFIX}-mismatch-${Date.now()}@example.com`;
      const created = await createInvitation({
        ctx,
        input: { email },
      });

      await expect(
        getInvitationByToken({
          ctx,
          input: {
            token: created.token,
            email: `other-${email}`,
          },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});

describe("deleteInvitation", () => {
  test("removes the row and is scoped to the caller's workspace", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const email = `${TEST_PREFIX}-delete-${Date.now()}@example.com`;
      const created = await createInvitation({
        ctx,
        input: { email },
      });

      await deleteInvitation({ ctx, input: { id: created.id } });

      const row = await tx
        .select({ id: invitation.id })
        .from(invitation)
        .where(eq(invitation.id, created.id))
        .get();
      expect(row).toBeUndefined();
    });
  });
});

describe("acceptInvitation", () => {
  test("stamps acceptedAt and inserts a workspace membership", async () => {
    await withTestTransaction(async (tx) => {
      // The user id comes from `ctx.actor`, not from input — so we build
      // a ctx scoped to the accepting user rather than passing an id.
      const email = `${TEST_PREFIX}-accept-${acceptingUserId}-${Date.now()}@example.com`;
      const created = await createInvitation({
        ctx: { ...teamCtx, db: tx },
        input: { email },
      });
      const acceptingCtx = {
        ...makeUserCtx(teamCtx.workspace, { userId: acceptingUserId }),
        db: tx,
      };

      const workspaceRow = await acceptInvitation({
        ctx: acceptingCtx,
        input: { id: created.id, email },
      });
      expect(workspaceRow.id).toBe(teamCtx.workspace.id);

      const updated = await tx
        .select()
        .from(invitation)
        .where(eq(invitation.id, created.id))
        .get();
      expect(updated?.acceptedAt).not.toBeNull();

      const membership = await tx
        .select()
        .from(usersToWorkspaces)
        .where(eq(usersToWorkspaces.userId, acceptingUserId))
        .get();
      expect(membership?.workspaceId).toBe(teamCtx.workspace.id);
    });
  });

  test("throws NotFoundError for an unknown or wrong-email invitation", async () => {
    await withTestTransaction(async (tx) => {
      await expect(
        acceptInvitation({
          ctx: { ...teamCtx, db: tx },
          input: { id: 999_999, email: "nope@example.com" },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
