import { resolveChatModel } from "@openstatus/ai";
import {
  type ChatStoredMessage,
  storedMessageSchema,
} from "@openstatus/db/src/schema";
import {
  agentTools,
  buildAgentSystemPrompt,
} from "@openstatus/services/agent-tools";
import {
  createChatSession,
  getChatSession,
  setChatSessionMessages,
} from "@openstatus/services/chat-session";
import {
  type UIMessage,
  convertToModelMessages,
  stepCountIs,
  streamText,
} from "ai";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { toAiSdkTools } from "@/lib/agent-tools/adapter";
import { getChatServiceContext } from "@/lib/agent-tools/context";
import { chatRateLimit } from "@/lib/rate-limit/chat";
import { WORKSPACE_SLUG_COOKIE } from "@/lib/workspace-cookie";

// Drop tool parts that have no result the SDK can turn into a tool_result
// block. `ignoreIncompleteToolCalls` doesn't cover `approval-requested`, so
// a mid-confirmation reload would otherwise replay an orphan `tool_use` to
// Anthropic. `approval-responded` IS kept — the SDK resumes execute on it.
const KEEP_TOOL_STATES = new Set([
  "output-available",
  "output-error",
  "output-denied",
  "approval-responded",
]);

const requestSchema = z.object({
  messages: z
    .array(
      z.object({
        id: z.string(),
        role: z.enum(["user", "assistant", "system"]),
        parts: z.array(z.unknown()),
      }),
    )
    .min(1),
  sessionId: z.number().int().optional(),
});

export async function POST(req: NextRequest) {
  const workspaceSlug = (await cookies()).get(WORKSPACE_SLUG_COOKIE)?.value;
  const ctx = await getChatServiceContext({ workspaceSlug });
  if (!ctx || ctx.actor.type !== "user") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const plan = ctx.workspace.plan ?? "free";

  // Provider is resolved from env: a self-hosted OpenAI-compatible endpoint
  // (`AI_BASE_URL`) or the Vercel AI Gateway (`AI_GATEWAY_API_KEY`). `null`
  // means neither is configured.
  const model = resolveChatModel({ plan });
  if (!model) {
    return NextResponse.json(
      { error: "Chat is not configured on this deployment." },
      { status: 503 },
    );
  }

  // Skip the LLM-cost cap entirely in non-prod so testing doesn't
  // burn through the daily allowance. The Redis counter still
  // increments in prod where it matters.
  if (process.env.NODE_ENV === "production") {
    const limit = await chatRateLimit({ ctx });
    if (!limit.success) {
      // AI SDK surfaces `error` as Error.message and drops sibling keys, so embed `reset` in the string.
      const resetIso = new Date(limit.reset).toISOString();
      return NextResponse.json(
        {
          error: `Rate limit exceeded. Reset at ${resetIso}`,
          reset: limit.reset,
        },
        { status: 429 },
      );
    }
  }

  const originalMessages = body.messages as UIMessage[];

  // Resolve session BEFORE streaming.
  //
  //  - With a sessionId, validate it belongs to the caller.
  //  - Without one, eagerly create the session from the latest user
  //    message. The new id is then known when `messageMetadata` fires
  //    on `start`, so the client can navigate to `/chat/{id}` while
  //    the response is still streaming.
  let sessionId: number;
  if (body.sessionId !== undefined) {
    try {
      await getChatSession({ ctx, input: { sessionId: body.sessionId } });
    } catch {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    sessionId = body.sessionId;
  } else {
    const latestUser = [...originalMessages]
      .reverse()
      .find((m) => m.role === "user");
    if (!latestUser) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }
    const seed = storedMessageSchema.safeParse(trimMessage(latestUser));
    if (!seed.success || seed.data.parts.length === 0) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }
    const created = await createChatSession({
      ctx,
      input: { firstMessage: seed.data },
    });
    sessionId = created.id;
  }

  const tools = toAiSdkTools(agentTools, ctx);
  const safeMessages = originalMessages.map((m) => ({
    ...m,
    parts: (m.parts ?? []).filter((p) => {
      if (!p || typeof (p as { type?: unknown }).type !== "string")
        return false;
      const part = p as { type: string; state?: string };
      if (part.type === "text" || part.type === "step-start") return true;
      if (!part.type.startsWith("tool-")) return false;
      return KEEP_TOOL_STATES.has(part.state ?? "");
    }),
  }));
  const modelMessages = await convertToModelMessages(
    safeMessages as UIMessage[],
    { tools, ignoreIncompleteToolCalls: true },
  );

  const result = streamText({
    model,
    system: buildAgentSystemPrompt({
      workspaceName: ctx.workspace.name ?? "Unknown",
      surface: "dashboard",
      canNotifySubscribers: ctx.workspace.limits["status-subscribers"] === true,
    }),
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(10),
  });

  return result.toUIMessageStreamResponse({
    originalMessages,
    // Force a non-empty id on every response message — without this
    // the SDK can emit `id: ""` for the assistant turn, which causes
    // React's key-collision warning when multiple turns coexist and
    // makes downstream message lookups ambiguous.
    generateMessageId: () => crypto.randomUUID(),
    // Attach `{ sessionId }` to the start chunk so the client can
    // swap `/chat` → `/chat/{id}` after the first turn.
    messageMetadata: ({ part }) => {
      if (part.type === "start") return { sessionId };
      return undefined;
    },
    onFinish: async ({ messages }) => {
      try {
        await persistFullConversation({
          ctx,
          sessionId,
          messages: messages as UIMessage[],
        });
      } catch (err) {
        console.warn("chat onFinish persistence failed", err);
      }
    },
  });
}

/**
 * Strip parts the SDK emits that don't belong in persistent storage
 * (`reasoning`, `source-*`, `file`, `data-*`). We KEEP `step-start`
 * parts: AI SDK's `convertToModelMessages` uses them as block
 * delimiters when emitting Anthropic-shaped messages — without them,
 * an assistant turn that contains both a tool call and a follow-up
 * text reply collapses into a single `[tool_use, text]` ModelMessage,
 * which Anthropic rejects (`tool_use` must be the last content block
 * before the matching `tool_result`).
 */
function trimMessage(m: UIMessage): UIMessage {
  const parts = (m.parts ?? []).filter((p) => {
    if (!p || typeof (p as { type?: unknown }).type !== "string") return false;
    const type = (p as { type: string }).type;
    return type === "text" || type === "step-start" || type.startsWith("tool-");
  });
  // Stamp `createdAt` so the persisted message satisfies the (now
  // required) schema. The service-layer `mergeTimestamps` overrides
  // this with the existing row's stamp when the message id already
  // appears, so this `Date.now()` only "sticks" for brand-new
  // messages.
  const incoming = m as UIMessage & { createdAt?: number };
  return {
    ...m,
    parts,
    createdAt: incoming.createdAt ?? Date.now(),
  } as UIMessage;
}

/**
 * Replace the session's full message list with the trimmed snapshot
 * from the SDK. Idempotent: HITL flows fire `onFinish` multiple times
 * for the same logical turn (paused before confirm, resumed after);
 * full-replace lets each fire be the canonical state without drifting
 * orphans into the row.
 */
async function persistFullConversation(args: {
  ctx: NonNullable<Awaited<ReturnType<typeof getChatServiceContext>>>;
  sessionId: number;
  messages: UIMessage[];
}) {
  const trimmed: ChatStoredMessage[] = [];
  for (const m of args.messages) {
    const parsed = storedMessageSchema.safeParse(trimMessage(m));
    if (parsed.success && parsed.data.parts.length > 0) {
      trimmed.push(parsed.data);
    }
  }
  if (trimmed.length === 0) return;
  await setChatSessionMessages({
    ctx: args.ctx,
    input: { sessionId: args.sessionId, messages: trimmed },
  });
}
