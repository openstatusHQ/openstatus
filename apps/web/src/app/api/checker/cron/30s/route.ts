import * as Sentry from "@sentry/nextjs";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { cron, isAuthorizedDomain } from "../_cron";

export const runtime = "nodejs";
// export const preferredRegion = ["auto"];
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const revalidate = 0;

export async function GET(req: NextRequest) {
  if (isAuthorizedDomain(req.url)) {
    const checkInId = Sentry.captureCheckIn({
      monitorSlug: "30-s-cron",
      status: "in_progress",
    });
    await cron({ periodicity: "30s", req });
    Sentry.captureCheckIn({
      checkInId,
      monitorSlug: "30-s-cron",
      status: "ok",
    });
  }
  return NextResponse.json({ success: true });
}
