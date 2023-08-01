import { NextResponse } from "next/server";

import { checker } from "../_checker";

export const runtime = "edge";
export const preferredRegion = "auto";
export const dynamic = "force-dynamic";
// Fix is a random region let's figure where does vercel push it

export async function POST(request: Request) {
  const region = process.env.VERCEL_REGION;
  if (!region) {
    throw new Error("No region");
  }
  await checker(request, region);
  return NextResponse.json({ success: true });
}
