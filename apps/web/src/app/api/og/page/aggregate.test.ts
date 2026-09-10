import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  type ComponentUptime,
  aggregatePageDays,
  aggregateUptime,
  safeIconUrl,
  stateContext,
} from "./aggregate";

function day(iso: string, bar: ComponentUptime["data"][number]["bar"]) {
  return { day: `${iso}T00:00:00.000Z`, bar };
}

function monitor(
  uptime: string,
  data: ComponentUptime["data"],
): ComponentUptime {
  return { type: "monitor", uptime, data };
}

describe("aggregatePageDays", () => {
  test("returns empty array for no components", () => {
    expect(aggregatePageDays([])).toEqual([]);
  });

  test("takes the worst status across components on the same day", () => {
    const a = monitor("100%", [
      day("2026-07-16", [{ status: "success", height: 100 }]),
    ]);
    const b = monitor("98%", [
      day("2026-07-16", [
        { status: "success", height: 90 },
        { status: "error", height: 10 },
      ]),
    ]);
    expect(aggregatePageDays([a, b])).toEqual([
      { day: "2026-07-16", status: "error" },
    ]);
  });

  test("ignores zero-height segments", () => {
    const a = monitor("100%", [
      day("2026-07-16", [
        { status: "success", height: 100 },
        { status: "error", height: 0 },
      ]),
    ]);
    expect(aggregatePageDays([a])).toEqual([
      { day: "2026-07-16", status: "success" },
    ]);
  });

  test("ranks degraded above info and info above success", () => {
    const a = monitor("100%", [
      day("2026-07-15", [
        { status: "info", height: 20 },
        { status: "degraded", height: 10 },
        { status: "success", height: 70 },
      ]),
      day("2026-07-16", [
        { status: "info", height: 30 },
        { status: "success", height: 70 },
      ]),
    ]);
    expect(aggregatePageDays([a])).toEqual([
      { day: "2026-07-15", status: "degraded" },
      { day: "2026-07-16", status: "info" },
    ]);
  });

  test("marks days without positive segments as empty", () => {
    const a = monitor("100%", [day("2026-07-16", [])]);
    expect(aggregatePageDays([a])).toEqual([
      { day: "2026-07-16", status: "empty" },
    ]);
  });

  test("includes days missing from one component and sorts ascending", () => {
    const a = monitor("100%", [
      day("2026-07-16", [{ status: "success", height: 100 }]),
    ]);
    const b = monitor("100%", [
      day("2026-07-15", [{ status: "success", height: 100 }]),
      day("2026-07-16", [{ status: "success", height: 100 }]),
    ]);
    expect(aggregatePageDays([a, b])).toEqual([
      { day: "2026-07-15", status: "success" },
      { day: "2026-07-16", status: "success" },
    ]);
  });
});

describe("aggregateUptime", () => {
  test("returns null for no monitor components", () => {
    expect(aggregateUptime([])).toBeNull();
    expect(
      aggregateUptime([{ type: "static", uptime: "100%", data: [] }]),
    ).toBeNull();
  });

  test("returns the single monitor's uptime unchanged", () => {
    expect(aggregateUptime([monitor("99.98%", [])])).toBe("99.98%");
  });

  test("averages multiple monitors floored to two decimals", () => {
    expect(aggregateUptime([monitor("100%", []), monitor("99.96%", [])])).toBe(
      "99.98%",
    );
  });

  test("excludes non-monitor components from the average", () => {
    expect(
      aggregateUptime([
        monitor("99.5%", []),
        { type: "static", uptime: "100%", data: [] },
      ]),
    ).toBe("99.5%");
  });

  test("returns null when an uptime value is unparsable", () => {
    expect(
      aggregateUptime([monitor("n/a", []), monitor("100%", [])]),
    ).toBeNull();
  });
});

describe("safeIconUrl", () => {
  const BLOB = "https://abc123.public.blob.vercel-storage.com/acme/icon.png";

  test("returns null for missing or non-URL values", () => {
    expect(safeIconUrl(null)).toBeNull();
    expect(safeIconUrl(undefined)).toBeNull();
    expect(safeIconUrl("")).toBeNull();
    expect(safeIconUrl("favicon.ico")).toBeNull();
  });

  test("accepts raster icons on the upload storage host", () => {
    expect(safeIconUrl(BLOB)).toBe(BLOB);
    expect(safeIconUrl(`${BLOB}?v=1`)).toBe(`${BLOB}?v=1`);
  });

  test("rejects non-https URLs even on the allowed host", () => {
    expect(
      safeIconUrl("http://abc123.public.blob.vercel-storage.com/x.png"),
    ).toBeNull();
  });

  test("rejects other hosts, including lookalike suffixes", () => {
    expect(safeIconUrl("https://evil.com/icon.png")).toBeNull();
    expect(safeIconUrl("https://server:3000/internal.png")).toBeNull();
    expect(
      safeIconUrl("https://x.public.blob.vercel-storage.com.evil.com/a.png"),
    ).toBeNull();
  });

  test("rejects non-raster paths on the allowed host", () => {
    expect(
      safeIconUrl("https://abc123.public.blob.vercel-storage.com/icon.svg"),
    ).toBeNull();
    expect(
      safeIconUrl("https://abc123.public.blob.vercel-storage.com/favicon.ico"),
    ).toBeNull();
  });
});

describe("stateContext", () => {
  const NOW = new Date("2026-07-17T15:00:00.000Z");

  test("returns null for operational and empty variants", () => {
    expect(stateContext("up", {}, NOW)).toBeNull();
    expect(stateContext("empty", {}, NOW)).toBeNull();
  });

  test("degraded uses the active report title and earliest update time", () => {
    const context = stateContext(
      "degraded",
      {
        statusReports: [
          { title: "Resolved one", status: "resolved" },
          {
            title: "Elevated error rates",
            status: "investigating",
            statusReportUpdates: [
              { date: new Date("2026-07-17T14:40:00.000Z") },
              { date: new Date("2026-07-17T14:22:00.000Z") },
            ],
          },
        ],
      },
      NOW,
    );
    expect(context).toBe("Elevated error rates · started Jul 17, 14:22 UTC");
  });

  test("degraded without updates falls back to the title", () => {
    expect(
      stateContext(
        "degraded",
        { statusReports: [{ title: "API issues", status: "identified" }] },
        NOW,
      ),
    ).toBe("API issues");
  });

  test("maintenance shows the active window end", () => {
    expect(
      stateContext(
        "maintenance",
        {
          maintenances: [
            {
              title: "Database upgrade",
              from: new Date("2026-07-17T14:00:00.000Z"),
              to: new Date("2026-07-17T16:30:00.000Z"),
            },
          ],
        },
        NOW,
      ),
    ).toBe("Database upgrade · until Jul 17, 16:30 UTC");
  });

  test("incident uses the ongoing incident start time", () => {
    expect(
      stateContext(
        "incident",
        {
          incidents: [
            {
              startedAt: new Date("2026-07-17T13:05:00.000Z"),
              resolvedAt: null,
            },
          ],
        },
        NOW,
      ),
    ).toBe("Ongoing incident · started Jul 17, 13:05 UTC");
  });

  test("down without an ongoing incident returns null", () => {
    expect(
      stateContext(
        "down",
        {
          incidents: [
            {
              startedAt: new Date("2026-07-17T10:00:00.000Z"),
              resolvedAt: new Date("2026-07-17T11:00:00.000Z"),
            },
          ],
        },
        NOW,
      ),
    ).toBeNull();
  });
});
