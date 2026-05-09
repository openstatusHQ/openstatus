import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import { ServiceError } from "@openstatus/services";
import { agentTools } from "@openstatus/services/agent-tools";
import { z } from "zod";

import { getChatServiceContext } from "@/lib/agent-tools/context";

export const runtime = "edge";

const requestSchema = z.object({
  toolName: z.string().min(1),
  input: z.unknown(),
});

/**
 * Human-in-the-loop execution path for destructive tools.
 *
 * `/api/chat` omits `execute` for destructive tools so the AI SDK pauses
 * on the tool-call. The dashboard renders a confirm card; on confirm the
 * client POSTs `{ toolName, input }` here, the server re-validates the
 * input against the registry's Zod schema, runs the verb, and returns
 * the structured output. The client then calls `addToolResult` with the
 * response so the SDK resumes the stream.
 *
 * Re-validation is load-bearing: the model's draft input could be
 * stale by the time the user clicks confirm (page deleted, component
 * removed). The registry verb's own checks throw `NotFoundError` /
 * `ConflictError` which we translate to a structured `error` payload —
 * the client surfaces that on the confirm card with Retry / Cancel.
 */
export async function POST(req: NextRequest) {
  const workspaceSlug = (await cookies()).get("workspace-slug")?.value;
  const ctx = await getChatServiceContext({ workspaceSlug });
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const tool = agentTools[body.toolName];
  if (!tool || !tool.destructive) {
    return NextResponse.json({ error: "Unknown tool" }, { status: 404 });
  }

  let parsedInput: unknown;
  try {
    parsedInput = tool.inputSchema.parse(body.input);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Invalid tool input",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 400 },
    );
  }

  try {
    const output = await tool.run({ ctx, input: parsedInput });
    return NextResponse.json({ ok: true, output });
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json(
        { ok: false, code: err.code, error: err.message },
        { status: serviceErrorStatus(err.code) },
      );
    }
    console.warn("chat confirm tool execution failed", err);
    return NextResponse.json(
      { ok: false, error: "Tool execution failed" },
      { status: 500 },
    );
  }
}

function serviceErrorStatus(code: string): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "FORBIDDEN":
      return 403;
    case "UNAUTHORIZED":
      return 401;
    case "CONFLICT":
      return 409;
    case "VALIDATION":
      return 400;
    case "PRECONDITION_FAILED":
      return 412;
    case "LIMIT_EXCEEDED":
      return 429;
    default:
      return 500;
  }
}
