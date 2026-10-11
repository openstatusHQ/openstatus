import { describe, expect, it } from "vitest";

import { pageLabel } from "./types";

describe("pageLabel", () => {
  it("uses the monitor name", () => {
    expect(pageLabel({ type: "monitor", id: 1, name: "API" })).toBe("API");
  });

  it("uses the status page title", () => {
    expect(
      pageLabel({ type: "status-page", id: 2, title: "Acme Status" }),
    ).toBe("Acme Status");
  });
});
