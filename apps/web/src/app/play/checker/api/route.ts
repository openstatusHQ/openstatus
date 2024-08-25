import {
  checkRegion,
  type Method,
  storeBaseCheckerData,
  storeCheckerData,
} from "@/components/ping-response-analysis/utils";
import { flyRegions } from "@openstatus/db/src/schema/constants";
import { mockCheckRegion } from "./mock";
import { iteratorToStream, yieldMany } from "@/lib/stream";

export const runtime = "edge";

const encoder = new TextEncoder();

async function* makeIterator({
  url,
  method,
  id,
}: { url: string; method: Method; id: string }) {
  // Create an array to store all the promises
  const promises = flyRegions.map(async (region, index) => {
    try {
      // Perform the fetch operation
      const check =
        process.env.NODE_ENV === "production"
          ? await checkRegion(url, region, { method })
          : await mockCheckRegion(region);

      if ("body" in check) {
        check.body = undefined; // Drop the body to avoid storing it in Redis Cache
      }

      // storeCheckerData({ check, id });

      return encoder.encode(
        `${JSON.stringify({
          ...check,
          index,
        })}\n`,
      );
    } catch (error) {
      console.error(error);
    }
  });

  yield* yieldMany(promises);
}

export async function POST(request: Request) {
  const json = await request.json();
  const { url, method } = json;

  // const uuid = crypto.randomUUID().replace(/-/g, "");
  const uuid = "aec4e0ec3c4f4557b8ce46e55078fc95";
  storeBaseCheckerData({ url, method, id: uuid });

  const iterator = makeIterator({ url, method, id: uuid });
  const stream = iteratorToStream(iterator);
  return new Response(stream);
}
