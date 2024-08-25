import {
  checkRegion,
  type Method,
  setCheckerData,
} from "@/components/ping-response-analysis/utils";
import { flyRegions } from "@openstatus/db/src/schema/constants";
import { mockCheckRegion } from "./mock";

export const runtime = "edge";

const encoder = new TextEncoder();

function iteratorToStream(iterator: AsyncGenerator<unknown, void, unknown>) {
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

async function* makeIterator(url: string, method: Method) {
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

      console.log(check.region, check.latency);

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

  const generator = yieldMany(promises);

  yield* generator;
}
export async function POST(request: Request) {
  const json = await request.json();
  const { url, method } = json;
  const iterator = makeIterator(url, method);
  const stream = iteratorToStream(iterator);
  return new Response(stream);
}

async function* yieldMany(promises: Promise<unknown>[]) {
  // Attach .then() handlers to the promises to remove them once they resolve
  // REMINDER: DO NOT USE for await (const p of promises) as it will not work as expected
  // biome-ignore lint/complexity/noForEach: <explanation>
  promises.forEach((p) => {
    p.then((value) => {
      promises.splice(promises.indexOf(p), 1);
      return value;
    });
  });

  // Continue yielding the results of the promises as they resolve
  while (promises.length > 0) {
    yield await Promise.race(promises);
  }

  return "done";
}
