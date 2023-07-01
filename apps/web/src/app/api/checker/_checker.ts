import { Receiver } from "@upstash/qstash/cloudflare";
import { z } from "zod";

import { publishPingResponse, Tinybird } from "@openstatus/tinybird";

import { env } from "@/env.mjs";

export const monitorSchema = z.object({
  url: z.string().url(),
});

const tb = new Tinybird({ token: env.TINY_BIRD_API_KEY });

const monitor = async (
  res: Response,
  { latency, url, region }: { latency: number; url: string; region: string },
) => {
  await publishPingResponse(tb)({
    id: "openstatus",
    timestamp: Date.now(),
    statusCode: res.status,
    latency,
    url,
    region: region,
  });
};

export const checker = async (request: Request, region: string) => {
  const r = new Receiver({
    currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
  });

  const body = await request.text();
  const isValid = r.verify({
    signature: request?.headers?.get("Upstash-Signature") || "",
    body,
  });
  if (!isValid) {
    return new Response("Error", { status: 400 });
  }

  const jsonData = await request.json();

  const data = monitorSchema.parse(jsonData);
  const startTime = Date.now();
  const res = await fetch(data.url, { cache: "no-store" });
  const endTime = Date.now();
  const latency = endTime - startTime;

  await monitor(res, { latency, url: data.url, region: region });
};
