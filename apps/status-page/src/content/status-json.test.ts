import { describe, expect, test } from "bun:test";

import type { RouterOutputs } from "@openstatus/api";

import {
  matchEndpoint,
  toStatus,
  toSummary,
  toUnresolvedIncidents,
} from "./status-json";

describe("matchEndpoint", () => {
  test("single endpoint segment, no slug", () => {
    expect(matchEndpoint(["summary.json"])).toEqual({
      endpoint: "summary",
      slug: null,
    });
    expect(matchEndpoint(["current.json"])).toEqual({
      endpoint: "status",
      slug: null,
    });
    expect(matchEndpoint(["incidents.json"])).toEqual({
      endpoint: "incidents",
      slug: null,
    });
  });

  test("path-based slug + endpoint", () => {
    expect(matchEndpoint(["acme", "summary.json"])).toEqual({
      endpoint: "summary",
      slug: "acme",
    });
  });

  test("unknown endpoint → null", () => {
    expect(matchEndpoint(["acme", "unknown.json"])).toBeNull();
    expect(matchEndpoint(["summary"])).toBeNull();
  });

  test("empty or too-long paths → null", () => {
    expect(matchEndpoint([])).toBeNull();
    expect(matchEndpoint(["a", "b", "summary.json"])).toBeNull();
  });
});

type Page = NonNullable<RouterOutputs["statusPage"]["get"]>;

const BASE = "https://acme.openstatus.dev";
const NOW = new Date("2026-06-19T12:00:00.000Z").getTime();

const page = {
  title: "Acme Status",
  status: "degraded",
  slug: "acme",
  customDomain: null,
  updatedAt: new Date("2026-06-19T11:00:00.000Z"),
  trackers: [
    {
      type: "component",
      component: { name: "API", status: "error" },
      order: 0,
    },
    {
      type: "group",
      groupName: "Edge",
      components: [{ name: "CDN", status: "success" }],
      status: "success",
      order: 1,
    },
  ],
  statusReports: [
    {
      id: 1,
      title: "API latency",
      status: "investigating",
      createdAt: new Date("2026-06-19T10:00:00.000Z"),
      statusReportUpdates: [
        {
          status: "investigating",
          message: "Looking into it.",
          date: new Date("2026-06-19T10:30:00.000Z"),
        },
      ],
    },
    {
      id: 2,
      title: "Old",
      status: "resolved",
      createdAt: new Date("2026-06-01T10:00:00.000Z"),
      statusReportUpdates: [],
    },
  ],
  maintenances: [
    {
      id: 5,
      title: "DB upgrade",
      from: new Date("2026-06-20T00:00:00.000Z"),
      to: new Date("2026-06-20T01:00:00.000Z"),
    },
  ],
} as unknown as Page;

describe("toStatus", () => {
  test("page block + Statuspage indicator", () => {
    expect(toStatus(page, BASE)).toEqual({
      page: {
        name: "Acme Status",
        url: BASE,
        updated_at: "2026-06-19T11:00:00.000Z",
      },
      status: { indicator: "minor", description: "Degraded Performance" },
    });
  });
});

describe("toSummary", () => {
  const summary = toSummary(page, BASE, NOW);

  test("components carry Statuspage statuses", () => {
    expect(summary.components).toEqual([
      { name: "API", status: "major_outage" },
      { name: "CDN", status: "operational" },
    ]);
  });

  test("only unresolved incidents, with updates", () => {
    expect(summary.incidents).toHaveLength(1);
    expect(summary.incidents[0]).toMatchObject({
      id: "1",
      name: "API latency",
      status: "investigating",
      updated_at: "2026-06-19T10:30:00.000Z",
    });
    expect(summary.incidents[0].incident_updates[0].body).toBe(
      "Looking into it.",
    );
  });

  test("upcoming maintenance scheduled", () => {
    expect(summary.scheduled_maintenances).toHaveLength(1);
    expect(summary.scheduled_maintenances[0]).toMatchObject({
      id: "5",
      status: "scheduled",
      scheduled_for: "2026-06-20T00:00:00.000Z",
    });
  });
});

describe("toUnresolvedIncidents", () => {
  test("excludes resolved", () => {
    const out = toUnresolvedIncidents(page, BASE);
    expect(out.incidents.map((i) => i.id)).toEqual(["1"]);
  });
});
