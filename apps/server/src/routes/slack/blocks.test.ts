import { describe, expect, test } from "bun:test";
import { buildConfirmationBlocks } from "./blocks";
import type { PendingAction } from "./confirmation-store";

describe("buildConfirmationBlocks", () => {
  test("createStatusReport includes 3 buttons", () => {
    const action: PendingAction["action"] = {
      type: "createStatusReport",
      params: {
        title: "API Outage",
        status: "investigating",
        message: "API is returning 500 errors",
        pageId: 1,
      },
    };

    const blocks = buildConfirmationBlocks("abc123", action);

    const section = blocks.find((b) => b.type === "section");
    expect(section).toBeDefined();
    expect((section as { text: { text: string } }).text.text).toContain(
      "API Outage",
    );
    expect((section as { text: { text: string } }).text.text).toContain(
      "Investigating",
    );

    const actions = blocks.find((b) => b.type === "actions") as {
      elements: { action_id: string }[];
    };
    expect(actions.elements).toHaveLength(3);
    expect(actions.elements[0].action_id).toBe("approve_abc123");
    expect(actions.elements[1].action_id).toBe("approve_notify_abc123");
    expect(actions.elements[2].action_id).toBe("cancel_abc123");
  });

  test("createStatusReport shows components when provided", () => {
    const action: PendingAction["action"] = {
      type: "createStatusReport",
      params: {
        title: "Test",
        status: "investigating",
        message: "msg",
        pageId: 1,
        pageComponentIds: ["comp-1", "comp-2"],
      },
    };

    const blocks = buildConfirmationBlocks("id1", action);
    const section = blocks.find((b) => b.type === "section") as {
      text: { text: string };
    };
    expect(section.text.text).toContain("comp-1, comp-2");
  });

  test("addStatusReportUpdate includes 3 buttons", () => {
    const action: PendingAction["action"] = {
      type: "addStatusReportUpdate",
      params: {
        statusReportId: 42,
        status: "identified",
        message: "Root cause found",
      },
    };

    const blocks = buildConfirmationBlocks("abc", action);

    const section = blocks.find((b) => b.type === "section") as {
      text: { text: string };
    };
    expect(section.text.text).toContain("42");
    expect(section.text.text).toContain("Identified");

    const actions = blocks.find((b) => b.type === "actions") as {
      elements: { action_id: string }[];
    };
    expect(actions.elements).toHaveLength(3);
  });

  test("updateStatusReport includes 2 buttons (no notify)", () => {
    const action: PendingAction["action"] = {
      type: "updateStatusReport",
      params: {
        statusReportId: 10,
        title: "Updated Title",
      },
    };

    const blocks = buildConfirmationBlocks("xyz", action);

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

  test("resolveStatusReport includes 3 buttons", () => {
    const action: PendingAction["action"] = {
      type: "resolveStatusReport",
      params: {
        statusReportId: 5,
        message: "Issue has been resolved",
      },
    };

    const blocks = buildConfirmationBlocks("res1", action);

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
    const action: PendingAction["action"] = {
      type: "createStatusReport",
      params: {
        title: "T",
        status: "investigating",
        message: "m",
        pageId: 1,
      },
    };

    const blocks = buildConfirmationBlocks("d1", action);
    expect(blocks.some((b) => b.type === "divider")).toBe(true);
  });
});
