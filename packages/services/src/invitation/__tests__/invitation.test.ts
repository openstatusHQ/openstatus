import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db, eq } from "@openstatus/db";
import { invitation, user, usersToWorkspaces } from "@openstatus/db/src/schema";

import {
  acceptInvitation,
  createInvitation,
  deleteInvitation,
  getInvitationByToken,
  listInvitations,
} from "..";
import {
  SEEDED_WORKSPACE_FREE_ID,
  SEEDED_WORKSPACE_TEAM_ID,
} from "../../../test/fixtures";
import {
  expectAuditRow,
  loadSeededWorkspace,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { LimitExceededError, NotFoundError } from "../../errors";

const TEST_PREFIX = "svc-inv-test";

let teamCtx: ServiceContext;
let freeCtx: ServiceContext;

beforeAll(async () => {
  const team = await loadSeededWorkspace(SEEDED_WORKSPACE_TEAM_ID);
  const free = await loadSeededWorkspace(SEEDED_WORKSPACE_FREE_ID);
  teamCtx = makeUserCtx(team, { userId: 1 });
  freeCtx = makeUserCtx(free, { userId: 2 });

  // Seed membership for the free workspace so the `members: 1` cap
  // can actually be reached by a subsequent `createInvitation` — the
  // shared DB seed only adds a row for workspace 1 (team). Without
  // this, the members-cap assertion below passes against `0 < 1` and
  // never reaches the LimitExceededError branch.
  //
  // `userId: 1` instead of `2` — only user 1 is in the shared seed,
  // and the `user_id` FK on `users_to_workspaces` rejects unknown
  // ids. The cap check just counts rows by `workspace_id`, so which
  // user occupies the slot doesn't matter.
  await db
    .insert(usersToWorkspaces)
    .values({ workspaceId: SEEDED_WORKSPACE_FREE_ID, userId: 1 })
    .onConflictDoNothing();

  // Seed the accepting user for the `acceptInvitation` test below.
  // The test accepts as `userId: 3` and the ensuing
  // `users_to_workspaces` insert has an FK on `user.id` — without a
  // seeded row the insert blows up with a `SQLITE_CONSTRAINT`
  // surfacing as a hook-timeout in the suite. Tear it down in
  // `afterAll` alongside the membership.
  await db
    .insert(user)
    .values({
      id: 3,
      tenantId: "invitation-test-3",
      firstName: "Accept",
      lastName: "Tester",
      email: "accept-tester@example.test",
      photoUrl: "",
    })
    .onConflictDoNothing();
});

afterAll(async () => {
  await db
    .delete(usersToWorkspaces)
    .where(eq(usersToWorkspaces.workspaceId, SEEDED_WORKSPACE_FREE_ID))
    .catch(() => undefined);
  // `acceptInvitation` test seeded user 3 as the accepting user —
  // clean up membership and the user row itself.
  await db
    .delete(usersToWorkspaces)
    .where(eq(usersToWorkspaces.userId, 3))
    .catch(() => undefined);
  await db
    .delete(user)
    .where(eq(user.id, 3))
    .catch(() => undefined);
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
      expect(row.workspaceId).toBe(SEEDED_WORKSPACE_TEAM_ID);
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
      expect(row.workspace.id).toBe(SEEDED_WORKSPACE_TEAM_ID);
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
      const acceptingUserId = 3;
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
      expect(workspaceRow.id).toBe(SEEDED_WORKSPACE_TEAM_ID);

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
      expect(membership?.workspaceId).toBe(SEEDED_WORKSPACE_TEAM_ID);
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
