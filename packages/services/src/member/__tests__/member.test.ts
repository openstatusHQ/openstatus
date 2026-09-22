import { and, eq } from "@openstatus/db";
import { usersToWorkspaces } from "@openstatus/db/src/schema";
import {
  addUserToWorkspace,
  createUser,
} from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";
import { beforeAll, describe, test } from "@std/testing/bdd";

import {
  createWorkspaceFixture,
  expectAuditRow,
  makeApiKeyCtx,
  makeSystemCtx,
  makeUserCtx,
  readAuditLog,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import {
  ForbiddenError,
  NotFoundError,
  PreconditionFailedError,
} from "../../errors";
import { deleteMember, listMembers } from "../index.ts";

let teamCtx: ServiceContext;
let freeWorkspace: ServiceContext["workspace"];
let OWNER_USER_ID: number;
let VICTIM_USER_ID: number;
let NON_OWNER_USER_ID: number;

beforeAll(async () => {
  const team = await createWorkspaceFixture("team");
  OWNER_USER_ID = team.userId;
  teamCtx = makeUserCtx(team.workspace, { userId: OWNER_USER_ID });

  const victim = await createUser();
  const nonOwner = await createUser();
  VICTIM_USER_ID = victim.id;
  NON_OWNER_USER_ID = nonOwner.id;
  await addUserToWorkspace(VICTIM_USER_ID, team.workspace.id, "member");
  await addUserToWorkspace(NON_OWNER_USER_ID, team.workspace.id, "member");

  // Built here, not inside a test: `withTestTransaction` holds an open
  // transaction on the shared connection and a committed write mid-stream
  // aborts it.
  freeWorkspace = (await createWorkspaceFixture("free")).workspace;
});

describe("listMembers", () => {
  test("returns parsed rows with user + role", async () => {
    await withTestTransaction(async (tx) => {
      const rows = await listMembers({ ctx: { ...teamCtx, db: tx } });
      const ids = rows.map((r) => r.user.id);
      expect(ids).toContain(OWNER_USER_ID);
      expect(rows.find((r) => r.user.id === OWNER_USER_ID)?.role).toBe("owner");
    });
  });
});

describe("deleteMember", () => {
  test("owner removes another member, audit row written", async () => {
    await withTestTransaction(async (tx) => {
      await deleteMember({
        ctx: { ...teamCtx, db: tx },
        input: { userId: VICTIM_USER_ID },
      });

      const stillThere = await tx
        .select()
        .from(usersToWorkspaces)
        .where(
          and(
            eq(usersToWorkspaces.workspaceId, teamCtx.workspace.id),
            eq(usersToWorkspaces.userId, VICTIM_USER_ID),
          ),
        )
        .get();
      expect(stillThere).toBeUndefined();

      await expectAuditRow({
        workspaceId: teamCtx.workspace.id,
        action: "member.delete",
        entityType: "member",
        entityId: VICTIM_USER_ID,
        db: tx,
      });
    });
  });

  test("rejects read-only actor", async () => {
    await withTestTransaction(async (tx) => {
      const readOnlyCtx = {
        ...makeApiKeyCtx(teamCtx.workspace, {
          keyId: "k-read",
          userId: OWNER_USER_ID,
          scopes: ["read"],
        }),
        db: tx,
      };
      await expect(
        deleteMember({
          ctx: readOnlyCtx,
          input: { userId: 999_999_999 },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  test("non-owner caller is rejected with PRECONDITION_FAILED", async () => {
    await withTestTransaction(async (tx) => {
      const nonOwnerCtx = {
        ...makeUserCtx(teamCtx.workspace, { userId: NON_OWNER_USER_ID }),
        db: tx,
      };
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
  });

  test("self-removal is rejected", async () => {
    await withTestTransaction(async (tx) => {
      let thrown: unknown;
      try {
        await deleteMember({
          ctx: { ...teamCtx, db: tx },
          input: { userId: OWNER_USER_ID },
        });
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeInstanceOf(PreconditionFailedError);
    });
  });

  test("system actor cannot remove members", async () => {
    await withTestTransaction(async (tx) => {
      const sysCtx = {
        ...makeSystemCtx(teamCtx.workspace, { job: "test" }),
        db: tx,
      };
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
  });

  test("caller with no membership row in target workspace surfaces NOT_FOUND", async () => {
    await withTestTransaction(async (tx) => {
      const free = freeWorkspace;
      // Pretend caller belongs to free workspace but actually doesn't —
      // the membership lookup will miss and throw NotFoundError.
      const stranger = {
        ...makeUserCtx(free, { userId: 9_999_999 }),
        db: tx,
      };
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

  test("target userId with no membership in workspace is a silent no-op", async () => {
    await withTestTransaction(async (tx) => {
      // Owner caller, but the target has no users_to_workspaces row at all.
      // DELETE matches nothing → no throw, no audit row.
      const NEVER_MEMBER_USER_ID = 9_876_543;
      await deleteMember({
        ctx: { ...teamCtx, db: tx },
        input: { userId: NEVER_MEMBER_USER_ID },
      });

      const rows = await readAuditLog({
        workspaceId: teamCtx.workspace.id,
        entityType: "member",
        entityId: NEVER_MEMBER_USER_ID,
        db: tx,
      });
      expect(rows).toHaveLength(0);
    });
  });

  test("target user in another workspace is a silent no-op (workspace-scoped DELETE)", async () => {
    await withTestTransaction(async (tx) => {
      // VICTIM is in the team workspace. Caller is owner of free workspace.
      // The delete WHERE filters by ctx.workspace.id, so the team-workspace
      // row is never matched — verifies the workspace scope on the DELETE.
      const free = freeWorkspace;
      await tx
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

      await deleteMember({
        ctx: { ...makeUserCtx(free, { userId: OWNER_USER_ID }), db: tx },
        input: { userId: VICTIM_USER_ID },
      });

      const stillThere = await tx
        .select()
        .from(usersToWorkspaces)
        .where(
          and(
            eq(usersToWorkspaces.workspaceId, teamCtx.workspace.id),
            eq(usersToWorkspaces.userId, VICTIM_USER_ID),
          ),
        )
        .get();
      expect(stillThere).toBeDefined();
    });
  });
});
