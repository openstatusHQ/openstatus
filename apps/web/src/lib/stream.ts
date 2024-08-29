export async function* yieldMany(promises: Promise<unknown>[]) {
  // Attach .then() handlers to the promises to remove them as soon as they resolve
  // biome-ignore lint/complexity/noForEach: REMINDER: do not use for await (const p of promises) as it will not work as expected
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

export function iteratorToStream(iterator: AsyncGenerator) {
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
        controller.error(err);
      }
    },
  });
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * HOW TO USE IT IN YOUR ROUTE
 * @returns {Response}
 */
export async function POST(request: Request) {
  // extract your params from the request
  const _json = await request.json();

  const generator = yieldMany([
    new Promise((resolve) =>
      setTimeout(() => resolve(encoder.encode("1")), 200),
    ),
    new Promise((resolve) => resolve(encoder.encode("2"))),
    new Promise((resolve) =>
      setTimeout(() => resolve(encoder.encode("3")), 500),
    ),
  ]);

  const stream = iteratorToStream(generator);
  return new Response(stream);
}

/**
 * HOW TO USE IT IN YOUR CLIENT
 */
async function clientConsumeStream() {
  const response = await POST(new Request("")); // fetch("/api/path/to/route", { method: "POST" });
  const reader = response.body?.getReader();
  if (!reader) return;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    console.log("Stream output:", decoder.decode(value));
  }

  console.log("Stream processing complete.");
}
