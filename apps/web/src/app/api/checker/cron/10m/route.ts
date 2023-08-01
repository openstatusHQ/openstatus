import type { NextFetchEvent } from "next/server";
import { NextResponse } from "next/server";

import { cron, isAuthorizedDomain } from "../_cron";

// export const runtime = "edge";
export const preferredRegion = ["auto"];
export const dynamic = "force-dynamic";

export async function GET(req: Request /*, context: NextFetchEvent*/) {
  if (isAuthorizedDomain(req.url)) {
    // context.waitUntil(cron({ periodicity: "10m" }));
    await cron({ periodicity: "10m" });
  }
  return NextResponse.json({ success: true });
}
