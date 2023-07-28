import { NextResponse } from "next/server";

import { cron, isAuthorizedDomain } from "../_cron";

export const runtime = "edge";
export const preferredRegion = ["auto"];
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (isAuthorizedDomain(req.url)) {
    await cron({ periodicity: "30m" });
  }
  return NextResponse.json({ success: true });
}
