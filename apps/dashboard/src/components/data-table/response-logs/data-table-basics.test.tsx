import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DataTableBasics, type ResponseLog } from "./data-table-basics";

const log = {
  type: "http",
  id: "log-1",
  url: "https://api.openstatus.dev",
  statusCode: 200,
  requestStatus: "success",
  latency: 150,
  timing: null,
  assertions: null,
  region: "ams",
  error: false,
  timestamp: 1_700_000_000_000,
  cronTimestamp: 1_700_000_000_000,
  headers: null,
  workspaceId: "1",
  message: null,
  body: null,
  monitorId: "1",
  trigger: "cron",
} satisfies ResponseLog;

function attemptsCell(data: ResponseLog) {
  const text = renderToStaticMarkup(<DataTableBasics data={data} />).replace(
    /<[^>]+>/g,
    "|",
  );
  return /Attempts\|+(\d+)/.exec(text)?.[1];
}

describe("DataTableBasics attempts", () => {
  it("shows a stored count, including 1", () => {
    expect(attemptsCell({ ...log, attempts: 1 })).toBe("1");
    expect(attemptsCell({ ...log, attempts: 3 })).toBe("3");
  });

  it("hides the row for on-demand checks with no count", () => {
    expect(attemptsCell(log)).toBeUndefined();
  });

  it("shows the count on the other check types", () => {
    const shared = {
      id: "log-2",
      uri: "api.openstatus.dev:443",
      latency: 10,
      monitorId: "1",
      error: false,
      region: "ams",
      cronTimestamp: 1_700_000_000_000,
      trigger: "cron",
      timestamp: 1_700_000_000_000,
      errorMessage: null,
      requestStatus: "success",
      attempts: 2,
    } as const;

    const rows = [
      { ...shared, type: "tcp" },
      {
        ...shared,
        type: "dns",
        assertions: null,
        records: {},
      },
      {
        ...shared,
        type: "icmp",
        latencyMin: 0,
        latencyMax: 0,
        packetsSent: 0,
        packetsReceived: 0,
      },
      {
        ...shared,
        type: "grpc",
        servingStatus: null,
        grpcCode: null,
        service: null,
      },
    ] satisfies ResponseLog[];

    for (const row of rows) {
      expect(attemptsCell(row)).toBe("2");
    }
  });
});
