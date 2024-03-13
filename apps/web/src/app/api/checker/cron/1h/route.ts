import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { cron, isAuthorizedDomain } from "../_cron";

export const runtime = "nodejs";
// export const preferredRegion = ["auto"];
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (isAuthorizedDomain(req.url)) {
    const checkInId = Sentry.captureCheckIn({
      monitorSlug: "1-h-cron",
      status: "in_progress",
    });
    await cron({ periodicity: "1h", req });
    Sentry.captureCheckIn({
      checkInId,
      monitorSlug: "1-h-cron",
      status: "ok",
    });
  }
  return NextResponse.json({ success: true });
}
