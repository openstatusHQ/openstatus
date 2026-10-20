import type { RouterOutputs } from "@openstatus/api";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DataTableBasics } from "./data-table-basics";

type TCPLog = Extract<
  RouterOutputs["tinybird"]["get"]["data"][number],
  { type: "tcp" }
>;

const tcpLog: TCPLog = {
  type: "tcp",
  id: "log-1",
  uri: "openstatus.dev:443",
  latency: 42,
  monitorId: "1",
  error: false,
  region: "ams",
  cronTimestamp: 1_700_000_000_000,
  trigger: "cron",
  timestamp: 1_700_000_000_000,
  requestStatus: "success",
  errorMessage: null,
};

function text(attempts: number | undefined, log: TCPLog = tcpLog) {
  return renderToStaticMarkup(
    <DataTableBasics data={log} attempts={attempts} />,
  ).replace(/<[^>]+>/g, " ");
}

describe("DataTableBasics attempts row", () => {
  it("is hidden when the check passed first time", () => {
    expect(text(undefined)).not.toContain("Attempts");
    expect(text(1)).not.toContain("Attempts");
  });

  it("shows which attempt passed", () => {
    expect(text(3)).toContain("Attempts");
    expect(text(3)).toContain("passed on attempt 3");
  });

  it("says when every attempt failed", () => {
    const failed: TCPLog = { ...tcpLog, error: true, requestStatus: "error" };
    expect(text(2, failed)).toContain("all failed");
  });
});
