// Discovery endpoint for /mcp. JSON clients receive the server card inline
// (no domain coupling); browsers get redirected to the human-readable page.
import { GET as serverCardGET } from "../../.well-known/mcp/server-card.json/route";

/** Where the streamable-HTTP transport actually lives. */
export const MCP_TRANSPORT_URL = "https://api.openstatus.dev/mcp";

export function GET(request: Request) {
  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("application/json")) {
    return serverCardGET();
  }
  return Response.redirect(new URL("/tooling/mcp-server", request.url), 302);
}

/**
 * MCP clients POST their JSON-RPC handshake at whatever URL they were handed,
 * and this one is only a discovery document. 307 keeps the method and body so
 * the client reaches the transport instead of reading a 405 as a dead server.
 */
export function POST() {
  return Response.redirect(MCP_TRANSPORT_URL, 307);
}

export function DELETE() {
  return Response.redirect(MCP_TRANSPORT_URL, 307);
}
