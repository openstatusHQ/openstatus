import {
  PreconditionFailedError,
  type ServiceContext,
} from "@openstatus/services";
import { incrWithTtl } from "@openstatus/upstash";

import { redis } from "@/libs/clients";

const PER_HOUR = 30;

// Only the resources the setup tools create; incident comms must not eat the budget.
const BUDGETED_TOOLS = new Set([
  "create_monitor",
  "create_status_page",
  "add_page_component",
  "create_component_group",
]);

/**
 * Per-credential cap on MCP creates per hour. MCP has no session, so this is
 * what stops a looping agent. Counts attempts, atomically, so parallel calls
 * can't slip past the cap.
 */
export async function assertCreateBudget(
  ctx: ServiceContext,
  toolName: string,
): Promise<void> {
  const { actor } = ctx;
  if (actor.type !== "mcp" || !BUDGETED_TOOLS.has(toolName)) return;

  const [count] = await incrWithTtl(
    redis,
    [`ratelimit:mcp-create:${ctx.workspace.id}:${actor.keyId}`],
    60 * 60,
  );
  if (count > PER_HOUR) {
    throw new PreconditionFailedError(
      `Create budget reached: this credential is capped at about ${PER_HOUR} creates per hour. Try again later.`,
    );
  }
}
