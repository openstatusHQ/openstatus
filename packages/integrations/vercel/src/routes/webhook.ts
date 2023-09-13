import { log } from "console";
import crypto from "crypto";
import { NextResponse } from "next/server";
import * as z from "zod";

import { env } from "../../env";
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
  const rawBody = await request.text();
  // const rawBodyBuffer = Buffer.from(rawBody, "utf-8");
  // // const bodySignature = sha1(rawBodyBuffer, "LOG_DRAIN_SECRET");

  // // /**
  // //  * Validates the signature of the request
  // //  * Uncomment for 'Test Log Drain' in Vercel
  // //  */
  // // if (bodySignature !== request.headers.get("x-vercel-signature")) {
  // //   return NextResponse.json(
  // //     {
  // //       code: "invalid_signature",
  // //       error: "signature didn't match",
  // //     },
  // //     { status: 401 },
  // //   );
  // // }

  /**
   * Returns a header verification to Vercel, so the route can be added as a log drain
   */
  if (z.object({}).safeParse(JSON.parse(rawBody)).success) {
    return NextResponse.json(
      { code: "ok" },
      { status: 200, headers: { "x-vercel-verify": env.INTEGRATION_SECRET } },
    );
  }

  /**
   * Validates the body of the request
   */
  const logDrains = logDrainSchemaArray.safeParse(JSON.parse(rawBody));

  if (logDrains.success) {
    // We are only pushing the logs that are not stdout or stderr
    const data = logDrains.data.filter(
      (log) => log.type !== "stdout" && log.type !== "stderr",
    );

    for (const event of data) {
      // FIXME: Zod-bird is broken
      await publishVercelLogDrain()(event);
    }

    return NextResponse.json({ code: "ok" }, { status: 200 });
  } else {
    console.error("Error parsing logDrains", logDrains.error);
  }
  return NextResponse.json({ error: logDrains.error }, { status: 500 });
}

/**
 * Creates a sha1 hash from a buffer and a secret
 */
function sha1(data: Buffer, secret: string) {
  return crypto.createHmac("sha1", secret).update(data).digest("hex");
}
