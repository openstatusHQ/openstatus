import { resolveChatModel } from "@openstatus/ai";
import { monitorRegions } from "@openstatus/db/src/schema/constants";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import { createLogsTableSchema } from "@/app/(dashboard)/monitors/[id]/logs/table-schema";
import { getChatServiceContext } from "@/lib/agent-tools/context";
import { createAIFilterHandler } from "@/lib/ai/create-ai-filter-handler";
import { chatRateLimit } from "@/lib/rate-limit/chat";
import { WORKSPACE_SLUG_COOKIE } from "@/lib/workspace-cookie";

// The prompt only needs the filter descriptors, so it is built once from every
// region the product offers rather than per monitor.
const schema = createLogsTableSchema({
  regions: [...monitorRegions],
  privateLocations: [],
}).definition;

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

  return createAIFilterHandler({ model, schema })(req);
}
