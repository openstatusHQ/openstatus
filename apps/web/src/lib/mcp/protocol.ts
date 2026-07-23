// Edge-safe + client-safe: pure constants only, no imports.
// Shared by the health-check runner (server) and the detail dialog (client) so
// the displayed request bodies can't drift from what's actually sent.
// MCP spec: https://modelcontextprotocol.io/specification/2025-06-18

export const PROTOCOL_VERSION = "2025-06-18";
export const CLIENT_INFO = {
  name: "openstatus-health-check",
  version: "1.0.0",
};

export const REQ_ID_INIT = "openstatus-init";
export const REQ_ID_PING = "openstatus-ping";
export const REQ_ID_TOOLS = "openstatus-tools";

export const STEP_REQUEST_BODIES = {
  initialize: {
    jsonrpc: "2.0",
    id: REQ_ID_INIT,
    method: "initialize",
    params: {
      protocolVersion: PROTOCOL_VERSION,
      clientInfo: CLIENT_INFO,
      capabilities: {},
    },
  },
  ping: { jsonrpc: "2.0", id: REQ_ID_PING, method: "ping" },
  toolsList: { jsonrpc: "2.0", id: REQ_ID_TOOLS, method: "tools/list" },
} as const;

export type StepKey = keyof typeof STEP_REQUEST_BODIES;
