import type { ServiceContext } from "@openstatus/services";
import { agentTools } from "@openstatus/services/agent-tools";
import type { AnyAgentTool } from "@openstatus/services/agent-tools";
import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";
import { z } from "zod";

import {
  buildSlackTools,
  buildTool,
  deriveDraftSchema,
  executeRegistryAction,
  getRegistryTool,
  isSlackToolDraft,
} from "./registry-runner";

const fakeCtx = {
  workspace: { id: 1 },
  actor: { type: "slack", teamId: "T", slackUserId: "U" },
} as unknown as ServiceContext;

describe("isSlackToolDraft", () => {
  test("accepts a draft with needsConfirmation + toolName", () => {
    expect(
      isSlackToolDraft({
        needsConfirmation: true,
        toolName: "create_status_report",
        input: {},
      }),
    ).toBe(true);
  });

  test("rejects plain tool output", () => {
    expect(isSlackToolDraft({ items: [] })).toBe(false);
  });

  test("rejects null / non-object values", () => {
    expect(isSlackToolDraft(null)).toBe(false);
    expect(isSlackToolDraft("draft")).toBe(false);
    expect(isSlackToolDraft(undefined)).toBe(false);
  });

  test("rejects missing needsConfirmation", () => {
    expect(isSlackToolDraft({ toolName: "x", input: {} })).toBe(false);
  });

  test("rejects needsConfirmation === false", () => {
    expect(
      isSlackToolDraft({
        needsConfirmation: false,
        toolName: "x",
      }),
    ).toBe(false);
  });

  test("rejects non-string toolName", () => {
    expect(
      isSlackToolDraft({
        needsConfirmation: true,
        toolName: 42,
        input: {},
      }),
    ).toBe(false);
  });
});

describe("getRegistryTool", () => {
  test("returns a tool for a registered name", () => {
    const t = getRegistryTool("create_status_report");
    expect(t?.name).toBe("create_status_report");
  });

  test("returns undefined for an unknown name", () => {
    expect(getRegistryTool("not_a_tool")).toBeUndefined();
  });
});

describe("buildSlackTools", () => {
  const tools = buildSlackTools(fakeCtx);

  test("emits an entry for every registry tool", () => {
    for (const name of Object.keys(agentTools)) {
      expect(tools[name], `${name} missing`).toBeDefined();
    }
  });

  test("destructive tools omit extraFlag fields from the LLM-facing schema", () => {
    // Each destructive tool that declares `extraFlags: [{id:"notify"}]`
    // must reject `notify` from its LLM-facing schema, because the user
    // owns that value via Block Kit buttons.
    const t = tools.create_status_report as {
      inputSchema: z.ZodObject<z.ZodRawShape>;
    };
    const shape = t.inputSchema.shape;
    expect("notify" in shape).toBe(false);
    expect("title" in shape).toBe(true);
    expect("pageId" in shape).toBe(true);
  });

  test("componentImpacts stays in the LLM-facing schema (only extraFlags are hidden)", () => {
    for (const name of [
      "create_status_report",
      "add_status_report_update",
    ] as const) {
      const t = tools[name] as {
        inputSchema: z.ZodObject<z.ZodRawShape>;
      };
      expect("componentImpacts" in t.inputSchema.shape, name).toBe(true);
      expect("notify" in t.inputSchema.shape, name).toBe(false);
    }
  });

  test("destructive tools without extraFlags keep their full schema", () => {
    const t = tools.update_status_report as {
      inputSchema: z.ZodObject<z.ZodRawShape>;
    };
    const shape = t.inputSchema.shape;
    expect("statusReportId" in shape).toBe(true);
    // update_status_report has no notify field at all in the registry, so
    // we just check the schema is intact.
    expect("title" in shape).toBe(true);
  });

  test("deriveDraftSchema throws clearly when inputSchema isn't a ZodObject", () => {
    const badTool: AnyAgentTool = {
      name: "bad_tool",
      description: "x",
      scope: "write",
      destructive: true,
      // ZodUnion has no `.omit()`.
      inputSchema: z.union([
        z.object({ a: z.string() }),
        z.object({ b: z.string() }),
      ]),
      outputSchema: z.object({}),
      run: async () => ({}),
      approval: {
        extraFlags: [{ id: "notify", label: "Notify" }],
        applyFlags: (i, f) => ({ ...(i as object), notify: f.notify }),
        summarize: () => ({ title: "x", lines: [] }),
      },
    };
    expect(() => deriveDraftSchema(badTool)).toThrow(/not a ZodObject/);
  });

  test("deriveDraftSchema is a no-op for tools without extraFlags", () => {
    const t = agentTools.update_status_report;
    expect(deriveDraftSchema(t)).toBe(t.inputSchema);
  });

  test("read tools expose the full registry schema", () => {
    const t = tools.list_status_pages;
    // list_status_pages takes an empty object; the schema is unchanged.
    expect(t.inputSchema).toBe(agentTools.list_status_pages.inputSchema);
  });
});

describe("executeRegistryAction", () => {
  function fakeTool(
    opts: Partial<AnyAgentTool> & {
      run?: AnyAgentTool["run"];
    } = {},
  ): AnyAgentTool {
    return {
      name: "fake_tool",
      description: "fake",
      scope: "write",
      destructive: true,
      inputSchema: z.object({
        message: z.string(),
        notify: z.boolean(),
      }),
      outputSchema: z.object({ ok: z.boolean() }),
      run: async ({ input }) => ({ ok: (input as { notify: boolean }).notify }),
      approval: {
        extraFlags: [{ id: "notify", label: "Notify subscribers" }],
        applyFlags: (input, flags) => ({
          ...(input as object),
          notify: flags.notify ?? false,
        }),
        summarize: () => ({ title: "fake", lines: [] }),
      },
      ...opts,
    } as AnyAgentTool;
  }

  test("injects flag values via applyFlags", async () => {
    const t = fakeTool();
    const { input, output } = await executeRegistryAction({
      tool: t,
      ctx: fakeCtx,
      draftInput: { message: "hi" },
      flags: { notify: true },
    });
    expect((input as { notify: boolean }).notify).toBe(true);
    expect((output as { ok: boolean }).ok).toBe(true);
  });

  test("flag=false also flows through", async () => {
    const t = fakeTool();
    const { input } = await executeRegistryAction({
      tool: t,
      ctx: fakeCtx,
      draftInput: { message: "hi" },
      flags: { notify: false },
    });
    expect((input as { notify: boolean }).notify).toBe(false);
  });

  test("the full registry schema gates missing flag values", async () => {
    // If applyFlags is missing or returns input without the flag, the
    // registry's strict schema must reject — protecting against silent
    // omissions of `notify`.
    const t = fakeTool({
      approval: {
        // No-op applyFlags that drops `notify`.
        extraFlags: [{ id: "notify", label: "Notify" }],
        applyFlags: (input) => input,
        summarize: () => ({ title: "fake", lines: [] }),
      },
    });
    expect(
      executeRegistryAction({
        tool: t,
        ctx: fakeCtx,
        draftInput: { message: "hi" },
        flags: { notify: true },
      }),
    ).rejects.toThrow();
  });

  test("propagates errors from tool.run", async () => {
    const t = fakeTool({
      run: async () => {
        throw new Error("kaboom");
      },
    });
    expect(
      executeRegistryAction({
        tool: t,
        ctx: fakeCtx,
        draftInput: { message: "hi" },
        flags: { notify: false },
      }),
    ).rejects.toThrow("kaboom");
  });

  test("non-destructive tools run inline (no HITL gate)", async () => {
    const ran: unknown[] = [];
    const t: AnyAgentTool = {
      name: "no_op",
      description: "x",
      scope: "write",
      destructive: false,
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ echo: z.number() }),
      run: async ({ input }) => {
        ran.push(input);
        return { echo: (input as { value: number }).value };
      },
    };
    // buildSlackTools spreads `agentTools`, so we test the per-tool
    // helper indirectly: a non-destructive tool's AI SDK execute() runs
    // inline and returns the registry output, not a draft.
    const out = await executeRegistryAction({
      tool: t,
      ctx: fakeCtx,
      draftInput: { value: 7 },
      flags: {},
    });
    expect(out.output).toEqual({ echo: 7 });
    expect(ran).toEqual([{ value: 7 }]);
  });

  test("tools without approval pass draftInput through unchanged", async () => {
    const t: AnyAgentTool = {
      name: "no_approval",
      description: "x",
      scope: "write",
      destructive: true,
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      run: async ({ input }) => input as { value: number },
    };
    const { input, output } = await executeRegistryAction({
      tool: t,
      ctx: fakeCtx,
      draftInput: { value: 42 },
      flags: {},
    });
    expect(input).toEqual({ value: 42 });
    expect(output).toEqual({ value: 42 });
  });
});

describe("buildTool draft split", () => {
  function destructiveTool(
    prepareDraftInput?: NonNullable<
      AnyAgentTool["approval"]
    >["prepareDraftInput"],
  ): AnyAgentTool {
    return {
      name: "split_tool",
      description: "x",
      scope: "write",
      destructive: true,
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ ok: z.boolean() }),
      run: async () => ({ ok: true }),
      approval: {
        summarize: () => ({ title: "x", lines: [] }),
        prepareDraftInput,
      },
    };
  }

  async function runExecute(t: AnyAgentTool) {
    const built = buildTool(t, fakeCtx);
    if (!built.execute) throw new Error("expected an execute fn");
    return built.execute({ value: 7 }, { toolCallId: "t", messages: [] });
  }

  test("persists raw input but enriches a separate displayInput", async () => {
    const result = await runExecute(
      destructiveTool(async ({ input }) => ({
        ...(input as { value: number }),
        value: (input as { value: number }).value + 100,
      })),
    );
    if (!isSlackToolDraft(result)) throw new Error("expected a draft");
    // raw input is what gets persisted + re-run at approval (fresh carry there)
    expect(result.input).toEqual({ value: 7 });
    // displayInput is the enriched snapshot shown on the confirmation card
    expect(result.displayInput).toEqual({ value: 107 });
  });

  test("displayInput mirrors input when no prepareDraftInput", async () => {
    const result = await runExecute(destructiveTool());
    if (!isSlackToolDraft(result)) throw new Error("expected a draft");
    expect(result.input).toEqual({ value: 7 });
    expect(result.displayInput).toEqual({ value: 7 });
  });
});
