import {
  addUserToWorkspace,
  createTestWorkspace,
  createUser,
  createWorkspace,
} from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  findTrialEligibleWorkspace,
  getTrialDaysLeft,
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

describe("findTrialEligibleWorkspace", () => {
  test("an owned free workspace never linked to Stripe", async () => {
    const { workspace: ws, user } = await createTestWorkspace({
      plan: "free",
      stripeId: null,
      subscriptionId: null,
    });
    const found = await findTrialEligibleWorkspace({
      input: { userId: user.id },
    });
    expect(found?.id).toBe(ws.id);
  });

  test("a signup workspace with no plan column yet counts as free", async () => {
    const ws = await createWorkspace({
      plan: null,
      stripeId: null,
      subscriptionId: null,
    });
    const owner = await createUser();
    await addUserToWorkspace(owner.id, ws.id, "owner");

    const found = await findTrialEligibleWorkspace({
      input: { userId: owner.id },
    });
    expect(found?.id).toBe(ws.id);
  });

  test("null when the workspace already has a Stripe customer", async () => {
    const { user } = await createTestWorkspace({
      plan: "free",
      stripeId: `cus_${crypto.randomUUID()}`,
    });
    expect(
      await findTrialEligibleWorkspace({ input: { userId: user.id } }),
    ).toBeNull();
  });

  test("null when the workspace is on a paid plan", async () => {
    const { user } = await createTestWorkspace({
      plan: "team",
      stripeId: null,
      subscriptionId: null,
    });
    expect(
      await findTrialEligibleWorkspace({ input: { userId: user.id } }),
    ).toBeNull();
  });

  test("null for a member who is not the owner", async () => {
    const { workspace: ws } = await createTestWorkspace({
      plan: "free",
      stripeId: null,
    });
    const member = await createUser();
    await addUserToWorkspace(member.id, ws.id, "member");
    expect(
      await findTrialEligibleWorkspace({ input: { userId: member.id } }),
    ).toBeNull();
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
