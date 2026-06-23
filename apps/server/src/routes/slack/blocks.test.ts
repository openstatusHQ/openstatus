import { agentTools } from "@openstatus/services/agent-tools";
import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  buildConfirmationBlocks,
  getConfirmationText,
  parseActionId,
} from "./blocks";

describe("buildConfirmationBlocks", () => {
  test("create_status_report has approve / approve_flag / cancel", () => {
    const tool = agentTools.create_status_report;
    const blocks = buildConfirmationBlocks({
      actionId: "abc123",
      tool,
      input: {
        title: "API Outage",
        status: "investigating",
        message: "API is returning 500 errors",
        pageId: 1,
        pageComponentIds: [],
      },
    });

    const section = blocks.find((b) => b.type === "section");
    expect(section).toBeDefined();
    expect((section as { text: { text: string } }).text.text).toContain(
      "API Outage",
    );

    const actions = blocks.find((b) => b.type === "actions") as {
      elements: { action_id: string; text: { text: string } }[];
    };
    expect(actions.elements).toHaveLength(3);
    expect(actions.elements[0].action_id).toBe("approve_abc123");
    expect(actions.elements[1].action_id).toBe("approve_flag_abc123");
    expect(actions.elements[1].text.text).toBe("Approve & Notify subscribers");
    expect(actions.elements[2].action_id).toBe("cancel_abc123");
  });

  test("create_status_report shows components when provided", () => {
    const tool = agentTools.create_status_report;
    const blocks = buildConfirmationBlocks({
      actionId: "id1",
      tool,
      input: {
        title: "Test",
        status: "investigating",
        message: "msg",
        pageId: 1,
        pageComponentIds: [101, 102],
      },
    });
    const section = blocks.find((b) => b.type === "section") as {
      text: { text: string };
    };
    expect(section.text.text).toContain("101, 102");
  });

  test("create_status_report shows impacts when provided", () => {
    const tool = agentTools.create_status_report;
    const blocks = buildConfirmationBlocks({
      actionId: "i1",
      tool,
      input: {
        title: "Test",
        status: "investigating",
        message: "msg",
        pageId: 1,
        pageComponentIds: [101],
        componentImpacts: [
          { pageComponentId: 101, impact: "major_outage" },
          { pageComponentId: 102, impact: "degraded_performance" },
        ],
      },
    });
    const section = blocks.find((b) => b.type === "section") as {
      text: { text: string };
    };
    expect(section.text.text).toContain("Impacts");
    expect(section.text.text).toContain("101 → major_outage");
    expect(section.text.text).toContain("102 → degraded_performance");
  });

  test("add_status_report_update shows impacts when provided", () => {
    const tool = agentTools.add_status_report_update;
    const blocks = buildConfirmationBlocks({
      actionId: "i2",
      tool,
      input: {
        statusReportId: 42,
        status: "monitoring",
        message: "recovering",
        componentImpacts: [{ pageComponentId: 7, impact: "partial_outage" }],
      },
    });
    const section = blocks.find((b) => b.type === "section") as {
      text: { text: string };
    };
    expect(section.text.text).toContain("Impacts");
    expect(section.text.text).toContain("7 → partial_outage");
  });

  test("add_status_report_update has 3 buttons", () => {
    const tool = agentTools.add_status_report_update;
    const blocks = buildConfirmationBlocks({
      actionId: "abc",
      tool,
      input: {
        statusReportId: 42,
        status: "identified",
        message: "Root cause found",
      },
    });

    const section = blocks.find((b) => b.type === "section") as {
      text: { text: string };
    };
    expect(section.text.text).toContain("42");
    expect(section.text.text).toContain("identified");

    const actions = blocks.find((b) => b.type === "actions") as {
      elements: { action_id: string }[];
    };
    expect(actions.elements).toHaveLength(3);
  });

  test("update_status_report distinguishes 'clear all' from 'no change' for components", () => {
    const tool = agentTools.update_status_report;

    // pageComponentIds undefined → no Components line at all
    const noChange = buildConfirmationBlocks({
      actionId: "u1",
      tool,
      input: { statusReportId: 10, title: "X" },
    });
    const noChangeText = (
      noChange.find((b) => b.type === "section") as {
        text: { text: string };
      }
    ).text.text;
    expect(noChangeText).not.toContain("Components");

    // pageComponentIds: [] → "(clear all)"
    const clearAll = buildConfirmationBlocks({
      actionId: "u2",
      tool,
      input: { statusReportId: 10, pageComponentIds: [] },
    });
    const clearAllText = (
      clearAll.find((b) => b.type === "section") as {
        text: { text: string };
      }
    ).text.text;
    expect(clearAllText).toContain("(clear all)");

    // pageComponentIds: [1,2] → list
    const withIds = buildConfirmationBlocks({
      actionId: "u3",
      tool,
      input: { statusReportId: 10, pageComponentIds: [1, 2] },
    });
    const withIdsText = (
      withIds.find((b) => b.type === "section") as {
        text: { text: string };
      }
    ).text.text;
    expect(withIdsText).toContain("1, 2");
  });

  test("update_status_report has 2 buttons (no notify flag)", () => {
    const tool = agentTools.update_status_report;
    const blocks = buildConfirmationBlocks({
      actionId: "xyz",
      tool,
      input: { statusReportId: 10, title: "Updated Title" },
    });

    const section = blocks.find((b) => b.type === "section") as {
      text: { text: string };
    };
    expect(section.text.text).toContain("Updated Title");

    const actions = blocks.find((b) => b.type === "actions") as {
      elements: { action_id: string }[];
    };
    expect(actions.elements).toHaveLength(2);
    expect(actions.elements[0].action_id).toBe("approve_xyz");
    expect(actions.elements[1].action_id).toBe("cancel_xyz");
  });

  test("create_maintenance card shows pageId", () => {
    const tool = agentTools.create_maintenance;
    const blocks = buildConfirmationBlocks({
      actionId: "m1",
      tool,
      input: {
        title: "DB Upgrade",
        message: "Restarting replicas",
        from: "2026-06-01T00:00:00Z",
        to: "2026-06-01T01:00:00Z",
        pageId: 7,
        pageComponentIds: [],
      },
    });
    const text = (
      blocks.find((b) => b.type === "section") as {
        text: { text: string };
      }
    ).text.text;
    expect(text).toContain("Page ID");
    expect(text).toContain("7");
  });

  test("resolve_status_report has 3 buttons", () => {
    const tool = agentTools.resolve_status_report;
    const blocks = buildConfirmationBlocks({
      actionId: "res1",
      tool,
      input: { statusReportId: 5, message: "Issue has been resolved" },
    });

    const section = blocks.find((b) => b.type === "section") as {
      text: { text: string };
    };
    expect(section.text.text).toContain("5");
    expect(section.text.text).toContain("Issue has been resolved");

    const actions = blocks.find((b) => b.type === "actions") as {
      elements: { action_id: string }[];
    };
    expect(actions.elements).toHaveLength(3);
  });

  test("all blocks include a divider", () => {
    const tool = agentTools.create_status_report;
    const blocks = buildConfirmationBlocks({
      actionId: "d1",
      tool,
      input: {
        title: "T",
        status: "investigating",
        message: "m",
        pageId: 1,
        pageComponentIds: [],
      },
    });
    expect(blocks.some((b) => b.type === "divider")).toBe(true);
  });
});

describe("getConfirmationText", () => {
  test("uses summarize().title for tools with approval", () => {
    expect(
      getConfirmationText({
        tool: agentTools.create_status_report,
        input: {
          title: "API Outage",
          status: "investigating",
          message: "m",
          pageId: 1,
          pageComponentIds: [],
        },
      }),
    ).toBe("Create Status Report: API Outage");
  });

  test("update_status_report includes the new title when provided", () => {
    expect(
      getConfirmationText({
        tool: agentTools.update_status_report,
        input: { statusReportId: 1, title: "Renamed" },
      }),
    ).toBe("Update Status Report: Renamed");
  });

  test("resolve_status_report has a fixed title", () => {
    expect(
      getConfirmationText({
        tool: agentTools.resolve_status_report,
        input: { statusReportId: 1, message: "fixed" },
      }),
    ).toBe("Resolve Status Report");
  });
});

describe("buildConfirmationBlocks (error paths)", () => {
  test("throws when the tool has no approval metadata", () => {
    const readTool = agentTools.list_status_pages;
    expect(() =>
      buildConfirmationBlocks({ actionId: "x", tool: readTool, input: {} }),
    ).toThrow(/no approval metadata/);
  });
});

describe("parseActionId", () => {
  test("approve_<id>", () => {
    expect(parseActionId("approve_abc")).toEqual({
      kind: "approve",
      flag: false,
      pendingId: "abc",
    });
  });
  test("approve_flag_<id>", () => {
    expect(parseActionId("approve_flag_abc")).toEqual({
      kind: "approve",
      flag: true,
      pendingId: "abc",
    });
  });
  test("legacy approve_notify_<id> maps to flag=true (in-flight deploy compat)", () => {
    expect(parseActionId("approve_notify_abc")).toEqual({
      kind: "approve",
      flag: true,
      pendingId: "abc",
    });
  });
  test("cancel_<id>", () => {
    expect(parseActionId("cancel_abc")).toEqual({
      kind: "cancel",
      pendingId: "abc",
    });
  });
  test("unknown prefix returns undefined", () => {
    expect(parseActionId("foo_abc")).toBeUndefined();
  });
});
