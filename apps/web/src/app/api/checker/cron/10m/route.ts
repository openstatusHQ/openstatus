import { NextResponse } from "next/server";

import { cron } from "../_cron";

export const runtime = "edge";
export const preferredRegion = ["auto"];
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await cron({ periodicity: "10m" });
  return NextResponse.json({ success: true });
}
