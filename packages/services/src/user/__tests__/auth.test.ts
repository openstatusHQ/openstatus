import { eq } from "@openstatus/db";
import { user, usersToWorkspaces, workspace } from "@openstatus/db/src/schema";
import { describe, expect, test } from "vitest";

import { withTestTransaction } from "../../../test/helpers";
import {
  createUserWithWorkspace,
  getUserByEmail,
  getUserForAuth,
  syncUserProfile,
} from "../index.ts";

describe("createUserWithWorkspace", () => {
  test("creates the user as owner of a workspace with an unused slug", async () => {
    await withTestTransaction(async (tx) => {
      const taken = `taken-${crypto.randomUUID()}`;
      const free = `free-${crypto.randomUUID()}`;
      await tx.insert(workspace).values({ slug: taken, name: "" });
      const slugs = [taken, free];
      const id = crypto.randomUUID();

      const created = await createUserWithWorkspace({
        input: { email: `  Sign.Up-${id}@Example.com ` },
        generateSlug: () => slugs.shift() ?? free,
        db: tx,
      });
      expect(created.email).toBe(`sign.up-${id}@example.com`);

      const memberships = await tx
        .select({ role: usersToWorkspaces.role, slug: workspace.slug })
        .from(usersToWorkspaces)
        .innerJoin(workspace, eq(workspace.id, usersToWorkspaces.workspaceId))
        .where(eq(usersToWorkspaces.userId, created.id))
        .all();
      expect(memberships).toEqual([{ role: "owner", slug: free }]);
    });
  });
});

describe("getUserByEmail", () => {
  test("matches normalized and legacy mixed-case rows, refuses ambiguity", async () => {
    await withTestTransaction(async (tx) => {
      const id = crypto.randomUUID();
      const legacy = await tx
        .insert(user)
        .values({ email: `Legacy-${id}@Example.com` })
        .returning()
        .get();

      const found = await getUserByEmail({
        input: { email: ` legacy-${id}@example.COM` },
        db: tx,
      });
      expect(found?.id).toBe(legacy.id);
      expect(
        await getUserForAuth({ input: { userId: legacy.id }, db: tx }),
      ).toMatchObject({ id: legacy.id });
      expect(
        await getUserByEmail({ input: { email: `none-${id}@x.dev` }, db: tx }),
      ).toBeNull();

      await tx.insert(user).values({ email: `LEGACY-${id}@example.com` });
      await expect(
        getUserByEmail({
          input: { email: `legacy-${id}@example.com` },
          db: tx,
        }),
      ).rejects.toThrow("ambiguous legacy email");
    });
  });
});

describe("syncUserProfile", () => {
  test("writes the given fields and leaves the others", async () => {
    await withTestTransaction(async (tx) => {
      const row = await tx
        .insert(user)
        .values({
          email: `sync-${crypto.randomUUID()}@example.com`,
          name: "Old",
          firstName: "Keep",
        })
        .returning()
        .get();

      await syncUserProfile({
        input: { userId: row.id, name: "New", photoUrl: "https://p.test/a" },
        db: tx,
      });

      const after = await getUserForAuth({ input: { userId: row.id }, db: tx });
      expect(after).toMatchObject({
        name: "New",
        firstName: "Keep",
        photoUrl: "https://p.test/a",
      });
    });
  });
});
