/**
 * MCP tool-selection eval. Standalone bun script — `pnpm eval:mcp`.
 *
 * Runs each case in `cases.ts` against Claude Haiku 4.5, asserting the
 * model picks the expected tool and includes the required args. Fails
 * the run if fewer than `PASS_THRESHOLD` of `cases.length` succeed.
 *
 * Tool definitions here MIRROR what the MCP server exposes — same
 * names, same descriptions, same input shapes. Drift between the two
 * shows up as eval failures, prompting a sync.
 *
 * Not in default CI. Cost: a handful of cents per run.
 */

import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";

import { type EvalCase, cases } from "./cases";

const MODEL_ID = "anthropic/claude-haiku-4-5";
const PASS_THRESHOLD = 10;

const statusEnum = z.enum([
  "investigating",
  "identified",
  "monitoring",
  "resolved",
]);

/**
 * Tool catalogue mirrored from `apps/server/src/routes/mcp/tools/*.ts`.
 * Exec is a no-op — we only assert *which* tool gets selected, not
 * what it would have done.
 */
const tools = {
  list_status_pages: tool({
    description:
      "List status pages in this workspace with their slug and ids. Use to discover the pageId required by create_status_report and create_maintenance.",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(200).default(50).optional(),
    }),
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
      "List maintenance windows in this workspace. Returns scheduled and historical maintenance ordered by creation time (newest first). Use to see what's already scheduled before adding a new window.",
    inputSchema: z.object({
      pageId: z.number().int().optional(),
      limit: z.number().int().min(1).max(200).default(50).optional(),
    }),
    execute: async () => ({ items: [] }),
  }),
  create_status_report: tool({
    description:
      "Create a new status report on a public status page. Audit-logged. The report begins with one initial update carrying the supplied message and status. pageId MUST come from list_status_pages — never guess. pageComponentIds (if supplied) MUST belong to the same page.",
    inputSchema: z.object({
      title: z.string(),
      status: statusEnum,
      message: z.string(),
      pageId: z.number().int(),
      pageComponentIds: z.array(z.number().int()).optional(),
    }),
    execute: async () => ({ ok: true }),
  }),
  add_status_report_update: tool({
    description:
      "Append a new public update to an existing status report. Audit-logged. Sets the report's status to the new value (use resolve_status_report instead if the new status would be 'resolved').",
    inputSchema: z.object({
      statusReportId: z.number().int(),
      status: statusEnum,
      message: z.string(),
    }),
    execute: async () => ({ ok: true }),
  }),
  update_status_report: tool({
    description:
      "Edit metadata on an existing status report (title, status, affected components). Does NOT add a public update — use add_status_report_update for that. Audit-logged.",
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
      "Resolve an active status report. Marks the incident as resolved and appends a final public update with the supplied message. Audit-logged.",
    inputSchema: z.object({
      statusReportId: z.number().int(),
      message: z.string(),
    }),
    execute: async () => ({ ok: true }),
  }),
  create_maintenance: tool({
    description:
      "Schedule a maintenance window on a status page. Audit-logged. pageId MUST come from list_status_pages — never guess. Times are ISO 8601; the LLM is responsible for parsing natural-language dates into ISO before calling.",
    inputSchema: z.object({
      title: z.string(),
      message: z.string(),
      from: z.string(),
      to: z.string(),
      pageId: z.number().int(),
      pageComponentIds: z.array(z.number().int()).optional(),
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
      model: MODEL_ID,
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
