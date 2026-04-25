import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { and, db, eq } from "@openstatus/db";
import { user, usersToWorkspaces } from "@openstatus/db/src/schema";

import { deleteMember, listMembers } from "..";
import {
  SEEDED_WORKSPACE_FREE_ID,
  SEEDED_WORKSPACE_TEAM_ID,
} from "../../../test/fixtures";
import {
  clearAuditLog,
  expectAuditRow,
  loadSeededWorkspace,
  makeSystemCtx,
  makeUserCtx,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { NotFoundError, PreconditionFailedError } from "../../errors";

const OWNER_USER_ID = 1;
const VICTIM_USER_ID = 4242;
const NON_OWNER_USER_ID = 4243;

let teamCtx: ServiceContext;

beforeAll(async () => {
  const team = await loadSeededWorkspace(SEEDED_WORKSPACE_TEAM_ID);
  teamCtx = makeUserCtx(team, { userId: OWNER_USER_ID });

  // Two synthetic users + memberships scoped to the team workspace.
  // The seed only carries user 1; we need a victim and a non-owner
  // distinct from the caller for the role-check branches.
  await db
    .insert(user)
    .values([
      {
        id: VICTIM_USER_ID,
        tenantId: "member-test-victim",
        firstName: "Victim",
        lastName: "Member",
        email: "member-victim@example.test",
        photoUrl: "",
      },
      {
        id: NON_OWNER_USER_ID,
        tenantId: "member-test-nonowner",
        firstName: "NonOwner",
        lastName: "Member",
        email: "member-nonowner@example.test",
        photoUrl: "",
      },
    ])
    .onConflictDoNothing();

  // Caller (owner) — already in seed for workspace 1, but the seed's
  // `users_to_workspaces` row may have a non-owner role; force `owner`.
  await db
    .insert(usersToWorkspaces)
    .values({
      workspaceId: SEEDED_WORKSPACE_TEAM_ID,
      userId: OWNER_USER_ID,
      role: "owner",
    })
    .onConflictDoUpdate({
      target: [usersToWorkspaces.userId, usersToWorkspaces.workspaceId],
      set: { role: "owner" },
    });

  await db
    .insert(usersToWorkspaces)
    .values([
      {
        workspaceId: SEEDED_WORKSPACE_TEAM_ID,
        userId: VICTIM_USER_ID,
        role: "member",
      },
      {
        workspaceId: SEEDED_WORKSPACE_TEAM_ID,
        userId: NON_OWNER_USER_ID,
        role: "member",
      },
    ])
    .onConflictDoNothing();
});

afterAll(async () => {
  await db
    .delete(usersToWorkspaces)
    .where(
      and(
        eq(usersToWorkspaces.workspaceId, SEEDED_WORKSPACE_TEAM_ID),
        eq(usersToWorkspaces.userId, VICTIM_USER_ID),
      ),
    )
    .catch(() => undefined);
  await db
    .delete(usersToWorkspaces)
    .where(
      and(
        eq(usersToWorkspaces.workspaceId, SEEDED_WORKSPACE_TEAM_ID),
        eq(usersToWorkspaces.userId, NON_OWNER_USER_ID),
      ),
    )
    .catch(() => undefined);
  await db
    .delete(user)
    .where(eq(user.id, VICTIM_USER_ID))
    .catch(() => undefined);
  await db
    .delete(user)
    .where(eq(user.id, NON_OWNER_USER_ID))
    .catch(() => undefined);
});

beforeEach(async () => {
  await clearAuditLog(SEEDED_WORKSPACE_TEAM_ID);

  // Re-seed the victim row each test — earlier test that successfully
  // deleted them would leave a stable false-negative for the next run.
  await db
    .insert(usersToWorkspaces)
    .values({
      workspaceId: SEEDED_WORKSPACE_TEAM_ID,
      userId: VICTIM_USER_ID,
      role: "member",
    })
    .onConflictDoNothing();
});

describe("listMembers", () => {
  test("returns parsed rows with user + role", async () => {
    const rows = await listMembers({ ctx: teamCtx });
    const ids = rows.map((r) => r.user.id);
    expect(ids).toContain(OWNER_USER_ID);
    expect(rows.find((r) => r.user.id === OWNER_USER_ID)?.role).toBe("owner");
  });
});

describe("deleteMember", () => {
  test("owner removes another member, audit row written", async () => {
    await deleteMember({
      ctx: teamCtx,
      input: { userId: VICTIM_USER_ID },
    });

    const stillThere = await db
      .select()
      .from(usersToWorkspaces)
      .where(
        and(
          eq(usersToWorkspaces.workspaceId, SEEDED_WORKSPACE_TEAM_ID),
          eq(usersToWorkspaces.userId, VICTIM_USER_ID),
        ),
      )
      .get();
    expect(stillThere).toBeUndefined();

    await expectAuditRow({
      workspaceId: SEEDED_WORKSPACE_TEAM_ID,
      action: "member.delete",
      entityType: "member",
      entityId: VICTIM_USER_ID,
    });
  });

  test("non-owner caller is rejected with PRECONDITION_FAILED", async () => {
    const nonOwnerCtx = makeUserCtx(teamCtx.workspace, {
      userId: NON_OWNER_USER_ID,
    });
    let thrown: unknown;
    try {
      await deleteMember({
        ctx: nonOwnerCtx,
        input: { userId: VICTIM_USER_ID },
      });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(PreconditionFailedError);
  });

  test("self-removal is rejected", async () => {
    let thrown: unknown;
    try {
      await deleteMember({
        ctx: teamCtx,
        input: { userId: OWNER_USER_ID },
      });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(PreconditionFailedError);
  });

  test("system actor cannot remove members", async () => {
    const sysCtx = makeSystemCtx(teamCtx.workspace, { job: "test" });
    let thrown: unknown;
    try {
      await deleteMember({
        ctx: sysCtx,
        input: { userId: VICTIM_USER_ID },
      });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(PreconditionFailedError);
  });

  test("caller with no membership row in target workspace surfaces NOT_FOUND", async () => {
    const free = await loadSeededWorkspace(SEEDED_WORKSPACE_FREE_ID);
    // Pretend caller belongs to free workspace but actually doesn't —
    // the membership lookup will miss and throw NotFoundError.
    const stranger = makeUserCtx(free, { userId: 9_999_999 });
    let thrown: unknown;
    try {
      await deleteMember({
        ctx: stranger,
        input: { userId: VICTIM_USER_ID },
      });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(NotFoundError);
  });
});
