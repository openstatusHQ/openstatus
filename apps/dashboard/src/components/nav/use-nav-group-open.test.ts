import { describe, expect, it } from "vitest";

import {
  NAV_GROUP_AUTO_COLLAPSE_ABOVE,
  resolveNavGroupOpen,
} from "./use-nav-group-open";

describe("resolveNavGroupOpen", () => {
  it("opens a short list when nothing is stored", () => {
    expect(
      resolveNavGroupOpen({
        stored: undefined,
        count: NAV_GROUP_AUTO_COLLAPSE_ABOVE,
        hasActiveItem: false,
      }),
    ).toBe(true);
  });

  it("collapses a long list when nothing is stored", () => {
    expect(
      resolveNavGroupOpen({
        stored: undefined,
        count: NAV_GROUP_AUTO_COLLAPSE_ABOVE + 1,
        hasActiveItem: false,
      }),
    ).toBe(false);
  });

  it("follows the stored state over the list length", () => {
    expect(
      resolveNavGroupOpen({ stored: "true", count: 50, hasActiveItem: false }),
    ).toBe(true);
    expect(
      resolveNavGroupOpen({ stored: "false", count: 1, hasActiveItem: false }),
    ).toBe(false);
  });

  it("opens when an item of the group is the current page", () => {
    expect(
      resolveNavGroupOpen({ stored: "false", count: 50, hasActiveItem: true }),
    ).toBe(true);
  });
});
