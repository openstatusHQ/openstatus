import { NextResponse } from "next/server";

import { ping } from "../regions/_checker";
import { payloadSchema } from "../schema";

export const runtime = "edge";
export const preferredRegion = "auto";
export const dynamic = "force-dynamic";
// Fix is a random region let's figure where does vercel push it

export async function POST(request: Request) {
  const json = await request.json();
  const _valid = payloadSchema
    .pick({ url: true, method: true, headers: true, body: true })
    .safeParse(json);

  if (!_valid.success) {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  const check = await ping(_valid.data);

  console.log(check.status);

  if (!check.ok) {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
