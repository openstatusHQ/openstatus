import crypto from "crypto";
import { NextResponse } from "next/server";
import * as z from "zod";

import { logDrainSchemaArray } from "../libs/schema";
import { publishVercelLogDrain } from "../libs/tinybird";

export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Ingest log drains from Vercel.
 */
export async function POST(request: Request) {
  const { INTEGRATION_SECRET, LOG_DRAIN_SECRET } = process.env;

  if (typeof INTEGRATION_SECRET != "string") {
    throw new Error("No integration secret found");
  }

  if (typeof LOG_DRAIN_SECRET != "string") {
    throw new Error("No log drain secret found");
  }

  const rawBody = await request.text();
  const rawBodyBuffer = Buffer.from(rawBody, "utf-8");
  const bodySignature = sha1(rawBodyBuffer, LOG_DRAIN_SECRET);

  /**
   * Validates the signature of the request
   * Uncomment for 'Test Log Drain' in Vercel
   */
  if (bodySignature !== request.headers.get("x-vercel-signature")) {
    return NextResponse.json(
      {
        code: "invalid_signature",
        error: "signature didn't match",
      },
      { status: 401 },
    );
  }

  /**
   * Returns a header verification to Vercel, so the route can be added as a log drain
   */
  if (z.object({}).safeParse(JSON.parse(rawBody)).success) {
    return NextResponse.json(
      { code: "ok" },
      { status: 200, headers: { "x-vercel-verify": INTEGRATION_SECRET } },
    );
  }

  /**
   * Validates the body of the request
   */
  const logDrains = logDrainSchemaArray.safeParse(JSON.parse(rawBody));

  if (logDrains.success) {
    /**
     * TODO: it would be nice to have a way to publish all the logs in a single request (bulky insert)
     * Injest log drains into Tinybird
     */
    await publishVercelLogDrain()(logDrains.data);

    return NextResponse.json({ code: "ok" }, { status: 200 });
  }
  return NextResponse.json({ error: logDrains.error }, { status: 500 });
}

/**
 * Creates a sha1 hash from a buffer and a secret
 */
function sha1(data: Buffer, secret: string) {
  return crypto.createHmac("sha1", secret).update(data).digest("hex");
}
