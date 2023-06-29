import { publishPingResponse, Tinybird } from "@openstatus/tinybird";

import { env } from "@/env.mjs";

// TODO: create one route per region
export const preferredRegion = ["fra1"];
export const runtime = "edge";

const DEFAULT_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://openstatus.dev";

const tb = new Tinybird({ token: env.TINY_BIRD_API_KEY });

// TODO: create a package for monitor
async function monitor(
  res: Response,
  { latency, url }: { latency: number; url: string },
) {
  return await publishPingResponse(tb)({
    id: "openstatus",
    timestamp: Date.now(),
    statusCode: res.status,
    latency,
    url,
    // TODO: add region, res
  });
}

// TODO: auth middleware for user API check (unkey)
export async function GET(req: Request) {
  try {
    console.log(req.url);
    const { searchParams } = new URL(req.url);
    const hasUrl = searchParams.has("url");
    const url = hasUrl ? searchParams.get("url") : `${DEFAULT_URL}/api/v0/ping`;

    console.log("url", url);
    if (!url) {
      return new Response("Error", { status: 400 });
    }

    const startTime = Date.now();
    const res = await fetch(url, { cache: "no-store" });
    const endTime = Date.now();
    const latency = endTime - startTime;

    await monitor(res, { latency, url });

    return new Response("OK", { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response("Error", { status: 500 });
  }
}
