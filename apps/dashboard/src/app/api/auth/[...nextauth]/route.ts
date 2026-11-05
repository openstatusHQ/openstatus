import type { NextRequest } from "next/server";

import { handlers } from "@/lib/auth";

export const { POST } = handlers;

// Auth.js bounces an expired or reused magic link to `pages.error` without the
// link's `callbackUrl`; carry it over as `redirectTo` so the retry still lands
// on the invite.
export async function GET(req: NextRequest) {
  const res = await handlers.GET(req);
  const location = res.headers.get("Location");
  const callbackUrl = req.nextUrl.searchParams.get("callbackUrl");
  if (!location || !callbackUrl) return res;

  const target = new URL(location, req.nextUrl.origin);
  if (target.searchParams.get("error") !== "Verification") return res;
  const destination = new URL(callbackUrl, req.nextUrl.origin);
  if (destination.origin !== req.nextUrl.origin) return res;

  target.searchParams.set(
    "redirectTo",
    `${destination.pathname}${destination.search}`,
  );
  const headers = new Headers(res.headers);
  headers.set("Location", target.toString());
  return new Response(null, { status: res.status, headers });
}

// Mail link scanners probe magic links with HEAD. Next would route HEAD to
// GET, which consumes the token; answer 200 before Auth.js sees it.
export function HEAD() {
  return new Response(null, { status: 200 });
}
