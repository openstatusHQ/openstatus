import {
  checkRegion,
  type Method,
  setCheckerData,
} from "@/components/ping-response-analysis/utils";
import { flyRegions } from "@openstatus/db/src/schema/constants";
import { mockCheckRegion } from "./mock";

export const runtime = "edge";

function iteratorToStream(
  iterator: AsyncGenerator<Uint8Array, unknown, unknown>,
) {
  return new ReadableStream({
    async pull(controller) {
      try {
        const { value, done } = await iterator.next();
        if (done) {
          controller.close();
        } else {
          controller.enqueue(value);
        }
      } catch (err) {
        console.error("Stream error:", err);
        controller.error(err); // Signal the stream has errored out
      }
    },
    cancel(reason) {
      console.log("Stream canceled:", reason);
      // You might also want to do some cleanup here if necessary
    },
  });
}

const encoder = new TextEncoder();

async function* makeIterator(url: string, method: Method) {
  // Create an array to store all the promises
  const promises = flyRegions.map(async function* (region, index) {
    try {
      // Yield "pending" status
      yield encoder.encode(JSON.stringify({ region, fetch: "pending", index }));

      // Perform the fetch operation
      const check =
        process.env.NODE_ENV === "production"
          ? await checkRegion(url, region, { method })
          : await mockCheckRegion(region);

      if ("body" in check) {
        check.body = undefined; // Drop the body to avoid storing it in Redis Cache
      }

      console.log(check);

      // Yield "done" status
      yield encoder.encode(JSON.stringify({ ...check, fetch: "done", index }));
    } catch (error) {
      console.error(error);
      // Yield "failed" status
      yield encoder.encode(JSON.stringify({ region, fetch: "failed", index }));
    }
  });

  // Use Promise.all to run all promises concurrently
  const results = await Promise.all(promises);

  // Yield all results
  for (const result of results) {
    yield* result;
  }
}
export async function POST(request: Request) {
  const json = await request.json();
  const { url, method } = json;
  const iterator = makeIterator(url, method);
  const stream = iteratorToStream(iterator);
  return new Response(stream);
}
