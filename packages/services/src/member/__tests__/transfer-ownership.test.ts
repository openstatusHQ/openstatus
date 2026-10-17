import { and, eq } from "@openstatus/db";
import { user, usersToWorkspaces } from "@openstatus/db/src/schema";
import {
  addUserToWorkspace,
  createUser,
} from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";
import { afterAll, beforeAll, describe, test } from "@std/testing/bdd";

import {
  clearAuditLogFor,
  createWorkspaceFixture,
  expectAuditRow,
  makeApiKeyCtx,
  makeSystemCtx,
  makeUserCtx,
  readAuditLog,
  withTestTransaction,
} from "../../../test/helpers";
import type { DB, ServiceContext } from "../../context";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  PreconditionFailedError,
} from "../../errors";
import { deleteAccount } from "../../user";
import { downgradeWorkspaceToFree, listWorkspaceOwners } from "../../workspace";
import { transferOwnership } from "../index.ts";
import { transferOwnershipInWorkspace } from "../transfer-ownership";

let teamCtx: ServiceContext;
let otherWorkspace: ServiceContext["workspace"];
let OWNER_USER_ID: number;
let TARGET_USER_ID: number;
let OTHER_MEMBER_USER_ID: number;
let DELETED_USER_ID: number;
let OUTSIDER_USER_ID: number;

beforeAll(async () => {
  const team = await createWorkspaceFixture("team");
  OWNER_USER_ID = team.userId;
  teamCtx = makeUserCtx(team.workspace, { userId: OWNER_USER_ID });

  TARGET_USER_ID = (await createUser()).id;
  OTHER_MEMBER_USER_ID = (await createUser()).id;
  DELETED_USER_ID = (await createUser({ deletedAt: new Date() })).id;
  await addUserToWorkspace(TARGET_USER_ID, team.workspace.id, "member");
  await addUserToWorkspace(OTHER_MEMBER_USER_ID, team.workspace.id, "member");
  await addUserToWorkspace(DELETED_USER_ID, team.workspace.id, "member");

  // A member of a different workspace only.
  const other = await createWorkspaceFixture("team");
  otherWorkspace = other.workspace;
  OUTSIDER_USER_ID = (await createUser()).id;
  await addUserToWorkspace(OUTSIDER_USER_ID, otherWorkspace.id, "member");
});

afterAll(async () => {
  await clearAuditLogFor({
    entityType: "member",
    entityIds: [
      OWNER_USER_ID,
      TARGET_USER_ID,
      OTHER_MEMBER_USER_ID,
      DELETED_USER_ID,
      OUTSIDER_USER_ID,
    ],
  });
});

async function roleOf(tx: DB, workspaceId: number, userId: number) {
  const row = await tx
    .select({ role: usersToWorkspaces.role })
    .from(usersToWorkspaces)
    .where(
      and(
        eq(usersToWorkspaces.workspaceId, workspaceId),
        eq(usersToWorkspaces.userId, userId),
      ),
    )
    .get();
  return row?.role;
}

async function expectRejects(
  promise: Promise<unknown>,
  ErrorClass: new (...args: never[]) => Error,
) {
  let thrown: unknown;
  try {
    await promise;
  } catch (e) {
    thrown = e;
  }
  expect(thrown).toBeInstanceOf(ErrorClass);
}

describe("transferOwnership", () => {
  test("target becomes owner, caller becomes member", async () => {
    await withTestTransaction(async (tx) => {
      const result = await transferOwnership({
        ctx: { ...teamCtx, db: tx },
        input: { userId: TARGET_USER_ID },
      });

      expect(result).toMatchObject({
        fromUserId: OWNER_USER_ID,
        toUserId: TARGET_USER_ID,
        formerOwnerRole: "member",
      });
      expect(result.newOwnerEmail).toBeTruthy();
      expect(await roleOf(tx, teamCtx.workspace.id, TARGET_USER_ID)).toBe(
        "owner",
      );
      expect(await roleOf(tx, teamCtx.workspace.id, OWNER_USER_ID)).toBe(
        "member",
      );

      const owners = await listWorkspaceOwners({
        input: { workspaceId: teamCtx.workspace.id },
        db: tx,
      });
      expect(owners.map((o) => o.id)).toEqual([TARGET_USER_ID]);
    });
  });

  test("writes paired member.update audit rows", async () => {
    await withTestTransaction(async (tx) => {
      await transferOwnership({
        ctx: { ...teamCtx, db: tx },
        input: { userId: TARGET_USER_ID },
      });

      const expected = [
        { userId: TARGET_USER_ID, before: "member", after: "owner" },
        { userId: OWNER_USER_ID, before: "owner", after: "member" },
      ];
      for (const { userId, before, after } of expected) {
        await expectAuditRow({
          workspaceId: teamCtx.workspace.id,
          action: "member.update",
          entityType: "member",
          entityId: userId,
          actorType: "user",
          db: tx,
        });
        const [row] = await readAuditLog({
          workspaceId: teamCtx.workspace.id,
          entityType: "member",
          entityId: userId,
          db: tx,
        });
        expect(row.action).toBe("member.update");
        expect(row.changedFields).toEqual(["role"]);
        expect(row.before?.role).toBe(before);
        expect(row.after?.role).toBe(after);
        expect(row.metadata).toEqual({
          reason: "ownership_transfer",
          fromUserId: OWNER_USER_ID,
          toUserId: TARGET_USER_ID,
        });
      }
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
        transferOwnership({ ctx: readOnlyCtx, input: { userId: 999_999_999 } }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  test("system actor is rejected on the public verb", async () => {
    await withTestTransaction(async (tx) => {
      await expectRejects(
        transferOwnership({
          ctx: { ...makeSystemCtx(teamCtx.workspace, { job: "test" }), db: tx },
          input: { userId: TARGET_USER_ID },
        }),
        PreconditionFailedError,
      );
    });
  });

  test("non-owner caller is rejected", async () => {
    await withTestTransaction(async (tx) => {
      await expectRejects(
        transferOwnership({
          ctx: {
            ...makeUserCtx(teamCtx.workspace, { userId: OTHER_MEMBER_USER_ID }),
            db: tx,
          },
          input: { userId: TARGET_USER_ID },
        }),
        PreconditionFailedError,
      );
      expect(await roleOf(tx, teamCtx.workspace.id, TARGET_USER_ID)).toBe(
        "member",
      );
    });
  });

  test("self-target is rejected", async () => {
    await withTestTransaction(async (tx) => {
      await expectRejects(
        transferOwnership({
          ctx: { ...teamCtx, db: tx },
          input: { userId: OWNER_USER_ID },
        }),
        PreconditionFailedError,
      );
    });
  });

  test("non-member target surfaces NOT_FOUND", async () => {
    await withTestTransaction(async (tx) => {
      await expectRejects(
        transferOwnership({
          ctx: { ...teamCtx, db: tx },
          input: { userId: 9_876_543 },
        }),
        NotFoundError,
      );
    });
  });

  test("soft-deleted target is rejected", async () => {
    await withTestTransaction(async (tx) => {
      await expectRejects(
        transferOwnership({
          ctx: { ...teamCtx, db: tx },
          input: { userId: DELETED_USER_ID },
        }),
        PreconditionFailedError,
      );
      expect(await roleOf(tx, teamCtx.workspace.id, OWNER_USER_ID)).toBe(
        "owner",
      );
    });
  });

  test("target already owner is a conflict", async () => {
    await withTestTransaction(async (tx) => {
      await tx
        .update(usersToWorkspaces)
        .set({ role: "owner" })
        .where(
          and(
            eq(usersToWorkspaces.workspaceId, teamCtx.workspace.id),
            eq(usersToWorkspaces.userId, TARGET_USER_ID),
          ),
        );
      await expectRejects(
        transferOwnership({
          ctx: { ...teamCtx, db: tx },
          input: { userId: TARGET_USER_ID },
        }),
        ConflictError,
      );
    });
  });

  test("target who is a member of another workspace only surfaces NOT_FOUND", async () => {
    await withTestTransaction(async (tx) => {
      await expectRejects(
        transferOwnership({
          ctx: { ...teamCtx, db: tx },
          input: { userId: OUTSIDER_USER_ID },
        }),
        NotFoundError,
      );
      expect(await roleOf(tx, teamCtx.workspace.id, OWNER_USER_ID)).toBe(
        "owner",
      );
      expect(await roleOf(tx, otherWorkspace.id, OUTSIDER_USER_ID)).toBe(
        "member",
      );
    });
  });
});

describe("transferOwnershipInWorkspace", () => {
  test("demote predicate mismatch is a conflict and rolls back the promote", async () => {
    await withTestTransaction(async (tx) => {
      // The former owner was already demoted by a concurrent request.
      await tx
        .update(usersToWorkspaces)
        .set({ role: "member" })
        .where(
          and(
            eq(usersToWorkspaces.workspaceId, teamCtx.workspace.id),
            eq(usersToWorkspaces.userId, OWNER_USER_ID),
          ),
        );

      await expectRejects(
        tx.transaction((inner) =>
          transferOwnershipInWorkspace({
            tx: inner,
            ctx: { ...teamCtx, db: inner },
            fromUserId: OWNER_USER_ID,
            toUserId: TARGET_USER_ID,
            demoteTo: "member",
          }),
        ),
        ConflictError,
      );

      expect(await roleOf(tx, teamCtx.workspace.id, TARGET_USER_ID)).toBe(
        "member",
      );
      const rows = await readAuditLog({
        workspaceId: teamCtx.workspace.id,
        entityType: "member",
        entityId: TARGET_USER_ID,
        db: tx,
      });
      expect(rows.filter((r) => r.action === "member.update")).toHaveLength(0);
    });
  });

  test("system actor (support path) transfers and is attributed as system", async () => {
    await withTestTransaction(async (tx) => {
      const sysCtx = {
        ...makeSystemCtx(teamCtx.workspace, { job: "support-transfer" }),
        db: tx,
      };
      await transferOwnershipInWorkspace({
        tx,
        ctx: sysCtx,
        fromUserId: OWNER_USER_ID,
        toUserId: TARGET_USER_ID,
        demoteTo: "member",
      });

      expect(await roleOf(tx, teamCtx.workspace.id, TARGET_USER_ID)).toBe(
        "owner",
      );
      for (const userId of [TARGET_USER_ID, OWNER_USER_ID]) {
        await expectAuditRow({
          workspaceId: teamCtx.workspace.id,
          action: "member.update",
          entityType: "member",
          entityId: userId,
          actorType: "system",
          db: tx,
        });
      }
    });
  });
});

describe("after a transfer", () => {
  test("the former owner of a paid workspace can delete their account", async () => {
    await withTestTransaction(async (tx) => {
      await transferOwnership({
        ctx: { ...teamCtx, db: tx },
        input: { userId: TARGET_USER_ID },
      });

      await deleteAccount({
        ctx: {
          ...makeUserCtx(teamCtx.workspace, { userId: OWNER_USER_ID }),
          db: tx,
        },
      });

      const deleted = await tx
        .select({ deletedAt: user.deletedAt })
        .from(user)
        .where(eq(user.id, OWNER_USER_ID))
        .get();
      expect(deleted?.deletedAt).toBeTruthy();
    });
  });

  test("downgrade keeps the new owner and removes the former one", async () => {
    await withTestTransaction(async (tx) => {
      await transferOwnership({
        ctx: { ...teamCtx, db: tx },
        input: { userId: TARGET_USER_ID },
      });

      await downgradeWorkspaceToFree({
        ctx: {
          ...makeSystemCtx(teamCtx.workspace, {
            job: "stripe-subscription-deleted",
          }),
          db: tx,
        },
      });

      expect(await roleOf(tx, teamCtx.workspace.id, TARGET_USER_ID)).toBe(
        "owner",
      );
      expect(
        await roleOf(tx, teamCtx.workspace.id, OWNER_USER_ID),
      ).toBeUndefined();
    });
  });
});
