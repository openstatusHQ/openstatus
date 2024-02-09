import { NextResponse } from "next/server";
import { z } from "zod";

import { monitorFlyRegionSchema } from "@openstatus/db/src/schema";

import { checkRegion } from "@/app/play/checker/[id]/utils"; // TODO: move into a shared package
import { payloadSchema } from "../schema";

export const runtime = "edge";
export const preferredRegion = "auto";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ success: true });
}

export async function POST(request: Request) {
  const json = await request.json();
  const _valid = payloadSchema
    .pick({ url: true, method: true, headers: true, body: true })
    .merge(z.object({ region: monitorFlyRegionSchema.default("ams") }))
    .safeParse(json);

  if (!_valid.success) {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  const { url, region, method, headers, body } = _valid.data;

  const res = await checkRegion(url, region, { method, headers, body });

  return NextResponse.json(res);
}
