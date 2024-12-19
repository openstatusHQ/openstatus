import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { cron, isAuthorizedDomain } from "../_cron";
import { runSentryCron } from "../_sentry";

export const runtime = "nodejs";
// export const preferredRegion = ["auto"];
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const revalidate = 0;

export async function GET(req: NextRequest) {
  if (isAuthorizedDomain(req.url)) {
    const { cronCompleted, cronFailed } = runSentryCron("5-m-cron");
    try {
      await cron({ periodicity: "5m", req });
      await cronCompleted();
    } catch (error) {
      await cronFailed();
    }
  }
  return NextResponse.json({ success: true });
}
