import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { ForbiddenError } from "../errors";
import { isFeatureEnabled, requireFeature } from "../features";
import type { Workspace } from "../types";

const none = new Set<string>();

describe("isFeatureEnabled", () => {
  test("allowlisted workspace", () => {
    expect(isFeatureEnabled({ id: 1 }, "incident-management", none)).toBe(true);
  });

  test("other workspace", () => {
    expect(
      isFeatureEnabled({ id: 987654321 }, "incident-management", none),
    ).toBe(false);
  });

  test("env override enables it for every workspace", () => {
    expect(
      isFeatureEnabled(
        { id: 987654321 },
        "incident-management",
        new Set(["incident-management"]),
      ),
    ).toBe(true);
  });
});

describe("requireFeature", () => {
  test("throws ForbiddenError when disabled", () => {
    // The package test script enables the feature globally; clear it here.
    const processEnv: Record<string, string | undefined> = process.env;
    const saved = processEnv.OPENSTATUS_FEATURES;
    delete processEnv.OPENSTATUS_FEATURES;
    try {
      const workspace = { id: 987654321 } as Workspace;
      expect(() =>
        requireFeature(
          { workspace, actor: { type: "system", job: "test" } },
          "incident-management",
        ),
      ).toThrow(ForbiddenError);
    } finally {
      if (saved !== undefined) processEnv.OPENSTATUS_FEATURES = saved;
    }
  });
});
