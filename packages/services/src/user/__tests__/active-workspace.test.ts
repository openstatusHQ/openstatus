import { db, eq } from "@openstatus/db";
import { user, usersToWorkspaces } from "@openstatus/db/src/schema";
import { createUser, createWorkspace } from "@openstatus/db/src/test/factories";
import { describe, expect, test } from "vitest";

import { resolveActiveWorkspace, resolveUserWorkspaces } from "../index.ts";

async function join(userId: number, workspaceId: number, createdAt: Date) {
  await db
    .insert(usersToWorkspaces)
    .values({ userId, workspaceId, role: "owner", createdAt })
    .run();
}

async function userWithTwoWorkspaces() {
  const member = await createUser();
  const later = await createWorkspace();
  const earlier = await createWorkspace();
  await join(member.id, later.id, new Date("2026-02-01T00:00:00Z"));
  await join(member.id, earlier.id, new Date("2026-01-01T00:00:00Z"));
  return { member, earlier, later };
}

describe("resolveUserWorkspaces", () => {
  test("lists memberships earliest first", async () => {
    const { member, earlier, later } = await userWithTwoWorkspaces();
    const resolved = await resolveUserWorkspaces({ userId: member.id });
    expect(resolved?.workspaces.map((w) => w.id)).toEqual([
      earlier.id,
      later.id,
    ]);
  });

  test("a soft-deleted user resolves to nothing", async () => {
    const { member } = await userWithTwoWorkspaces();
    await db
      .update(user)
      .set({ deletedAt: new Date() })
      .where(eq(user.id, member.id))
      .run();
    expect(await resolveUserWorkspaces({ userId: member.id })).toBeNull();
    expect(await resolveActiveWorkspace({ userId: member.id })).toEqual({
      ok: false,
      error: { kind: "user_not_found" },
    });
  });
});

describe("resolveActiveWorkspace", () => {
  test("the slug picks among memberships; a stale one falls back to the earliest", async () => {
    const { member, earlier, later } = await userWithTwoWorkspaces();

    const picked = await resolveActiveWorkspace({
      userId: member.id,
      workspaceSlug: later.slug,
    });
    expect(picked.ok && picked.value.workspace.id).toBe(later.id);

    const stale = await resolveActiveWorkspace({
      userId: member.id,
      workspaceSlug: "not-a-member-of-this",
    });
    expect(stale.ok && stale.value.workspace.id).toBe(earlier.id);
  });

  test("a user without memberships has no active workspace", async () => {
    const loner = await createUser();
    expect(await resolveActiveWorkspace({ userId: loner.id })).toEqual({
      ok: false,
      error: { kind: "workspace_not_found" },
    });
  });
});
