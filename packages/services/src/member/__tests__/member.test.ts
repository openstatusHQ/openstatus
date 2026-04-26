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
  readAuditLog,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { NotFoundError, PreconditionFailedError } from "../../errors";

const OWNER_USER_ID = 1;
const VICTIM_USER_ID = 4242;
const NON_OWNER_USER_ID = 4243;

let teamCtx: ServiceContext;
// Captured so we can restore the seeded owner row in afterAll. The seed
// owns user 1's role for workspace 1; mutating it in place would leak
// into other suites that share the team workspace.
let ownerRoleBefore: "owner" | "admin" | "member" | null = null;

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

  const existingOwner = await db
    .select({ role: usersToWorkspaces.role })
    .from(usersToWorkspaces)
    .where(
      and(
        eq(usersToWorkspaces.workspaceId, SEEDED_WORKSPACE_TEAM_ID),
        eq(usersToWorkspaces.userId, OWNER_USER_ID),
      ),
    )
    .get();
  ownerRoleBefore = existingOwner?.role ?? null;

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

  // Restore the seeded owner row to whatever it was before this suite —
  // forcing `owner` in beforeAll otherwise pollutes shared fixtures.
  if (ownerRoleBefore !== null) {
    await db
      .update(usersToWorkspaces)
      .set({ role: ownerRoleBefore })
      .where(
        and(
          eq(usersToWorkspaces.workspaceId, SEEDED_WORKSPACE_TEAM_ID),
          eq(usersToWorkspaces.userId, OWNER_USER_ID),
        ),
      )
      .catch(() => undefined);
  } else {
    await db
      .delete(usersToWorkspaces)
      .where(
        and(
          eq(usersToWorkspaces.workspaceId, SEEDED_WORKSPACE_TEAM_ID),
          eq(usersToWorkspaces.userId, OWNER_USER_ID),
        ),
      )
      .catch(() => undefined);
  }
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

  test("target userId with no membership in workspace is a silent no-op", async () => {
    // Owner caller, but the target has no users_to_workspaces row at all.
    // DELETE matches nothing → no throw, no audit row.
    const NEVER_MEMBER_USER_ID = 9_876_543;
    await deleteMember({
      ctx: teamCtx,
      input: { userId: NEVER_MEMBER_USER_ID },
    });

    const rows = await readAuditLog({
      workspaceId: SEEDED_WORKSPACE_TEAM_ID,
      entityType: "member",
      entityId: NEVER_MEMBER_USER_ID,
    });
    expect(rows).toHaveLength(0);
  });

  test("target user in another workspace is a silent no-op (workspace-scoped DELETE)", async () => {
    // VICTIM is in the team workspace. Caller is owner of free workspace.
    // The delete WHERE filters by ctx.workspace.id, so the team-workspace
    // row is never matched — verifies the workspace scope on the DELETE.
    const free = await loadSeededWorkspace(SEEDED_WORKSPACE_FREE_ID);
    await db
      .insert(usersToWorkspaces)
      .values({
        workspaceId: free.id,
        userId: OWNER_USER_ID,
        role: "owner",
      })
      .onConflictDoUpdate({
        target: [usersToWorkspaces.userId, usersToWorkspaces.workspaceId],
        set: { role: "owner" },
      });

    try {
      await deleteMember({
        ctx: makeUserCtx(free, { userId: OWNER_USER_ID }),
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
      expect(stillThere).toBeDefined();
    } finally {
      await db
        .delete(usersToWorkspaces)
        .where(
          and(
            eq(usersToWorkspaces.workspaceId, free.id),
            eq(usersToWorkspaces.userId, OWNER_USER_ID),
          ),
        )
        .catch(() => undefined);
    }
  });
});
