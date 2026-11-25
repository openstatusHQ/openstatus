import { handlers } from "../../../../lib/auth";

export const { GET, POST } = handlers;

// Mail link scanners probe magic links with HEAD. Next would route HEAD to
// GET, which consumes the token; refuse the method before Auth.js sees it.
export function HEAD() {
  return new Response(null, { status: 405, headers: { Allow: "GET, POST" } });
}
