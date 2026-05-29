import { NextResponse } from "next/server";
import { z } from "zod";

import {
  type Region,
  monitorRegionSchema,
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
      .extend(z.object({ region: monitorRegionSchema.prefault("ams") }).shape)
      .safeParse(json);

    if (!_valid.success) {
      return NextResponse.json({ success: false }, { status: 400 });
    }

    const { url, region } = _valid.data;

    const res = await checkTCP(url, region);

    return NextResponse.json(res);
  } catch (e) {
    // Unreachable/timeout targets are expected; only real bugs should reach Sentry.
    if (!(e instanceof TargetUnreachableError)) {
      console.error(e);
    }
    return NextResponse.json({ success: false }, { status: 400 });
  }
}

class TargetUnreachableError extends Error {}
async function checkTCP(url: string, region: Region) {
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

  // A timeout / unreachable target is an expected outcome, not a bug — throw so
  // the caller returns 400, but the catch keeps it out of Sentry.
  if (!data.success) {
    throw new TargetUnreachableError(data.error.message);
  }

  return data.data;
}
