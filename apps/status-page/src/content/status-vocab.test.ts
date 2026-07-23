import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  componentStatus,
  flattenComponents,
  isoOrNull,
  pageIndicator,
  worstComponent,
} from "./status-vocab";

describe("pageIndicator", () => {
  test("maps live status to Statuspage indicator + description", () => {
    expect(pageIndicator("success")).toEqual({
      indicator: "none",
      description: "All Systems Operational",
    });
    expect(pageIndicator("degraded").indicator).toBe("minor");
    expect(pageIndicator("error").indicator).toBe("major");
    expect(pageIndicator("info").indicator).toBe("maintenance");
  });

  test("unknown falls back to operational", () => {
    expect(pageIndicator("???").indicator).toBe("none");
  });
});

describe("componentStatus", () => {
  test("maps to Statuspage component vocabulary", () => {
    expect(componentStatus("success")).toBe("operational");
    expect(componentStatus("degraded")).toBe("degraded_performance");
    expect(componentStatus("error")).toBe("major_outage");
    expect(componentStatus("info")).toBe("under_maintenance");
    expect(componentStatus("???")).toBe("operational");
  });
});

describe("flattenComponents", () => {
  test("flattens components and grouped components", () => {
    const flat = flattenComponents([
      { type: "component", component: { name: "API", status: "error" } },
      {
        type: "group",
        components: [
          { name: "DB", status: "success" },
          { name: "Cache", status: "degraded" },
        ],
      },
    ]);
    expect(flat).toEqual([
      { name: "API", status: "error" },
      { name: "DB", status: "success" },
      { name: "Cache", status: "degraded" },
    ]);
  });

  test("tolerates null/undefined", () => {
    expect(flattenComponents(null)).toEqual([]);
    expect(flattenComponents(undefined)).toEqual([]);
  });
});

describe("worstComponent", () => {
  test("returns the most severely impacted name", () => {
    expect(
      worstComponent([
        { name: "API", status: "degraded" },
        { name: "Web", status: "error" },
        { name: "DB", status: "success" },
      ]),
    ).toBe("Web");
  });

  test("null when all operational", () => {
    expect(
      worstComponent([
        { name: "API", status: "success" },
        { name: "Web", status: "success" },
      ]),
    ).toBeNull();
  });
});

describe("isoOrNull", () => {
  test("ISO for valid dates, null otherwise", () => {
    expect(isoOrNull(new Date("2026-06-18T14:03:00.000Z"))).toBe(
      "2026-06-18T14:03:00.000Z",
    );
    expect(isoOrNull(null)).toBeNull();
    expect(isoOrNull(undefined)).toBeNull();
    expect(isoOrNull("not a date")).toBeNull();
  });
});
