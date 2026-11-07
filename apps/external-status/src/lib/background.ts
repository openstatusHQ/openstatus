const inFlight = new Set<Promise<unknown>>();

// Cron handlers answer 200 before their tick settles; SIGTERM waits on these.
export function runInBackground(task: Promise<unknown>): void {
  const tracked = task.finally(() => inFlight.delete(tracked));
  inFlight.add(tracked);
  // The caller owns error handling; this copy must not become an unhandled rejection.
  tracked.catch(() => {});
}

export async function drainBackground(graceMs: number): Promise<void> {
  if (inFlight.size === 0) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const grace = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, graceMs);
  });
  await Promise.race([Promise.allSettled(inFlight), grace]);
  clearTimeout(timer);
}
