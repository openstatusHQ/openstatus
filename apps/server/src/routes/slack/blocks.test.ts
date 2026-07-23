import { agentTools } from "@openstatus/services/agent-tools";
import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  buildConfirmationBlocks,
  getConfirmationText,
  parseActionId,
  type RefResolvers,
} from "./blocks";

describe("buildConfirmationBlocks", () => {
  test("create_status_report has approve / approve_flag / cancel", async () => {
    const tool = agentTools.create_status_report;
    const blocks = await buildConfirmationBlocks({
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

  const stubResolvers: RefResolvers = {
    page: (pageId) =>
      Promise.resolve({
        title: "Acme Status",
        url: `https://app.openstatus.dev/status-pages/${pageId}`,
      }),
    componentNames: (ids) =>
      Promise.resolve(new Map(ids.map((id) => [id, `Svc ${id}`]))),
  };

  test("create_status_report links the page name when resolvers resolve", async () => {
    const tool = agentTools.create_status_report;
    const blocks = await buildConfirmationBlocks({
      actionId: "link1",
      tool,
      input: {
        title: "Outage",
        status: "investigating",
        message: "msg",
        pageId: 2705,
        pageComponentIds: [],
      },
      resolvers: stubResolvers,
    });
    const text = (
      blocks.find((b) => b.type === "section") as { text: { text: string } }
    ).text.text;
    expect(text).toContain(
      "*Page:* <https://app.openstatus.dev/status-pages/2705|Acme Status>",
    );
    expect(text).not.toContain("Page ID");
  });

  test("create_status_report falls back to page id when the page can't be resolved", async () => {
    const tool = agentTools.create_status_report;
    const blocks = await buildConfirmationBlocks({
      actionId: "link2",
      tool,
      input: {
        title: "Outage",
        status: "investigating",
        message: "msg",
        pageId: 2705,
        pageComponentIds: [],
      },
      resolvers: { ...stubResolvers, page: () => Promise.resolve(null) },
    });
    const text = (
      blocks.find((b) => b.type === "section") as { text: { text: string } }
    ).text.text;
    expect(text).toContain("*Page ID:* 2705");
  });

  test("create_status_report shows component names when resolvers resolve", async () => {
    const tool = agentTools.create_status_report;
    const blocks = await buildConfirmationBlocks({
      actionId: "cn1",
      tool,
      input: {
        title: "Outage",
        status: "investigating",
        message: "msg",
        pageId: 1,
        pageComponentIds: [101, 102],
        componentImpacts: [{ pageComponentId: 101, impact: "major_outage" }],
      },
      resolvers: stubResolvers,
    });
    const text = (
      blocks.find((b) => b.type === "section") as { text: { text: string } }
    ).text.text;
    expect(text).toContain("*Components:* Svc 101, Svc 102");
    expect(text).toContain("*Impacts:* Svc 101 → major_outage");
  });

  test("component line falls back to raw id when a name is missing", async () => {
    const tool = agentTools.create_status_report;
    const blocks = await buildConfirmationBlocks({
      actionId: "cn2",
      tool,
      input: {
        title: "Outage",
        status: "investigating",
        message: "msg",
        pageId: 1,
        pageComponentIds: [101, 999],
      },
      resolvers: {
        ...stubResolvers,
        componentNames: () => Promise.resolve(new Map([[101, "Svc 101"]])),
      },
    });
    const text = (
      blocks.find((b) => b.type === "section") as { text: { text: string } }
    ).text.text;
    expect(text).toContain("*Components:* Svc 101, 999");
  });

  test("degrades to raw page id (card intact) when the page resolver rejects", async () => {
    const tool = agentTools.create_status_report;
    const blocks = await buildConfirmationBlocks({
      actionId: "rej1",
      tool,
      input: {
        title: "Outage",
        status: "investigating",
        message: "msg",
        pageId: 2705,
        pageComponentIds: [],
      },
      resolvers: {
        ...stubResolvers,
        page: () => Promise.reject(new Error("db down")),
      },
    });
    const text = (
      blocks.find((b) => b.type === "section") as { text: { text: string } }
    ).text.text;
    expect(text).toContain("*Page ID:* 2705");
    // The rest of the card must still build — a flaky lookup degrades one line.
    const actions = blocks.find((b) => b.type === "actions") as {
      elements: unknown[];
    };
    expect(actions.elements).toHaveLength(3);
  });

  test("degrades to raw component ids when the component resolver rejects", async () => {
    const tool = agentTools.create_status_report;
    const blocks = await buildConfirmationBlocks({
      actionId: "rej2",
      tool,
      input: {
        title: "Outage",
        status: "investigating",
        message: "msg",
        pageId: 1,
        pageComponentIds: [101, 102],
        componentImpacts: [{ pageComponentId: 101, impact: "major_outage" }],
      },
      resolvers: {
        ...stubResolvers,
        componentNames: () => Promise.reject(new Error("db down")),
      },
    });
    const text = (
      blocks.find((b) => b.type === "section") as { text: { text: string } }
    ).text.text;
    expect(text).toContain("*Components:* 101, 102");
    expect(text).toContain("*Impacts:* 101 → major_outage");
  });

  test("escapes mrkdwn-significant chars in the page link text", async () => {
    const tool = agentTools.create_status_report;
    const blocks = await buildConfirmationBlocks({
      actionId: "esc1",
      tool,
      input: {
        title: "Outage",
        status: "investigating",
        message: "msg",
        pageId: 1,
        pageComponentIds: [],
      },
      resolvers: {
        ...stubResolvers,
        page: () =>
          Promise.resolve({ title: "A & B <c> |d", url: "https://x/1" }),
      },
    });
    const text = (
      blocks.find((b) => b.type === "section") as { text: { text: string } }
    ).text.text;
    expect(text).toContain("<https://x/1|A &amp; B &lt;c&gt; ❘d>");
  });

  test("escapes mrkdwn-significant chars in component names", async () => {
    const tool = agentTools.create_status_report;
    const blocks = await buildConfirmationBlocks({
      actionId: "esc2",
      tool,
      input: {
        title: "Outage",
        status: "investigating",
        message: "msg",
        pageId: 1,
        pageComponentIds: [101],
      },
      resolvers: {
        ...stubResolvers,
        componentNames: () => Promise.resolve(new Map([[101, "API & <Web>"]])),
      },
    });
    const text = (
      blocks.find((b) => b.type === "section") as { text: { text: string } }
    ).text.text;
    expect(text).toContain("*Components:* API &amp; &lt;Web&gt;");
  });

  test("escapes mrkdwn in the title header and un-refed line values", async () => {
    const tool = agentTools.create_status_report;
    const evil = "<http://evil.example|Click here>";
    const blocks = await buildConfirmationBlocks({
      actionId: "esc3",
      tool,
      input: {
        title: evil,
        status: "investigating",
        message: "msg",
        pageId: 1,
        pageComponentIds: [],
      },
      resolvers: stubResolvers,
    });
    const text = (
      blocks.find((b) => b.type === "section") as { text: { text: string } }
    ).text.text;
    // Header ("Create Status Report: <evil>") and the "Title" line both escape.
    expect(text).not.toContain(evil);
    expect(text).toContain("&lt;http://evil.example|Click here&gt;");
  });

  test("add_status_report_update resolves impact component names", async () => {
    const tool = agentTools.add_status_report_update;
    const blocks = await buildConfirmationBlocks({
      actionId: "au1",
      tool,
      input: {
        statusReportId: 42,
        status: "monitoring",
        message: "recovering",
        componentImpacts: [{ pageComponentId: 7, impact: "partial_outage" }],
      },
      resolvers: stubResolvers,
    });
    const text = (
      blocks.find((b) => b.type === "section") as { text: { text: string } }
    ).text.text;
    expect(text).toContain("*Impacts:* Svc 7 → partial_outage");
    expect(text).not.toContain("*Impacts:* 7 →");
  });

  test("update_status_report resolves component names", async () => {
    const tool = agentTools.update_status_report;
    const blocks = await buildConfirmationBlocks({
      actionId: "up1",
      tool,
      input: { statusReportId: 10, pageComponentIds: [1, 2] },
      resolvers: stubResolvers,
    });
    const text = (
      blocks.find((b) => b.type === "section") as { text: { text: string } }
    ).text.text;
    expect(text).toContain("*Components:* Svc 1, Svc 2");
  });

  test("update_status_report keeps '(clear all)' literal even with resolvers", async () => {
    const tool = agentTools.update_status_report;
    const blocks = await buildConfirmationBlocks({
      actionId: "up2",
      tool,
      input: { statusReportId: 10, pageComponentIds: [] },
      resolvers: stubResolvers,
    });
    const text = (
      blocks.find((b) => b.type === "section") as { text: { text: string } }
    ).text.text;
    expect(text).toContain("*Components:* (clear all)");
  });

  test("create_maintenance resolves the page link and component names", async () => {
    const tool = agentTools.create_maintenance;
    const blocks = await buildConfirmationBlocks({
      actionId: "mn1",
      tool,
      input: {
        title: "DB Upgrade",
        message: "Restarting replicas",
        from: "2026-06-01T00:00:00Z",
        to: "2026-06-01T01:00:00Z",
        pageId: 7,
        pageComponentIds: [1, 2],
      },
      resolvers: stubResolvers,
    });
    const text = (
      blocks.find((b) => b.type === "section") as { text: { text: string } }
    ).text.text;
    expect(text).toContain(
      "*Page:* <https://app.openstatus.dev/status-pages/7|Acme Status>",
    );
    expect(text).toContain("*Components:* Svc 1, Svc 2");
    expect(text).not.toContain("Page ID");
  });

  test("create_status_report shows components when provided", async () => {
    const tool = agentTools.create_status_report;
    const blocks = await buildConfirmationBlocks({
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

  test("create_status_report shows impacts when provided", async () => {
    const tool = agentTools.create_status_report;
    const blocks = await buildConfirmationBlocks({
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

  test("add_status_report_update shows impacts when provided", async () => {
    const tool = agentTools.add_status_report_update;
    const blocks = await buildConfirmationBlocks({
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

  test("add_status_report_update has 3 buttons", async () => {
    const tool = agentTools.add_status_report_update;
    const blocks = await buildConfirmationBlocks({
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

  test("update_status_report distinguishes 'clear all' from 'no change' for components", async () => {
    const tool = agentTools.update_status_report;

    // pageComponentIds undefined → no Components line at all
    const noChange = await buildConfirmationBlocks({
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
    const clearAll = await buildConfirmationBlocks({
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
    const withIds = await buildConfirmationBlocks({
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

  test("update_status_report has 2 buttons (no notify flag)", async () => {
    const tool = agentTools.update_status_report;
    const blocks = await buildConfirmationBlocks({
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

  test("create_maintenance card shows pageId", async () => {
    const tool = agentTools.create_maintenance;
    const blocks = await buildConfirmationBlocks({
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

  test("resolve_status_report has 3 buttons", async () => {
    const tool = agentTools.resolve_status_report;
    const blocks = await buildConfirmationBlocks({
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

  test("all blocks include a divider", async () => {
    const tool = agentTools.create_status_report;
    const blocks = await buildConfirmationBlocks({
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

  test("escapes mrkdwn in the title (message text field)", () => {
    expect(
      getConfirmationText({
        tool: agentTools.create_status_report,
        input: {
          title: "<http://evil.example|Click here>",
          status: "investigating",
          message: "m",
          pageId: 1,
          pageComponentIds: [],
        },
      }),
    ).toBe("Create Status Report: &lt;http://evil.example|Click here&gt;");
  });
});

describe("buildConfirmationBlocks (error paths)", () => {
  test("rejects when the tool has no approval metadata", async () => {
    const readTool = agentTools.list_status_pages;
    await expect(
      buildConfirmationBlocks({ actionId: "x", tool: readTool, input: {} }),
    ).rejects.toThrow(/no approval metadata/);
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
