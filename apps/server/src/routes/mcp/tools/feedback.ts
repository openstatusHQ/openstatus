import type {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { feedbackType } from "@openstatus/db/src/schema";
import {
  PreconditionFailedError,
  type ServiceContext,
} from "@openstatus/services";
import { submitFeedback } from "@openstatus/services/feedback";
import { incrWithTtl } from "@openstatus/upstash";
import { z } from "zod";

import { env } from "@/env";
import { redis } from "@/libs/clients";

import { runTool } from "../adapter";
import { trackToolSuccess } from "../analytics";
import { registerScopedTool } from "./register-scoped";

const TOOL_NAME = "submit_feedback";
const PER_HOUR = 10;

const inputSchema = {
  message: z
    .string()
    .trim()
    .min(1)
    .max(4000)
    .describe(
      "What happened or what would help: what you tried, what you expected, what you got. Quote error messages verbatim.",
    ),
  type: z
    .enum(feedbackType)
    .optional()
    .describe(
      "bug: a tool failed or returned something wrong. feature: a missing tool, field or capability. question: unclear docs or tool description.",
    ),
  tool: z
    .string()
    .max(100)
    .optional()
    .describe("Name of the openstatus tool the feedback is about, if any."),
  blocker: z
    .boolean()
    .optional()
    .describe("True when the task could not be completed because of this."),
};

const outputSchema = { received: z.boolean() };

export type FeedbackToolConfig = { slackWebhookUrl?: string };

// Per-credential cap, counted atomically: MCP has no session, so this is what
// keeps a looping agent out of the feedback channel.
async function assertFeedbackBudget(ctx: ServiceContext): Promise<void> {
  const { actor } = ctx;
  if (actor.type !== "mcp") return;
  const [count] = await incrWithTtl(
    redis,
    [`ratelimit:mcp-feedback:${ctx.workspace.id}:${actor.keyId}`],
    60 * 60,
  );
  if (count > PER_HOUR) {
    throw new PreconditionFailedError(
      `Feedback budget reached: this credential is capped at ${PER_HOUR} submissions per hour.`,
    );
  }
}

export function registerFeedbackTools(
  server: McpServer,
  ctx: ServiceContext,
  config: FeedbackToolConfig = {
    slackWebhookUrl: env.SLACK_FEEDBACK_WEBHOOK_URL,
  },
): Map<string, RegisteredTool> {
  const registered = new Map<string, RegisteredTool>();
  const handle = registerScopedTool(
    server,
    ctx,
    TOOL_NAME,
    {
      scope: "any",
      description:
        "Send feedback about the openstatus MCP server to the openstatus team. Call it when a tool failed unexpectedly, returned a wrong or confusing result, a tool or field you needed is missing, or a description misled you; also when the user asks to pass feedback on. One call per distinct problem, after the task is done or blocked. Never include secrets, credentials or customer data: the message is read by humans.",
      // No `readOnlyHint`: `any` counts as a read scope, but this tool writes.
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      inputSchema,
      outputSchema,
    },
    async (input: unknown) =>
      runTool(
        async () => {
          const parsed = z.object(inputSchema).parse(input);
          await assertFeedbackBudget(ctx);
          await submitFeedback({
            ctx,
            input: {
              source: "mcp",
              message: parsed.message,
              type: parsed.type,
              blocker: parsed.blocker,
              path: parsed.tool ?? "mcp",
            },
            slackWebhookUrl: config.slackWebhookUrl,
          });
          trackToolSuccess(ctx, TOOL_NAME);
          return { received: true };
        },
        (out) => ({
          content: [{ type: "text", text: JSON.stringify(out) }],
          structuredContent: out,
        }),
      ),
  );
  if (handle) registered.set(TOOL_NAME, handle);
  return registered;
}
