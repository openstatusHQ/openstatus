import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { ForbiddenError } from "../errors";
import { type Feature, isFeatureEnabled, requireFeature } from "../features";
import type { Workspace } from "../types";

const none = new Set<string>();
// No feature is gated right now; exercise the mechanism with a stand-in.
const flag = "test-feature" as Feature;

describe("isFeatureEnabled", () => {
  test("off without an allowlist entry or env override", () => {
    expect(isFeatureEnabled({ id: 1 }, flag, none)).toBe(false);
  });

  test("env override enables it for every workspace", () => {
    expect(isFeatureEnabled({ id: 987654321 }, flag, new Set([flag]))).toBe(
      true,
    );
  });
});

describe("requireFeature", () => {
  test("throws ForbiddenError when disabled", () => {
    // The package test script may enable features globally; clear it here.
    const processEnv: Record<string, string | undefined> = process.env;
    const saved = processEnv.OPENSTATUS_FEATURES;
    delete processEnv.OPENSTATUS_FEATURES;
    try {
      const workspace = { id: 987654321 } as Workspace;
      expect(() =>
        requireFeature(
          { workspace, actor: { type: "system", job: "test" } },
          flag,
        ),
      ).toThrow(ForbiddenError);
    } finally {
      if (saved !== undefined) processEnv.OPENSTATUS_FEATURES = saved;
    }
  });
});
