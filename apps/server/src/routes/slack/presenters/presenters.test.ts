import type { ServiceContext } from "@openstatus/services";
import { agentTools } from "@openstatus/services/agent-tools";
import type { AnyAgentTool } from "@openstatus/services/agent-tools";
import { describe, expect, test } from "@openstatus/test-utils";
import { z } from "zod";

// page-urls.ts hits the db; it's swapped for a deterministic double via the
// test import map (see test.importmap.json).
import { defaultPresenter } from "./default";
import { renderToolResult } from "./index";

const fakeCtx = {
  workspace: { id: 1 },
  actor: { type: "slack", teamId: "T", slackUserId: "U" },
} as unknown as ServiceContext;

describe("defaultPresenter", () => {
  function fakeTool(verb?: string): AnyAgentTool {
    return {
      name: "create_widget",
      description: "x",
      scope: "write",
      destructive: true,
      inputSchema: z.object({ title: z.string() }),
      outputSchema: z.object({ ok: z.boolean() }),
      run: async () => ({ ok: true }),
      approval: {
        summarize: (input) => ({
          title: `New Widget: ${(input as { title: string }).title}`,
          lines: [],
        }),
        verb,
      },
    };
  }

  test("uses approval.verb when set", () => {
    const text = defaultPresenter({
      tool: fakeTool("emitted"),
      input: { title: "Foo" },
      notify: false,
    });
    expect(text).toBe(":white_check_mark: New Widget: Foo emitted.");
  });

  test("infers verb from create_ prefix when not set", () => {
    const text = defaultPresenter({
      tool: fakeTool(),
      input: { title: "Foo" },
      notify: false,
    });
    expect(text).toContain("created.");
  });

  test("appends 'Subscribers notified.' when notify is true", () => {
    const text = defaultPresenter({
      tool: fakeTool("created"),
      input: { title: "Foo" },
      notify: true,
    });
    expect(text).toContain("Subscribers notified.");
  });

  test("fallback for tools without approval", () => {
    const t: AnyAgentTool = {
      name: "z",
      description: "x",
      scope: "write",
      destructive: true,
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      run: async () => ({}),
    };
    expect(defaultPresenter({ tool: t, input: {}, notify: false })).toBe(
      ":white_check_mark: Done.",
    );
  });

  test("verb inference matches each registry prefix", () => {
    const prefixes: Array<[string, string]> = [
      ["create_x", "created"],
      ["update_x", "updated"],
      ["resolve_x", "resolved"],
      ["add_x", "added"],
      ["weird_x", "done"], // unknown prefix
    ];
    for (const [name, verb] of prefixes) {
      const t: AnyAgentTool = {
        name,
        description: "x",
        scope: "write",
        destructive: true,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        run: async () => ({}),
        approval: {
          summarize: () => ({ title: "Thing", lines: [] }),
        },
      };
      const text = defaultPresenter({ tool: t, input: {}, notify: false });
      if (verb === "done") {
        expect(text).toBe(":white_check_mark: Thing done.");
      } else {
        expect(text).toBe(`:white_check_mark: Thing ${verb}.`);
      }
    }
  });
});

describe("renderToolResult (per-tool override)", () => {
  test("create_status_report uses its custom presenter with report URL", async () => {
    const tool = agentTools.create_status_report;
    const text = await renderToolResult({
      tool,
      ctx: fakeCtx,
      input: {
        title: "API Outage",
        status: "investigating",
        message: "We are investigating",
        pageId: 1,
        pageComponentIds: [],
        notify: true,
      },
      output: {
        statusReport: {
          id: 42,
          title: "API Outage",
          status: "investigating",
          pageId: 1,
          createdAt: null,
        },
        initialUpdateId: 100,
        notified: true,
      },
      notify: true,
    });
    expect(text).toContain("Status report *API Outage* created");
    expect(text).toContain("subscribers notified");
    expect(text).toContain("https://example.openstatus.dev/events/report/42");
  });

  test("add_status_report_update uses report title from output (no extra DB read)", async () => {
    const tool = agentTools.add_status_report_update;
    const text = await renderToolResult({
      tool,
      ctx: fakeCtx,
      input: {
        statusReportId: 7,
        status: "identified",
        message: "We found the root cause",
        notify: false,
      },
      output: {
        statusReportUpdateId: 99,
        notified: false,
        statusReport: {
          id: 7,
          title: "DB Slowness",
          status: "identified",
          pageId: 2,
        },
      },
      notify: false,
    });
    expect(text).toContain("Update added to *DB Slowness*");
    expect(text).toContain("(identified)");
    expect(text).not.toContain("subscribers notified");
  });

  test("resolve_status_report renders the resolution URL + message", async () => {
    const tool = agentTools.resolve_status_report;
    const text = await renderToolResult({
      tool,
      ctx: fakeCtx,
      input: {
        statusReportId: 7,
        message: "All systems healthy",
        notify: true,
      },
      output: {
        statusReportUpdateId: 101,
        notified: true,
        statusReport: { id: 7, title: "DB Slowness", pageId: 2 },
      },
      notify: true,
    });
    expect(text).toContain("*DB Slowness* resolved");
    expect(text).toContain("subscribers notified");
    expect(text).toContain("All systems healthy");
    expect(text).toContain("https://example.openstatus.dev/events/report/7");
  });

  test("create_maintenance includes the page URL", async () => {
    const tool = agentTools.create_maintenance;
    const text = await renderToolResult({
      tool,
      ctx: fakeCtx,
      input: {
        title: "DB Upgrade",
        message: "Reading replicas restart",
        from: "2026-06-01T00:00:00Z",
        to: "2026-06-01T01:00:00Z",
        pageId: 3,
        pageComponentIds: [],
        notify: false,
      },
      output: {
        id: 11,
        title: "DB Upgrade",
        from: "2026-06-01T00:00:00Z",
        to: "2026-06-01T01:00:00Z",
        pageId: 3,
        notified: false,
      },
      notify: false,
    });
    expect(text).toContain("Maintenance *DB Upgrade* scheduled");
    expect(text).not.toContain("subscribers notified");
    expect(text).toContain("https://example.openstatus.dev");
  });

  test("update_status_report uses input.title when provided, else output.title", async () => {
    const tool = agentTools.update_status_report;
    const withInputTitle = await renderToolResult({
      tool,
      ctx: fakeCtx,
      input: { statusReportId: 1, title: "Renamed" },
      output: { id: 1, title: "Persisted", status: "investigating" },
      notify: false,
    });
    expect(withInputTitle).toBe(
      ":white_check_mark: Status report *Renamed* updated.",
    );

    const withoutInputTitle = await renderToolResult({
      tool,
      ctx: fakeCtx,
      input: { statusReportId: 1 },
      output: { id: 1, title: "Persisted", status: "investigating" },
      notify: false,
    });
    expect(withoutInputTitle).toBe(
      ":white_check_mark: Status report *Persisted* updated.",
    );
  });

  test("create_status_report omits 'subscribers notified' when notify=false (e.g. dispatch failed)", async () => {
    const tool = agentTools.create_status_report;
    const text = await renderToolResult({
      tool,
      ctx: fakeCtx,
      input: {
        title: "API Outage",
        status: "investigating",
        message: "Investigating",
        pageId: 1,
        pageComponentIds: [],
        notify: true,
      },
      output: {
        statusReport: {
          id: 42,
          title: "API Outage",
          status: "investigating",
          pageId: 1,
          createdAt: null,
        },
        initialUpdateId: 100,
        // User clicked "Approve & Notify" but the dispatch failed —
        // the service caught it and set notified=false. Call site
        // (interactions.ts) passes notify=false through accordingly.
        notified: false,
      },
      notify: false,
    });
    expect(text).toContain("Status report *API Outage* created");
    expect(text).not.toContain("subscribers notified");
  });

  test("falls back to the default presenter when no override is registered", async () => {
    const t: AnyAgentTool = {
      name: "create_something_new",
      description: "x",
      scope: "write",
      destructive: true,
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      run: async () => ({}),
      approval: {
        summarize: () => ({ title: "Something", lines: [] }),
      },
    };
    const text = await renderToolResult({
      tool: t,
      ctx: fakeCtx,
      input: {},
      output: {},
      notify: false,
    });
    expect(text).toBe(":white_check_mark: Something created.");
  });
});
