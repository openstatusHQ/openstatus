import { resolveChatModel } from "@openstatus/ai";
import { monitorRegions } from "@openstatus/db/src/schema/constants";
import {
  createTableSchema,
  type TableSchemaDefinition,
} from "@openstatus/ui/lib/data-table-filters/table-schema/index";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import { createLogsTableSchema } from "@/app/(dashboard)/monitors/[id]/logs/table-schema";
import { getChatServiceContext } from "@/lib/agent-tools/context";
import { createAIFilterHandler } from "@/lib/ai/create-ai-filter-handler";
import { chatRateLimit } from "@/lib/rate-limit/chat";
import { WORKSPACE_SLUG_COOKIE } from "@/lib/workspace-cookie";

// Used when the request carries no usable schema. Covers every region the
// product offers, which is a superset of any single monitor's.
const fallbackSchema: TableSchemaDefinition = createLogsTableSchema({
  regions: [...monitorRegions],
  privateLocations: [],
}).definition;

/** Above this the payload is not a table schema, whatever it claims to be. */
const MAX_SCHEMA_BYTES = 64_000;

/**
 * The client sends the schema of the table it is filtering, so the prompt and
 * the output schema describe that monitor's regions and private locations —
 * inferring against a generic schema silently drops both. `fromJSON` normalises
 * and validates the untrusted JSON; anything it rejects falls back.
 */
function resolveSchema(raw: unknown): TableSchemaDefinition {
  if (!raw) return fallbackSchema;
  try {
    if (JSON.stringify(raw).length > MAX_SCHEMA_BYTES) return fallbackSchema;
    return createTableSchema.fromJSON(raw).definition;
  } catch {
    return fallbackSchema;
  }
}

export async function POST(req: NextRequest) {
  const workspaceSlug = (await cookies()).get(WORKSPACE_SLUG_COOKIE)?.value;
  const ctx = await getChatServiceContext({ workspaceSlug });
  if (!ctx || ctx.actor.type !== "user") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!ctx.workspace.limits["response-logs"]) {
    return NextResponse.json(
      { error: "Response logs are not enabled on this plan." },
      { status: 403 },
    );
  }

  const model = resolveChatModel({ plan: ctx.workspace.plan ?? "free" });
  if (!model) {
    return NextResponse.json(
      { error: "AI filters are not configured on this deployment." },
      { status: 503 },
    );
  }

  // Same carve-out as `api/chat`: the Redis counter only guards production.
  if (process.env.NODE_ENV === "production") {
    const limit = await chatRateLimit({ ctx });
    if (!limit.success) {
      return NextResponse.json(
        {
          error: `Rate limit exceeded. Reset at ${new Date(limit.reset).toISOString()}`,
          reset: limit.reset,
        },
        { status: 429 },
      );
    }
  }

  // Read from a clone: the handler consumes the original body itself.
  let schema = fallbackSchema;
  try {
    const body = await req.clone().json();
    schema = resolveSchema(body?.schema);
  } catch {
    // Malformed body — the handler reports it.
  }

  return createAIFilterHandler({ model, schema })(req);
}
