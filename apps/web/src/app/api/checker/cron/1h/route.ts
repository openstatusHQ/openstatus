import { NextResponse } from "next/server";

import { cron } from "../_cron";
import { isAuthorizedDomain } from "../../_shared";

// export const runtime = "edge";
export const preferredRegion = ["auto"];
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (isAuthorizedDomain(req.url)) {
    await cron({ periodicity: "1h" });
  }
  return NextResponse.json({ success: true });
}
