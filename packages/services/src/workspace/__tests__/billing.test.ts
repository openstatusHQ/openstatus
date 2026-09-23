import { eq } from "@openstatus/db";
import { selectWorkspaceSchema, workspace } from "@openstatus/db/src/schema";
import { getLimits } from "@openstatus/db/src/schema/plan/utils";
import {
  addUserToWorkspace,
  createTestWorkspace,
  createUser,
} from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  expectAuditRow,
  makeApiKeyCtx,
  makeUserCtx,
  readAuditLog,
  withTestTransaction,
} from "../../../test/helpers";
import { ForbiddenError } from "../../errors";
import {
  getWorkspaceForMember,
  listWorkspaceOwners,
  updateWorkspaceLimits,
  updateWorkspaceStripeId,
} from "../index.ts";

describe("getWorkspaceForMember", () => {
  test("resolves the workspace by slug for a member, with their email", async () => {
    const { workspace: ws, user } = await createTestWorkspace({ plan: "free" });

    const found = await getWorkspaceForMember({
      input: { slug: ws.slug, userId: user.id },
    });

    expect(found?.workspace.id).toBe(ws.id);
    expect(found?.email).toBe(user.email);
    expect(typeof found?.workspace.limits).toBe("object");
  });

  test("returns null for a user who is not a member", async () => {
    const { workspace: ws } = await createTestWorkspace({ plan: "free" });
    const stranger = await createUser();

    const found = await getWorkspaceForMember({
      input: { slug: ws.slug, userId: stranger.id },
    });

    expect(found).toBeNull();
  });

  test("returns null for an unknown slug", async () => {
    const { user } = await createTestWorkspace({ plan: "free" });
    const found = await getWorkspaceForMember({
      input: { slug: `missing-${crypto.randomUUID()}`, userId: user.id },
    });
    expect(found).toBeNull();
  });
});

describe("listWorkspaceOwners", () => {
  test("lists owners only", async () => {
    const { workspace: ws, user: owner } = await createTestWorkspace({
      plan: "free",
    });
    const member = await createUser();
    await addUserToWorkspace(member.id, ws.id, "member");

    const owners = await listWorkspaceOwners({
      input: { workspaceId: ws.id },
    });

    expect(owners).toEqual([{ id: owner.id, email: owner.email }]);
  });
});

describe("updateWorkspaceStripeId", () => {
  test("links the customer and audits the change", async () => {
    await withTestTransaction(async (tx) => {
      const { workspace: ws, user } = await createTestWorkspace({
        plan: "free",
        stripeId: null,
      });
      const ctx = {
        ...makeUserCtx(selectWorkspaceSchema.parse(ws), { userId: user.id }),
        db: tx,
      };

      await updateWorkspaceStripeId({ ctx, input: { stripeId: "cus_linked" } });

      const after = await tx
        .select()
        .from(workspace)
        .where(eq(workspace.id, ws.id))
        .get();
      expect(after?.stripeId).toBe("cus_linked");

      await expectAuditRow({
        workspaceId: ws.id,
        action: "workspace.update",
        entityType: "workspace",
        entityId: ws.id,
        actorType: "user",
        db: tx,
      });
      const [audit] = await readAuditLog({
        workspaceId: ws.id,
        entityType: "workspace",
        entityId: ws.id,
        db: tx,
      });
      expect(audit?.changedFields).toContain("stripeId");
    });
  });

  test("rejects a read-only api key actor", async () => {
    await withTestTransaction(async (tx) => {
      const { workspace: ws } = await createTestWorkspace({ plan: "free" });
      const ctx = {
        ...makeApiKeyCtx(selectWorkspaceSchema.parse(ws), {
          keyId: "k-read",
          userId: 1,
          scopes: ["read"],
        }),
        db: tx,
      };
      await expect(
        updateWorkspaceStripeId({ ctx, input: { stripeId: "cus_x" } }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});

describe("updateWorkspaceLimits", () => {
  test("replaces limits, clears the trial when told, and stamps the reason", async () => {
    await withTestTransaction(async (tx) => {
      const trialEndsAt = new Date("2027-01-15T00:00:00Z");
      const { workspace: ws, user } = await createTestWorkspace({
        plan: "starter",
        trialEndsAt,
      });
      const ctx = {
        ...makeUserCtx(selectWorkspaceSchema.parse(ws), { userId: user.id }),
        db: tx,
      };
      const limits = { ...getLimits("starter"), monitors: 99 };

      await updateWorkspaceLimits({
        ctx,
        input: { limits, trialEndsAt: null, reason: "trial_converted" },
      });

      const after = await tx
        .select()
        .from(workspace)
        .where(eq(workspace.id, ws.id))
        .get();
      expect(JSON.parse(after?.limits ?? "{}")).toEqual(limits);
      expect(after?.trialEndsAt).toBeNull();

      const [audit] = await readAuditLog({
        workspaceId: ws.id,
        entityType: "workspace",
        entityId: ws.id,
        db: tx,
      });
      expect(audit?.changedFields).toContain("limits");
      expect(audit?.changedFields).toContain("trialEndsAt");
      expect(audit?.metadata).toMatchObject({ reason: "trial_converted" });
    });
  });

  test("leaves trialEndsAt alone when not given", async () => {
    await withTestTransaction(async (tx) => {
      const trialEndsAt = new Date("2027-01-15T00:00:00Z");
      const { workspace: ws, user } = await createTestWorkspace({
        plan: "starter",
        trialEndsAt,
      });
      const ctx = {
        ...makeUserCtx(selectWorkspaceSchema.parse(ws), { userId: user.id }),
        db: tx,
      };

      await updateWorkspaceLimits({
        ctx,
        input: { limits: { ...getLimits("starter"), monitors: 5 } },
      });

      const after = await tx
        .select()
        .from(workspace)
        .where(eq(workspace.id, ws.id))
        .get();
      expect(after?.trialEndsAt).toEqual(trialEndsAt);
    });
  });

  test("rejects a read-only api key actor", async () => {
    await withTestTransaction(async (tx) => {
      const { workspace: ws } = await createTestWorkspace({ plan: "free" });
      const ctx = {
        ...makeApiKeyCtx(selectWorkspaceSchema.parse(ws), {
          keyId: "k-read",
          userId: 1,
          scopes: ["read"],
        }),
        db: tx,
      };
      await expect(
        updateWorkspaceLimits({ ctx, input: { limits: getLimits("free") } }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});
