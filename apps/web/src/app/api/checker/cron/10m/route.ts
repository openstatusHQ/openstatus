import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { cron, isAuthorizedDomain } from "../_cron";

export const runtime = "nodejs";
// export const preferredRegion = ["auto"];
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (isAuthorizedDomain(req.url)) {
    await cron({ periodicity: "10m", req });
  }
  return NextResponse.json({ success: true });
}
