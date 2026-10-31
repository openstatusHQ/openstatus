import { describe, expect, it } from "vitest";

import { addPageComponentChanges } from "./add-page-component";
import { createMonitorChanges, formatFirstCheck } from "./create-monitor";
import { createStatusPageChanges } from "./create-status-page";

// safe because the mappers only read the fields each fixture sets
function as<T>(value: Record<string, unknown>): T {
  return value as T;
}

describe("createMonitorChanges", () => {
  type Input = Parameters<typeof createMonitorChanges>[0];
  const input = as<Input>({
    name: "API",
    url: "https://api.acme.com",
    jobType: "http",
    method: "GET",
    active: true,
  });

  it("falls back to the plan defaults in the draft", () => {
    expect(createMonitorChanges(input)).toEqual([
      { field: "name", after: "API" },
      { field: "url", after: "https://api.acme.com" },
      { field: "jobType", after: "http" },
      { field: "method", after: "GET" },
      { field: "periodicity", after: "plan default" },
      { field: "regions", after: "plan default" },
      { field: "active", after: true },
    ]);
  });

  it("leads with the id and shows the applied schedule and first check", () => {
    const rows = createMonitorChanges(input, {
      monitor: {
        id: 7,
        name: "API",
        url: "https://api.acme.com",
        jobType: "http",
        periodicity: "1m",
        regions: ["ams", "iad"],
        active: true,
        dashboardUrl: "http://localhost:3001/monitors/7/overview",
      },
      firstCheck: {
        region: "ams",
        state: "success",
        status: 200,
        latency: 143,
      },
    });
    expect(rows[0]).toEqual({ field: "id", after: 7 });
    expect(rows).toContainEqual({ field: "periodicity", after: "1m" });
    expect(rows).toContainEqual({ field: "regions", after: ["ams", "iad"] });
    expect(rows.at(-1)).toEqual({
      field: "firstCheck",
      after: "ams · 200 · 143 ms",
    });
  });

  it("omits method and first check for non-http monitors", () => {
    const rows = createMonitorChanges(
      as<Input>({ name: "DB", url: "db.acme.com:5432", jobType: "tcp" }),
      {
        monitor: {
          id: 8,
          name: "DB",
          url: "db.acme.com:5432",
          jobType: "tcp",
          periodicity: "1m",
          regions: ["ams"],
          active: true,
          dashboardUrl: "",
        },
        firstCheck: null,
      },
    );
    expect(rows.map((r) => r.field)).not.toContain("method");
    expect(rows.map((r) => r.field)).not.toContain("firstCheck");
  });
});

describe("formatFirstCheck", () => {
  it("formats success, error and missing probes", () => {
    expect(formatFirstCheck(null)).toBe("—");
    expect(
      formatFirstCheck({ region: "fra", state: "error", message: "timeout" }),
    ).toBe("fra · error: timeout");
  });
});

describe("createStatusPageChanges", () => {
  type Input = Parameters<typeof createStatusPageChanges>[0];

  it("lists title and slug for the draft", () => {
    expect(
      createStatusPageChanges(as<Input>({ title: "Acme", slug: "acme" })),
    ).toEqual([
      { field: "title", after: "Acme" },
      { field: "slug", after: "acme" },
    ]);
  });

  it("adds id and url once applied", () => {
    expect(
      createStatusPageChanges(
        as<Input>({ title: "Acme", slug: "Acme", description: "Status" }),
        {
          id: 3,
          slug: "acme",
          title: "Acme",
          url: "https://acme.openstatus.dev",
          dashboardUrl: "",
        },
      ),
    ).toEqual([
      { field: "id", after: 3 },
      { field: "title", after: "Acme" },
      { field: "slug", after: "acme" },
      { field: "description", after: "Status" },
      { field: "url", after: "https://acme.openstatus.dev" },
    ]);
  });
});

describe("addPageComponentChanges", () => {
  type Input = Parameters<typeof addPageComponentChanges>[0];

  it("keeps the ids as entity refs and the name optional", () => {
    expect(
      addPageComponentChanges(as<Input>({ pageId: 3, monitorId: 12 })),
    ).toEqual([
      { field: "pageId", after: 3 },
      { field: "monitorId", after: 12 },
    ]);
  });

  it("prefers the applied name and appends the order", () => {
    expect(
      addPageComponentChanges(as<Input>({ pageId: 3, monitorId: 12 }), {
        id: 9,
        pageId: 3,
        monitorId: 12,
        name: "API",
        order: 4,
      }),
    ).toEqual([
      { field: "id", after: 9 },
      { field: "pageId", after: 3 },
      { field: "monitorId", after: 12 },
      { field: "name", after: "API" },
      { field: "order", after: 4 },
    ]);
  });
});
