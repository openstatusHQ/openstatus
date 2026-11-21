import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { Workspace } from "@openstatus/db/src/schema";
import type { ServiceContext } from "@openstatus/services";
import type { GetMonitorLatencySeriesResult } from "@openstatus/services/monitor";
import { describe, expect, test } from "vitest";

import { createMcpServer } from "../server";
import { MONITOR_CHART_URI, UI_RESOURCE_MIME_TYPE } from "../ui-resources";
import {
  MAX_CHART_REGIONS,
  summarizeChart,
  toChartModel,
} from "./monitor-chart";

const HOUR = 3_600_000;
const T0 = Date.UTC(2026, 8, 8, 20);

function point(region: string, hour: number, p95: number) {
  return {
    region,
    timestamp: T0 + hour * HOUR,
    p50: Math.round(p95 / 2),
    p75: Math.round(p95 * 0.7),
    p90: Math.round(p95 * 0.9),
    p95,
    p99: p95 + 100,
  };
}

function series(
  points: GetMonitorLatencySeriesResult["points"],
): GetMonitorLatencySeriesResult {
  return {
    monitorId: 42,
    name: "API",
    jobType: "http",
    timeRange: "1d",
    interval: 60,
    regions: [...new Set(points.map((p) => p.region))].sort(),
    points,
  };
}

describe("toChartModel", () => {
  test("pivots rows into series aligned with the timestamps", () => {
    const model = toChartModel(
      series([
        point("iad", 0, 200),
        point("fra", 0, 300),
        point("fra", 1, 911),
        point("iad", 2, 250),
      ]),
      "p95",
    );
    expect(model.timestamps).toEqual([T0, T0 + HOUR, T0 + 2 * HOUR]);
    expect(model.series).toEqual([
      { region: "fra", values: [300, 911, null] },
      { region: "iad", values: [200, null, 250] },
    ]);
    expect(model.peak).toEqual({
      region: "fra",
      value: 911,
      timestamp: T0 + HOUR,
    });
    expect(model.dashboardUrl).toMatch(/\/monitors\/42\/overview$/);
  });

  test("plots the requested percentile", () => {
    const model = toChartModel(series([point("fra", 0, 300)]), "p99");
    expect(model.series[0]?.values).toEqual([400]);
  });

  test("keeps the slowest regions and names the rest", () => {
    const regions = ["ams", "fra", "gru", "hkg", "iad", "jnb", "lax", "syd"];
    const model = toChartModel(
      series(regions.map((region, i) => point(region, 0, 100 * (i + 1)))),
      "p95",
    );
    expect(model.series).toHaveLength(MAX_CHART_REGIONS);
    expect(model.series.map((s) => s.region)).toEqual([
      "gru",
      "hkg",
      "iad",
      "jnb",
      "lax",
      "syd",
    ]);
    expect(model.omittedRegions).toEqual(["ams", "fra"]);
  });

  test("an empty window has no peak and still summarizes", () => {
    const model = toChartModel(series([]), "p95");
    expect(model.peak).toBeNull();
    expect(model.series).toEqual([]);
    expect(summarizeChart(model)).toContain("No checks recorded");
  });
});

describe("summarizeChart", () => {
  test("carries the numbers a host without MCP Apps needs", () => {
    const text = summarizeChart(
      toChartModel(
        series([
          point("fra", 0, 300),
          point("fra", 1, 900),
          point("iad", 0, 200),
        ]),
        "p95",
      ),
    );
    expect(text).toContain(
      'p95 latency for "API" over the last 1d (1h buckets).',
    );
    expect(text).toContain("Peak: 900 ms in fra at 2026-09-08T21:00:00.000Z.");
    expect(text).toContain("Mean by region: fra 600 ms, iad 200 ms.");
  });
});

const workspace = {
  id: 1,
  slug: "ws",
  name: "ws",
  limits: {},
} as unknown as Workspace;

function ctx(scopes: string[]): ServiceContext {
  return {
    workspace,
    actor: { type: "mcp", keyId: "k", scopes: scopes as never },
  };
}

async function connect(scopes: string[], experimental: boolean) {
  const server = createMcpServer(ctx(scopes), { experimental });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0.0.0" });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  return client;
}

describe("render_monitor_chart registration", () => {
  test("is absent unless the experimental surface is requested", async () => {
    const client = await connect(["read"], false);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).not.toContain("render_monitor_chart");
    const { resources } = await client.listResources();
    expect(resources.map((r) => r.uri)).not.toContain(MONITOR_CHART_URI);
  });

  test("links the tool to a readable MCP App resource", async () => {
    const client = await connect(["monitors:read"], true);
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === "render_monitor_chart");
    expect(tool?._meta).toEqual({
      ui: { resourceUri: MONITOR_CHART_URI },
      "ui/resourceUri": MONITOR_CHART_URI,
    });
    expect(tool?.annotations?.readOnlyHint).toBe(true);

    const { contents } = await client.readResource({ uri: MONITOR_CHART_URI });
    expect(contents[0]?.mimeType).toBe(UI_RESOURCE_MIME_TYPE);
    const html = contents[0] && "text" in contents[0] ? contents[0].text : "";
    expect(html).toContain("<!doctype html>");
    expect(html).not.toContain("/*__SCRIPT__*/");
  });

  test("is hidden from a key without monitors:read", async () => {
    const client = await connect(["pages:read"], true);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).not.toContain("render_monitor_chart");
  });
});
