import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { agentTools } from "../index";
import type { AnyAgentTool, SummaryLine } from "../types";

function summarize(
  toolName: keyof typeof agentTools,
  input: unknown,
): SummaryLine[] {
  const tool = agentTools[toolName] as AnyAgentTool;
  if (!tool.approval) throw new Error(`${toolName} has no approval`);
  return tool.approval.summarize(input).lines;
}

function line(lines: SummaryLine[], label: string): SummaryLine {
  const found = lines.find((l) => l.label === label);
  if (!found) throw new Error(`no "${label}" line`);
  return found;
}

describe("summary-line refs", () => {
  test("create_status_report tags the page line with a page ref", () => {
    const lines = summarize("create_status_report", {
      title: "Outage",
      status: "investigating",
      message: "m",
      pageId: 2705,
      pageComponentIds: [],
    });
    expect(line(lines, "Page ID").ref).toEqual({ kind: "page", pageId: 2705 });
  });

  test("create_status_report tags components and impacts with refs", () => {
    const lines = summarize("create_status_report", {
      title: "Outage",
      status: "investigating",
      message: "m",
      pageId: 1,
      pageComponentIds: [101, 102],
      componentImpacts: [{ pageComponentId: 101, impact: "major_outage" }],
    });
    expect(line(lines, "Components").ref).toEqual({
      kind: "components",
      componentIds: [101, 102],
    });
    expect(line(lines, "Impacts").ref).toEqual({
      kind: "componentImpacts",
      impacts: [{ pageComponentId: 101, impact: "major_outage" }],
    });
  });

  test("add_status_report_update tags impacts with a componentImpacts ref", () => {
    const lines = summarize("add_status_report_update", {
      statusReportId: 42,
      status: "monitoring",
      message: "m",
      componentImpacts: [{ pageComponentId: 7, impact: "partial_outage" }],
    });
    expect(line(lines, "Impacts").ref).toEqual({
      kind: "componentImpacts",
      impacts: [{ pageComponentId: 7, impact: "partial_outage" }],
    });
  });

  test("create_maintenance tags the page and components lines", () => {
    const lines = summarize("create_maintenance", {
      title: "DB Upgrade",
      message: "m",
      from: "2026-06-01T00:00:00Z",
      to: "2026-06-01T01:00:00Z",
      pageId: 7,
      pageComponentIds: [1, 2],
    });
    expect(line(lines, "Page ID").ref).toEqual({ kind: "page", pageId: 7 });
    expect(line(lines, "Components").ref).toEqual({
      kind: "components",
      componentIds: [1, 2],
    });
  });

  test("update_status_report tags components when ids are present", () => {
    const lines = summarize("update_status_report", {
      statusReportId: 10,
      pageComponentIds: [1, 2],
    });
    expect(line(lines, "Components").ref).toEqual({
      kind: "components",
      componentIds: [1, 2],
    });
  });

  test("update_status_report leaves the '(clear all)' line ref-less", () => {
    const lines = summarize("update_status_report", {
      statusReportId: 10,
      pageComponentIds: [],
    });
    const components = line(lines, "Components");
    expect(components.value).toBe("(clear all)");
    expect(components.ref).toBeUndefined();
  });
});
