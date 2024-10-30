import { NextResponse } from "next/server";
import { z } from "zod";

import {
  type MonitorFlyRegion,
  monitorFlyRegionSchema,
} from "@openstatus/db/src/schema/constants";

import { TCPResponse, tcpPayload } from "./schema";

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
    const _valid = tcpPayload
      .pick({ url: true })
      .merge(z.object({ region: monitorFlyRegionSchema.default("ams") }))
      .safeParse(json);

    if (!_valid.success) {
      return NextResponse.json({ success: false }, { status: 400 });
    }

    const { url, region } = _valid.data;

    const res = await checkTCP(url, region);

    return NextResponse.json(res);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false }, { status: 400 });
  }
}
async function checkTCP(url: string, region: MonitorFlyRegion) {
  //
  const res = await fetch(`https://checker.openstatus.dev/tcp/${region}`, {
    headers: {
      Authorization: `Basic ${process.env.CRON_SECRET}`,
      "Content-Type": "application/json",
      "fly-prefer-region": region,
    },
    method: "POST",
    body: JSON.stringify({
      uri: url,
    }),
    next: { revalidate: 0 },
  });

  const json = await res.json();

  const data = TCPResponse.safeParse(json);

  if (!data.success) {
    console.error(
      `something went wrong with result ${json} request to ${url} error ${data.error.message}`,
    );
    throw new Error(data.error.message);
  }

  return data.data;
}
