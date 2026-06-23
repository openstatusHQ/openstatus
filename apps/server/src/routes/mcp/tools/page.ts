import type {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp";
import type { ServiceContext } from "@openstatus/services";
import {
  listPageComponentsTool,
  listStatusPagesTool,
} from "@openstatus/services/agent-tools";

import { registerRegistryTools } from "./registry-adapter";

// Pages carry secrets (`password`, `customDomain` access controls) that
// must never reach an LLM client. The registry tool projects to a slim
// `{ id, title, slug }` shape; full row never leaves the service.
//
// No pagination input — pages are low-cardinality and `listPages`
// doesn't push a limit through. Add real pagination if a workspace ever
// hits a problematic count.
export function registerPageTools(
  server: McpServer,
  ctx: ServiceContext,
): Map<string, RegisteredTool> {
  return registerRegistryTools(server, ctx, [
    listStatusPagesTool,
    listPageComponentsTool,
  ]);
}
