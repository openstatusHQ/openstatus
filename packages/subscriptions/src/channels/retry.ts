import { Effect, Schedule } from "effect";

export class WebhookSendError extends Error {
  readonly httpStatus?: number;

  constructor(
    message: string,
    opts?: { httpStatus?: number; cause?: unknown },
  ) {
    super(message, { cause: opts?.cause });
    this.name = "WebhookSendError";
    this.httpStatus = opts?.httpStatus;
  }
}

// Network errors and timeouts (no status) are transient; 5xx and 429 may clear.
// Other 4xx are client errors that won't succeed on retry.
const isRetryable = (err: WebhookSendError): boolean =>
  err.httpStatus === undefined ||
  err.httpStatus >= 500 ||
  err.httpStatus === 429;

const retryPolicy = {
  schedule: Schedule.exponential("200 millis").pipe(Schedule.jittered),
  times: 3,
  while: isRetryable,
};

/**
 * POST to a webhook with exponential-backoff retries on transient failures.
 * Rejects with `WebhookSendError` once retries are exhausted.
 */
export function postWebhookWithRetry(opts: {
  url: string;
  headers: Record<string, string>;
  body: string;
  timeoutMs: number;
}): Promise<void> {
  const send = Effect.tryPromise({
    try: (signal) =>
      fetch(opts.url, {
        method: "POST",
        headers: opts.headers,
        body: opts.body,
        signal,
      }),
    catch: (cause) => new WebhookSendError("Webhook request failed", { cause }),
  }).pipe(
    Effect.timeoutFail({
      duration: `${opts.timeoutMs} millis`,
      onTimeout: () =>
        new WebhookSendError(`Webhook timed out after ${opts.timeoutMs}ms`),
    }),
    Effect.flatMap((response) =>
      response.ok
        ? Effect.void
        : Effect.fail(
            new WebhookSendError(`Webhook returned ${response.status}`, {
              httpStatus: response.status,
            }),
          ),
    ),
    Effect.retry(retryPolicy),
  );

  return Effect.runPromise(send);
}
