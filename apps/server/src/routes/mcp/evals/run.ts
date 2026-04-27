/**
 * MCP tool-selection eval. Standalone bun script — `pnpm eval:mcp`.
 *
 * Runs each case in `cases.ts` against Claude Haiku 4.5 (via the AI
 * Gateway), asserting the model picks the expected tool and includes
 * the required args. Fails the run if fewer than `PASS_THRESHOLD` of
 * `cases.length` succeed.
 *
 * Not in default CI. Cost: a handful of cents per run.
 *
 * --------------------------------------------------------------------
 * TODO: deduplicate tool catalogue.
 *
 * The `tools` map below MIRRORS the server registrations in:
 *   - apps/server/src/routes/mcp/tools/page.ts
 *   - apps/server/src/routes/mcp/tools/status-report.ts
 *   - apps/server/src/routes/mcp/tools/maintenance.ts
 *
 * When you edit a description, input shape, or required field in any
 * of those files, edit it here too — drift is silent because evals
 * are not in CI.
 *
 * The clean fix is to import each `register*Tools` factory, run them
 * against a stub `McpServer` + stub ctx (handlers never execute), and
 * convert each `RegisteredTool.description` + `inputSchema` into the
 * AI SDK `tool()` shape. Attempted in an earlier revision; deferred
 * because the SDK's Zod-shape conversion path needs more care than a
 * few lines.
 * --------------------------------------------------------------------
 */

import { gateway, generateText, stepCountIs, tool } from "ai";
import { z } from "zod";

import { type EvalCase, cases } from "./cases";

// Resolved through the AI Gateway (`AI_GATEWAY_API_KEY` env). Using
// `gateway(...)` instead of a bare string makes the routing path
// explicit and gives a clearer error if the gateway is unconfigured.
const MODEL = gateway("anthropic/claude-haiku-4-5");
const PASS_THRESHOLD = 10;

const statusEnum = z.enum([
  "investigating",
  "identified",
  "monitoring",
  "resolved",
]);

const tools = {
  list_status_pages: tool({
    description:
      "List status pages in this workspace with their slug and ids. Use to discover the pageId required by create_status_report and create_maintenance.",
    inputSchema: z.object({}),
    execute: async () => ({ items: [] }),
  }),
  list_status_reports: tool({
    description:
      "List status reports in this workspace, newest first. Filter by status (e.g. exclude 'resolved' to see active incidents). Returns the most recent update per report so the LLM can see the current public message without a follow-up call.",
    inputSchema: z.object({
      filter: z.enum(["active", "all"]).default("active"),
      pageId: z.number().int().optional(),
      limit: z.number().int().min(1).max(200).default(50).optional(),
    }),
    execute: async () => ({ items: [] }),
  }),
  list_maintenances: tool({
    description:
      "List maintenance windows in this workspace. Defaults to upcoming-only (windows whose `to` is still in the future) which is what callers usually want when scheduling. Pass `filter: 'all'` to include past maintenances too.",
    inputSchema: z.object({
      filter: z.enum(["upcoming", "all"]).default("upcoming"),
      pageId: z.number().int().optional(),
      limit: z.number().int().min(1).max(200).default(50).optional(),
    }),
    execute: async () => ({ items: [] }),
  }),
  create_status_report: tool({
    description:
      "Create a new status report on a public status page. PUBLIC, AUDIT-LOGGED, AND POTENTIALLY NOTIFIES SUBSCRIBERS — irreversible side effects. MANDATORY workflow before calling: 1) Draft the title/status/message/components. 2) Show the draft to the user. 3) Ask explicitly: 'Should I notify subscribers?'. 4) Call only after both content and notify are confirmed. Subscriber notifications fire atomically — there is NO separate notify tool. pageId MUST come from list_status_pages.",
    inputSchema: z.object({
      title: z.string(),
      status: statusEnum,
      message: z.string(),
      pageId: z.number().int(),
      pageComponentIds: z.array(z.number().int()).optional(),
      notify: z.boolean(),
    }),
    execute: async () => ({ ok: true }),
  }),
  add_status_report_update: tool({
    description:
      "Append a new public update to an existing status report. PUBLIC, AUDIT-LOGGED, AND POTENTIALLY NOTIFIES SUBSCRIBERS. Use resolve_status_report instead if the new status would be 'resolved'. MANDATORY workflow: draft, show to user, ask about subscriber notification, then call. There is NO separate notify tool — if notify is false, this update never reaches subscribers.",
    inputSchema: z.object({
      statusReportId: z.number().int(),
      status: statusEnum,
      message: z.string(),
      notify: z.boolean(),
    }),
    execute: async () => ({ ok: true }),
  }),
  update_status_report: tool({
    description:
      "Edit metadata on an existing status report (title, status, affected components). Does NOT add a public update — use add_status_report_update for that. Does NOT and CANNOT notify subscribers. MANDATORY: draft, show, confirm before calling.",
    inputSchema: z.object({
      statusReportId: z.number().int(),
      title: z.string().optional(),
      status: statusEnum.optional(),
      pageComponentIds: z.array(z.number().int()).optional(),
    }),
    execute: async () => ({ ok: true }),
  }),
  resolve_status_report: tool({
    description:
      "Resolve an active status report. Appends a final public update with the supplied message and flips status to 'resolved'. PUBLIC, AUDIT-LOGGED, AND POTENTIALLY NOTIFIES SUBSCRIBERS. MANDATORY: draft the resolution message, show to user, ask about subscriber notification, then call.",
    inputSchema: z.object({
      statusReportId: z.number().int(),
      message: z.string(),
      notify: z.boolean(),
    }),
    execute: async () => ({ ok: true }),
  }),
  create_maintenance: tool({
    description:
      "Schedule a maintenance window on a status page. PUBLIC, AUDIT-LOGGED, AND POTENTIALLY NOTIFIES SUBSCRIBERS. pageId MUST come from list_status_pages. Times are ISO 8601. MANDATORY: draft title/message/window, show to user, ask about subscriber notification, then call.",
    inputSchema: z.object({
      title: z.string(),
      message: z.string(),
      from: z.string(),
      to: z.string(),
      pageId: z.number().int(),
      pageComponentIds: z.array(z.number().int()).optional(),
      notify: z.boolean(),
    }),
    execute: async () => ({ ok: true }),
  }),
};

const SYSTEM_PROMPT = `You are the OpenStatus assistant. Pick the right tool for each user request and call it with sensible parameters. NEVER guess a pageId — call list_status_pages first when you don't know it.`;

type CaseResult = {
  case: EvalCase;
  pass: boolean;
  reason?: string;
  chosenTool?: string;
  args?: Record<string, unknown>;
};

async function runCase(c: EvalCase): Promise<CaseResult> {
  try {
    const result = await generateText({
      model: MODEL,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: c.prompt }],
      tools,
      temperature: 0,
      stopWhen: stepCountIs(1),
    });

    const firstCall = result.steps[0]?.toolCalls[0];
    if (!firstCall) {
      return {
        case: c,
        pass: false,
        reason: `no tool call (model said: ${result.text.slice(0, 80)})`,
      };
    }

    if (firstCall.toolName !== c.expectedTool) {
      return {
        case: c,
        pass: false,
        reason: `expected ${c.expectedTool}, got ${firstCall.toolName}`,
        chosenTool: firstCall.toolName,
        args: firstCall.input as Record<string, unknown>,
      };
    }

    const args = (firstCall.input ?? {}) as Record<string, unknown>;
    if (c.requiredArgs) {
      for (const key of c.requiredArgs) {
        if (!(key in args)) {
          return {
            case: c,
            pass: false,
            reason: `missing required arg: ${key}`,
            chosenTool: firstCall.toolName,
            args,
          };
        }
      }
    }
    if (c.forbiddenArgs) {
      for (const key of c.forbiddenArgs) {
        if (key in args) {
          return {
            case: c,
            pass: false,
            reason: `passed forbidden arg: ${key}`,
            chosenTool: firstCall.toolName,
            args,
          };
        }
      }
    }
    return { case: c, pass: true, chosenTool: firstCall.toolName, args };
  } catch (err) {
    return {
      case: c,
      pass: false,
      reason: `threw: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

const results: CaseResult[] = [];
for (const c of cases) {
  process.stdout.write(`  ${c.id} ... `);
  const r = await runCase(c);
  results.push(r);
  process.stdout.write(`${r.pass ? "PASS" : "FAIL"}\n`);
  if (!r.pass) {
    console.error(`    ${r.reason}`);
    if (r.chosenTool) console.error(`    chose: ${r.chosenTool}`);
    if (r.args) console.error(`    args: ${JSON.stringify(r.args)}`);
  }
}

const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${cases.length} passed (threshold ${PASS_THRESHOLD})`);

if (passed < PASS_THRESHOLD) {
  process.exit(1);
}
