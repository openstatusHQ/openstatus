import { describe, expect, test } from "bun:test";
import type { Workspace } from "@openstatus/db/src/schema/workspaces/validation";
import { createAddStatusReportUpdateTool } from "./add-status-report-update";
import { createCreateStatusReportTool } from "./create-status-report";
import { createTools } from "./index";
import { createUpdateStatusReportTool } from "./update-status-report";

const mockWorkspace = {
  id: 1,
  name: "Test",
  slug: "test",
  plan: "free",
  limits: {},
} as Workspace;

describe("createTools", () => {
  test("returns all expected tool keys", () => {
    const tools = createTools(mockWorkspace);
    expect(Object.keys(tools).sort()).toEqual([
      "addStatusReportUpdate",
      "createStatusReport",
      "listStatusPages",
      "listStatusReports",
      "resolveStatusReport",
      "updateStatusReport",
    ]);
  });
});

describe("createCreateStatusReportTool", () => {
  const tool = createCreateStatusReportTool();

  test("returns needsConfirmation with params", async () => {
    const input = {
      title: "API Outage",
      status: "investigating" as const,
      message: "We are investigating the issue",
      pageId: 1,
    };
    const result = await tool.execute(input, {
      toolCallId: "test",
      messages: [],
    });
    expect(result).toEqual({ needsConfirmation: true, params: input });
  });

  test("includes optional pageComponentIds", async () => {
    const input = {
      title: "Outage",
      status: "investigating" as const,
      message: "msg",
      pageId: 1,
      pageComponentIds: ["comp-1", "comp-2"],
    };
    const result = await tool.execute(input, {
      toolCallId: "test",
      messages: [],
    });
    expect(result.params.pageComponentIds).toEqual(["comp-1", "comp-2"]);
  });
});

describe("createAddStatusReportUpdateTool", () => {
  const tool = createAddStatusReportUpdateTool();

  test("returns needsConfirmation with params", async () => {
    const input = {
      statusReportId: 42,
      status: "identified" as const,
      message: "Root cause identified",
    };
    const result = await tool.execute(input, {
      toolCallId: "test",
      messages: [],
    });
    expect(result).toEqual({ needsConfirmation: true, params: input });
  });

  test("works with resolved status", async () => {
    const input = {
      statusReportId: 42,
      status: "resolved" as const,
      message: "Issue has been fixed",
    };
    const result = await tool.execute(input, {
      toolCallId: "test",
      messages: [],
    });
    expect(result.params.status).toBe("resolved");
  });
});

describe("createUpdateStatusReportTool", () => {
  const tool = createUpdateStatusReportTool();

  test("returns needsConfirmation with title update", async () => {
    const input = {
      statusReportId: 10,
      title: "Updated Title",
    };
    const result = await tool.execute(input, {
      toolCallId: "test",
      messages: [],
    });
    expect(result).toEqual({ needsConfirmation: true, params: input });
  });

  test("works with only pageComponentIds", async () => {
    const input = {
      statusReportId: 10,
      pageComponentIds: ["comp-1"],
    };
    const result = await tool.execute(input, {
      toolCallId: "test",
      messages: [],
    });
    expect(result.params.pageComponentIds).toEqual(["comp-1"]);
  });

  test("works with both title and components", async () => {
    const input = {
      statusReportId: 10,
      title: "New Title",
      pageComponentIds: ["comp-1", "comp-2"],
    };
    const result = await tool.execute(input, {
      toolCallId: "test",
      messages: [],
    });
    expect(result.params.title).toBe("New Title");
    expect(result.params.pageComponentIds).toEqual(["comp-1", "comp-2"]);
  });

  test("works with only statusReportId", async () => {
    const input = { statusReportId: 10 };
    const result = await tool.execute(input, {
      toolCallId: "test",
      messages: [],
    });
    expect(result.params.statusReportId).toBe(10);
  });
});
