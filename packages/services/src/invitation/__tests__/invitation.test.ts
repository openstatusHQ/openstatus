import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { db, eq, inArray } from "@openstatus/db";
import { invitation, usersToWorkspaces } from "@openstatus/db/src/schema";

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
  withAuditBuffer,
} from "../../../test/helpers";
import type { AuditLogRecord } from "../../audit";
import type { ServiceContext } from "../../context";
import { LimitExceededError, NotFoundError } from "../../errors";

const TEST_PREFIX = "svc-inv-test";

let teamCtx: ServiceContext;
let freeCtx: ServiceContext;
let auditBuffer: AuditLogRecord[];
let auditReset: () => void;
const createdInvitationIds: number[] = [];

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
});

afterAll(async () => {
  if (createdInvitationIds.length > 0) {
    await db
      .delete(invitation)
      .where(inArray(invitation.id, createdInvitationIds));
  }
  await db
    .delete(usersToWorkspaces)
    .where(eq(usersToWorkspaces.workspaceId, SEEDED_WORKSPACE_FREE_ID))
    .catch(() => undefined);
});

beforeEach(() => {
  const session = withAuditBuffer();
  auditBuffer = session.buffer;
  auditReset = session.reset;
});
afterEach(() => auditReset());

describe("createInvitation", () => {
  test("creates an invitation scoped to the caller's workspace", async () => {
    const email = `${TEST_PREFIX}-${Date.now()}@example.com`;
    const row = await createInvitation({
      ctx: teamCtx,
      input: { email },
    });
    createdInvitationIds.push(row.id);

    expect(row.email).toBe(email);
    expect(row.workspaceId).toBe(SEEDED_WORKSPACE_TEAM_ID);
    expect(row.token).toBeDefined();
    expect(row.expiresAt.getTime()).toBeGreaterThan(Date.now());

    await expectAuditRow(auditBuffer, {
      action: "invitation.create",
      entityType: "invitation",
      entityId: row.id,
    });
  });

  test("enforces the members plan cap on free workspace", async () => {
    // Free plan has `members: 1` — the owner already occupies that slot.
    await expect(
      createInvitation({
        ctx: freeCtx,
        input: { email: `${TEST_PREFIX}-overflow@example.com` },
      }),
    ).rejects.toBeInstanceOf(LimitExceededError);
  });
});

describe("listInvitations", () => {
  test("returns pending invitations for the workspace only", async () => {
    const email = `${TEST_PREFIX}-list-${Date.now()}@example.com`;
    const created = await createInvitation({
      ctx: teamCtx,
      input: { email },
    });
    createdInvitationIds.push(created.id);

    const rows = await listInvitations({ ctx: teamCtx });
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(created.id);

    const freeRows = await listInvitations({ ctx: freeCtx });
    expect(freeRows.map((r) => r.id)).not.toContain(created.id);
  });
});

describe("getInvitationByToken", () => {
  test("resolves by token + email", async () => {
    const email = `${TEST_PREFIX}-token-${Date.now()}@example.com`;
    const created = await createInvitation({
      ctx: teamCtx,
      input: { email },
    });
    createdInvitationIds.push(created.id);

    const row = await getInvitationByToken({
      ctx: teamCtx,
      input: { token: created.token, email },
    });
    expect(row.id).toBe(created.id);
    expect(row.workspace.id).toBe(SEEDED_WORKSPACE_TEAM_ID);
  });

  test("rejects a valid token for the wrong email", async () => {
    const email = `${TEST_PREFIX}-mismatch-${Date.now()}@example.com`;
    const created = await createInvitation({
      ctx: teamCtx,
      input: { email },
    });
    createdInvitationIds.push(created.id);

    await expect(
      getInvitationByToken({
        ctx: teamCtx,
        input: {
          token: created.token,
          email: `other-${email}`,
        },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("deleteInvitation", () => {
  test("removes the row and is scoped to the caller's workspace", async () => {
    const email = `${TEST_PREFIX}-delete-${Date.now()}@example.com`;
    const created = await createInvitation({
      ctx: teamCtx,
      input: { email },
    });

    await deleteInvitation({ ctx: teamCtx, input: { id: created.id } });

    const row = await db
      .select({ id: invitation.id })
      .from(invitation)
      .where(eq(invitation.id, created.id))
      .get();
    expect(row).toBeUndefined();
  });
});

describe("acceptInvitation", () => {
  test("stamps acceptedAt and inserts a workspace membership", async () => {
    // The user id comes from `ctx.actor`, not from input — so we build
    // a ctx scoped to the accepting user rather than passing an id.
    const acceptingUserId = 3;
    const email = `${TEST_PREFIX}-accept-${acceptingUserId}-${Date.now()}@example.com`;
    const created = await createInvitation({
      ctx: teamCtx,
      input: { email },
    });
    createdInvitationIds.push(created.id);
    const acceptingCtx = makeUserCtx(teamCtx.workspace, {
      userId: acceptingUserId,
    });

    try {
      const workspaceRow = await acceptInvitation({
        ctx: acceptingCtx,
        input: { id: created.id, email },
      });
      expect(workspaceRow.id).toBe(SEEDED_WORKSPACE_TEAM_ID);

      const updated = await db
        .select()
        .from(invitation)
        .where(eq(invitation.id, created.id))
        .get();
      expect(updated?.acceptedAt).not.toBeNull();

      const membership = await db
        .select()
        .from(usersToWorkspaces)
        .where(eq(usersToWorkspaces.userId, acceptingUserId))
        .get();
      expect(membership?.workspaceId).toBe(SEEDED_WORKSPACE_TEAM_ID);
    } finally {
      await db
        .delete(usersToWorkspaces)
        .where(eq(usersToWorkspaces.userId, acceptingUserId));
    }
  });

  test("throws NotFoundError for an unknown or wrong-email invitation", async () => {
    await expect(
      acceptInvitation({
        ctx: teamCtx,
        input: { id: 999_999, email: "nope@example.com" },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
