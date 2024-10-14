import { NextResponse } from "next/server";
import { z } from "zod";

import { monitorFlyRegionSchema } from "@openstatus/db/src/schema/constants";

import { checkRegion } from "@/components/ping-response-analysis/utils";
import { httpPayloadSchema } from "@openstatus/utils";
import { isAnInvalidTestUrl } from "../../utils";

export const runtime = "edge";
export const preferredRegion = "auto";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export function GET() {
  return NextResponse.json({ success: true });
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const _valid = httpPayloadSchema
      .pick({ url: true, method: true, headers: true, body: true })
      .merge(z.object({ region: monitorFlyRegionSchema.default("ams") }))
      .safeParse(json);

    if (!_valid.success) {
      return NextResponse.json({ success: false }, { status: 400 });
    }

    const { url, region, method, headers, body } = _valid.data;
    // 🧑‍💻 for the smart one who want to create a loop hole
    if (isAnInvalidTestUrl(url)) {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const res = await checkRegion(url, region, { method, headers, body });

    return NextResponse.json(res);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false }, { status: 400 });
  }
}
