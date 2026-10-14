import { selectWorkspaceSchema } from "@openstatus/db/src/schema";
import {
  addUserToWorkspace,
  createTestWorkspace,
  createUser,
  createWorkspace,
} from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { makeUserCtx } from "../../../test/helpers";
import {
  getTrialDaysLeft,
  isTrialEligibleWorkspace,
  listOwnedTrialWorkspaces,
} from "../index.ts";

const DAY_MS = 86_400_000;

describe("getTrialDaysLeft", () => {
  const now = new Date("2026-09-23T12:00:00Z").getTime();

  test("null without a trial or once it has passed", () => {
    expect(getTrialDaysLeft(null, now)).toBeNull();
    expect(getTrialDaysLeft(undefined, now)).toBeNull();
    expect(getTrialDaysLeft(new Date(now), now)).toBeNull();
    expect(getTrialDaysLeft(new Date(now - 1), now)).toBeNull();
  });

  test("rounds a partial day up", () => {
    expect(getTrialDaysLeft(new Date(now + 1), now)).toBe(1);
    expect(getTrialDaysLeft(new Date(now + DAY_MS), now)).toBe(1);
    expect(getTrialDaysLeft(new Date(now + DAY_MS + 1), now)).toBe(2);
    expect(getTrialDaysLeft(new Date(now + 14 * DAY_MS), now)).toBe(14);
  });
});

describe("isTrialEligibleWorkspace", () => {
  function ctxFor(
    ws: Parameters<typeof selectWorkspaceSchema.parse>[0],
    userId: number,
  ) {
    return makeUserCtx(selectWorkspaceSchema.parse(ws), { userId });
  }

  test("an owned free workspace with no subscription", async () => {
    const { workspace: ws, user } = await createTestWorkspace({
      plan: "free",
      stripeId: null,
      subscriptionId: null,
      trialEndsAt: null,
    });
    expect(await isTrialEligibleWorkspace({ ctx: ctxFor(ws, user.id) })).toBe(
      true,
    );
  });

  test("a signup workspace with no plan column yet counts as free", async () => {
    const ws = await createWorkspace({
      plan: null,
      stripeId: null,
      subscriptionId: null,
    });
    const owner = await createUser();
    await addUserToWorkspace(owner.id, ws.id, "owner");

    expect(await isTrialEligibleWorkspace({ ctx: ctxFor(ws, owner.id) })).toBe(
      true,
    );
  });

  test("a Stripe customer without a subscription is still eligible", async () => {
    const { workspace: ws, user } = await createTestWorkspace({
      plan: "free",
      stripeId: `cus_${crypto.randomUUID()}`,
      subscriptionId: null,
      trialEndsAt: null,
    });
    expect(await isTrialEligibleWorkspace({ ctx: ctxFor(ws, user.id) })).toBe(
      true,
    );
  });

  test("false once a trial marker is set", async () => {
    const { workspace: ws, user } = await createTestWorkspace({
      plan: "free",
      stripeId: null,
      subscriptionId: null,
      trialEndsAt: new Date(Date.now() + DAY_MS),
    });
    expect(await isTrialEligibleWorkspace({ ctx: ctxFor(ws, user.id) })).toBe(
      false,
    );
  });

  test("false when the workspace is on a paid plan", async () => {
    const { workspace: ws, user } = await createTestWorkspace({
      plan: "team",
      stripeId: null,
      subscriptionId: null,
    });
    expect(await isTrialEligibleWorkspace({ ctx: ctxFor(ws, user.id) })).toBe(
      false,
    );
  });

  test("false for a member who is not the owner", async () => {
    const { workspace: ws } = await createTestWorkspace({
      plan: "free",
      stripeId: null,
      subscriptionId: null,
      trialEndsAt: null,
    });
    const member = await createUser();
    await addUserToWorkspace(member.id, ws.id, "member");
    expect(await isTrialEligibleWorkspace({ ctx: ctxFor(ws, member.id) })).toBe(
      false,
    );
  });

  test("false for an actor without a user", async () => {
    const { workspace: ws } = await createTestWorkspace({
      plan: "free",
      stripeId: null,
      subscriptionId: null,
      trialEndsAt: null,
    });
    expect(
      await isTrialEligibleWorkspace({
        ctx: {
          workspace: selectWorkspaceSchema.parse(ws),
          actor: { type: "system", job: "test" },
        },
      }),
    ).toBe(false);
  });
});

describe("listOwnedTrialWorkspaces", () => {
  test("only owned workspaces with a trial date", async () => {
    // Second precision: the timestamp column drops milliseconds.
    const trialEndsAt = new Date(
      Math.floor((Date.now() + 7 * DAY_MS) / 1000) * 1000,
    );
    const { workspace: trial, user: owner } = await createTestWorkspace({
      plan: "starter",
      trialEndsAt,
    });
    const paid = await createWorkspace({ plan: "team", trialEndsAt: null });
    await addUserToWorkspace(owner.id, paid.id, "owner");
    const memberOf = await createWorkspace({ plan: "starter", trialEndsAt });
    await addUserToWorkspace(owner.id, memberOf.id, "member");

    const rows = await listOwnedTrialWorkspaces({
      input: { userId: owner.id },
    });

    expect(rows.map((r) => r.id)).toEqual([trial.id]);
    expect(rows[0]?.trialEndsAt).toEqual(trialEndsAt);
  });
});
