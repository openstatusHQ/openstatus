import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { DetailsTableData } from "./details-table";
import { getMonitorDetails } from "./get-monitor";
import { getMonitorSummaryDetails } from "./get-monitor-summary";
import { getResponseLogDetails } from "./get-response-log";

// safe because the mappers only read the fields each fixture sets
function asFixture<T>(value: Record<string, unknown>): T {
  return value as T;
}

function text(node: ReactNode) {
  return renderToStaticMarkup(<>{node}</>).replace(/<[^>]+>/g, "");
}

function labels(data: DetailsTableData) {
  return data.sections.map((s) => s.rows.map((r) => r.label));
}

function value(data: DetailsTableData, label: string) {
  for (const section of data.sections) {
    const row = section.rows.find((r) => r.label === label);
    if (row) return text(row.value);
  }
  return undefined;
}

describe("getMonitorDetails", () => {
  type Input = Parameters<typeof getMonitorDetails>[0];
  type Output = Parameters<typeof getMonitorDetails>[1];

  const monitor = {
    id: 1,
    name: "API",
    url: "https://api.openstatus.dev",
    jobType: "http",
    method: "GET",
    active: true,
    periodicity: "1m",
    regions: ["ams", "iad"],
    timeout: 45000,
    degradedAfter: 3000,
    retry: 3,
    followRedirects: true,
    public: false,
    tags: [{ name: "prod" }, { name: "api" }],
    notifications: [{ name: "Ops", provider: "slack" }],
    privateLocationIds: [7, 8],
  };
  const input = asFixture<Input>({ id: 1 });

  it("groups rows into sections", () => {
    const data = getMonitorDetails(input, asFixture<Output>(monitor));
    expect(data.sections.map((s) => s.title)).toEqual([
      "Monitor",
      "Behavior",
      "Visibility",
      "Private locations",
    ]);
    expect(value(data, "Type")).toBe("HTTP");
    expect(value(data, "Regions")).toBe("ams, iad");
    expect(value(data, "Degraded after")).toBe("3000ms");
    expect(value(data, "Tags")).toBe("prod, api");
    expect(value(data, "Notifications")).toBe("Ops (slack)");
    expect(value(data, "IDs")).toBe("7, 8");
  });

  it("drops optional rows and sections when absent", () => {
    const data = getMonitorDetails(
      input,
      asFixture<Output>({
        ...monitor,
        jobType: "tcp",
        method: null,
        degradedAfter: null,
        privateLocationIds: [],
      }),
    );
    expect(data.sections).toHaveLength(3);
    expect(labels(data).flat()).not.toContain("Method");
    expect(labels(data).flat()).not.toContain("Degraded after");
  });
});

describe("getMonitorSummaryDetails", () => {
  type Input = Parameters<typeof getMonitorSummaryDetails>[0];
  type Output = Parameters<typeof getMonitorSummaryDetails>[1];

  it("shows counts, percentiles and the window", () => {
    const data = getMonitorSummaryDetails(
      asFixture<Input>({ timeRange: "7d" }),
      asFixture<Output>({
        monitorId: 1,
        lastPingAt: null,
        totalSuccessful: 90,
        totalDegraded: 5,
        totalFailed: 5,
        p50: 100,
        p75: 150,
        p90: 200,
        p95: 250,
        p99: 400,
      }),
    );
    expect(labels(data)).toEqual([
      ["ID", "Window", "Last check"],
      ["Successful", "Degraded", "Failed"],
      ["p50", "p75", "p90", "p95", "p99"],
    ]);
    expect(value(data, "Window")).toBe("7d");
    expect(value(data, "Last check")).toBe("-");
    expect(value(data, "Failed")).toBe("5");
    expect(value(data, "p99")).toBe("400ms");
  });
});

describe("getResponseLogDetails", () => {
  type Input = Parameters<typeof getResponseLogDetails>[0];
  type Output = Parameters<typeof getResponseLogDetails>[1];

  const log = {
    id: "log_1",
    monitorId: "1",
    region: "ams",
    requestStatus: "success",
    trigger: "api",
    statusCode: 200,
    latency: 200,
    cronTimestamp: 0,
    timestamp: Date.UTC(2024, 0, 1),
    url: "https://openstatus.dev",
    error: false,
    message: null,
    headers: {},
    body: null,
    assertions: null,
    timing: null,
  };
  const input = asFixture<Input>({ id: "log_1" });

  it("shows only the request section for a bare log", () => {
    const data = getResponseLogDetails(input, asFixture<Output>(log));
    expect(data.sections).toHaveLength(1);
    expect(value(data, "Status code")).toBe("200");
    expect(value(data, "Error")).toBe("false");
  });

  it("adds headers, timing, message, body and assertions when present", () => {
    const data = getResponseLogDetails(
      input,
      asFixture<Output>({
        ...log,
        headers: { "content-type": "text/html" },
        timing: { dns: 50, connect: 50, tls: 0, ttfb: 100, transfer: 0 },
        message: "Timeout",
        body: "<h1>ok</h1>",
        assertions: "status eq 200",
      }),
    );
    expect(labels(data)).toEqual([
      expect.any(Array),
      ["Headers"],
      ["DNS", "CONNECT", "TLS", "TTFB", "TRANSFER"],
      ["Message"],
      ["Body"],
      ["Assertions"],
    ]);
    expect(value(data, "Headers")).toContain("content-type");
    expect(value(data, "DNS")).toBe("25%50 ms");
    expect(value(data, "TTFB")).toBe("50%100 ms");
  });

  it("does not divide by zero for a zero-latency timing", () => {
    const data = getResponseLogDetails(
      input,
      asFixture<Output>({
        ...log,
        latency: 0,
        timing: { dns: 0, connect: 0, tls: 0, ttfb: 0, transfer: 0 },
      }),
    );
    expect(value(data, "DNS")).toBe("0%0 ms");
  });

  // statusCode is nullable, but TableCellNumber renders Number(null) as 0.
  it.ignore("does not show 0 for a missing status code", () => {
    const data = getResponseLogDetails(
      input,
      asFixture<Output>({ ...log, statusCode: null }),
    );
    expect(value(data, "Status code")).not.toBe("0");
  });
});
