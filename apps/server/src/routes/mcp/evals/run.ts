/**
 * MCP tool-selection eval. Standalone Node script — `pnpm eval:mcp`.
 *
 * Runs each case in `cases.ts` against the model below (via the AI
 * Gateway), asserting the model picks the expected tool and includes
 * the required args. Fails the run if fewer than `PASS_THRESHOLD` of
 * `cases.length` succeed.
 *
 * Not in default CI — every run bills tokens. Importing the registry
 * opens the db client, so the server `.env` must be loaded.
 */

import { isDeepStrictEqual } from "node:util";

import { agentToolList } from "@openstatus/services/agent-tools";
import { gateway, generateText, stepCountIs, tool } from "ai";

import { type EvalCase, cases } from "./cases";

// Resolved through the AI Gateway (`AI_GATEWAY_API_KEY` env). Using
// `gateway(...)` instead of a bare string makes the routing path
// explicit and gives a clearer error if the gateway is unconfigured.
const MODEL = gateway("anthropic/claude-sonnet-5");
// Lenient bar accommodates model non-determinism even at
// `temperature: 0` — a single flaky tool selection shouldn't tank
// the run. Tighten if descriptions stabilize.
const PASS_THRESHOLD = Math.ceil(cases.length * 0.8);

// The real catalogue, with `run` stubbed: only the selection is under test.
const tools = Object.fromEntries(
  agentToolList.map((t) => [
    t.name,
    tool({
      description: t.description,
      inputSchema: t.inputSchema,
      execute: async () => ({ ok: true }),
    }),
  ]),
);

const SYSTEM_PROMPT = `You are the openstatus assistant. Pick the right tool for each user request and call it with sensible parameters. NEVER guess a pageId — call list_status_pages first when you don't know it.`;

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
    if (c.argEquals) {
      for (const [key, value] of Object.entries(c.argEquals)) {
        if (!(key in args) || !isDeepStrictEqual(args[key], value)) {
          return {
            case: c,
            pass: false,
            reason: `arg ${key}: expected ${JSON.stringify(value)}, got ${JSON.stringify(args[key])}`,
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
