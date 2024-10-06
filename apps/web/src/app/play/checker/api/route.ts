import {
  type Method,
  checkRegion,
  storeBaseCheckerData,
  storeCheckerData,
} from "@/components/ping-response-analysis/utils";
import { iteratorToStream, yieldMany } from "@/lib/stream";
import { wait } from "@/lib/utils";
import { flyRegions } from "@openstatus/db/src/schema/constants";
import { mockCheckRegion } from "./mock";

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

      storeCheckerData({ check, id });

      return encoder.encode(
        `${JSON.stringify({
          ...check,
          index,
        })}\n`,
      );
    } catch (error) {
      console.error(error);
      return encoder.encode("");
    }
  });

  yield* yieldMany(promises);
  // return the id as the last value
  yield* generator(id);
}

async function* generator(id: string) {
  // wait for 200ms to avoid racing condition with the last check
  await wait(200);

  yield await Promise.resolve(encoder.encode(id));
}

export async function POST(request: Request) {
  const json = await request.json();
  const { url, method } = json;

  const uuid = crypto.randomUUID().replace(/-/g, "");
  storeBaseCheckerData({ url, method, id: uuid });

  const iterator = makeIterator({ url, method, id: uuid });
  const stream = iteratorToStream(iterator);
  return new Response(stream);
}
