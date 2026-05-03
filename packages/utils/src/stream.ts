export async function* yieldMany<T>(promises: Promise<T>[]) {
  // Race-free settle-as-they-arrive: each promise pushes into a queue when it
  // resolves; the consumer drains the queue and parks on a fresh wake-up
  // promise when empty. This avoids the splice/Promise.race pattern, which
  // can drop values when multiple promises settle in the same microtask
  // batch (both spliced before the next race iteration). Rejections are
  // surfaced as thrown values to the caller — the underlying probe paths
  // are expected to convert failures into result objects upstream.
  const queue: T[] = [];
  let pending = promises.length;
  let wake: (() => void) | null = null;
  let rejection: { error: unknown } | null = null;

  for (const p of promises) {
    p.then(
      (value) => {
        queue.push(value);
        pending--;
        wake?.();
      },
      (error) => {
        // First rejection wins. Subsequent rejections in the same microtask
        // batch must not silently overwrite — the consumer throws on the
        // first one and any later ones would be lost. Probes are expected
        // to convert per-region failures into result objects upstream, so
        // landing here at all is exceptional.
        if (!rejection) rejection = { error };
        pending--;
        wake?.();
      },
    );
  }

  while (pending > 0 || queue.length > 0) {
    if (queue.length === 0 && rejection === null) {
      await new Promise<void>((resolve) => {
        wake = resolve;
      });
      wake = null;
    }
    while (queue.length > 0) {
      // biome-ignore lint/style/noNonNullAssertion: length-guarded above
      yield queue.shift()!;
    }
    if (rejection) {
      const { error } = rejection;
      rejection = null;
      throw error;
    }
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
