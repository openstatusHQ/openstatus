import { handlers } from "../../../../lib/auth";

export const { GET, POST } = handlers;

// Mail link scanners probe magic links with HEAD. Next routes HEAD to GET;
// Auth.js then rejects the method with a 500 anyway, so answer it up front.
export function HEAD() {
  return new Response(null, { status: 500 });
}
