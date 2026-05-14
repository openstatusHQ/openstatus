// Discovery endpoint for /mcp. Clients asking for JSON get the server card;
// browsers get redirected to the human-readable tooling page.
import { redirect } from "next/navigation";

export function GET(request: Request) {
  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("application/json")) {
    return Response.redirect(
      "https://www.openstatus.dev/.well-known/mcp/server-card.json",
      302,
    );
  }
  redirect("/tooling/mcp-server");
}
