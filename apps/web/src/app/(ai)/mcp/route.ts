// Discovery endpoint for /mcp. JSON clients receive the server card inline
// (no domain coupling); browsers get redirected to the human-readable page.
import { GET as serverCardGET } from "@/app/.well-known/mcp/server-card.json/route";

export function GET(request: Request) {
  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("application/json")) {
    return serverCardGET();
  }
  return Response.redirect(new URL("/tooling/mcp-server", request.url), 302);
}
