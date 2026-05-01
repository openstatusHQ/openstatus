export async function* yieldMany<T>(promises: Promise<T>[]) {
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
