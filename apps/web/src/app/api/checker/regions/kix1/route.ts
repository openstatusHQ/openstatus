import { NextResponse } from "next/server";

import { checker } from "../_checker";

export const runtime = "edge";
export const preferredRegion = ["kix1"];
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await checker(request, preferredRegion[0]);
  return NextResponse.json({ success: true });
}
