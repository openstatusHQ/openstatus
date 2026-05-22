import { type Duration, Effect, Schedule } from "effect";
import type { z } from "zod";

type FetchErrorInit = {
  url: string;
  fetcherName?: string;
  entryId?: string;
  httpStatus?: number;
  cause?: Error;
};

export class FetchError extends Error {
  readonly url: string;
  readonly fetcherName?: string;
  readonly entryId?: string;
  readonly httpStatus?: number;

  constructor(init: FetchErrorInit) {
    const ctx =
      [init.fetcherName, init.entryId && `(${init.entryId})`]
        .filter(Boolean)
        .join(" ") || "FetchError";
    const status = init.httpStatus ? `HTTP ${init.httpStatus}` : "fetch failed";
    super(`[${ctx}] ${status}: ${init.url}`, { cause: init.cause });
    this.name = "FetchError";
    this.url = init.url;
    this.fetcherName = init.fetcherName;
    this.entryId = init.entryId;
    this.httpStatus = init.httpStatus;
  }
}

const DEFAULT_TIMEOUT: Duration.DurationInput = "30000 millis";

export type FetchBaseOptions = {
  url: string;
  init?: Omit<RequestInit, "signal" | "headers"> & {
    headers?: Record<string, string>;
  };
  timeout?: Duration.DurationInput;
  fetcherName?: string;
  entryId?: string;
};

const isRetryable = (err: FetchError): boolean =>
  !(
    err.httpStatus !== undefined &&
    err.httpStatus >= 400 &&
    err.httpStatus < 500
  );

const retryPolicy = {
  schedule: Schedule.exponential("100 millis").pipe(Schedule.jittered),
  times: 3,
  while: isRetryable,
};

const buildFetchError = (
  opts: FetchBaseOptions,
  extras: { httpStatus?: number; cause?: Error },
): FetchError =>
  new FetchError({
    url: opts.url,
    fetcherName: opts.fetcherName,
    entryId: opts.entryId,
    ...extras,
  });

const failWith =
  (opts: FetchBaseOptions) =>
  (cause: unknown): FetchError =>
    buildFetchError(opts, {
      cause: cause instanceof Error ? cause : new Error(String(cause)),
    });

const doFetch = (
  opts: FetchBaseOptions,
  defaultHeaders: Record<string, string>,
): Effect.Effect<Response, FetchError> =>
  Effect.tryPromise({
    try: (signal) =>
      fetch(opts.url, {
        ...opts.init,
        headers: { ...defaultHeaders, ...opts.init?.headers },
        signal,
      }),
    catch: failWith(opts),
  }).pipe(
    Effect.timeoutFail({
      duration: opts.timeout ?? DEFAULT_TIMEOUT,
      onTimeout: () =>
        buildFetchError(opts, {
          cause: new Error(
            `timeout after ${String(opts.timeout ?? DEFAULT_TIMEOUT)}`,
          ),
        }),
    }),
    Effect.flatMap((response) =>
      response.ok
        ? Effect.succeed(response)
        : Effect.fail(buildFetchError(opts, { httpStatus: response.status })),
    ),
  );

const fetchBody = <T>(
  opts: FetchBaseOptions,
  defaultHeaders: Record<string, string>,
  read: (response: Response) => Effect.Effect<T, FetchError>,
): Effect.Effect<T, FetchError> =>
  doFetch(opts, defaultHeaders).pipe(
    Effect.flatMap(read),
    Effect.retry(retryPolicy),
  );

const JSON_HEADERS = {
  "User-Agent": "OpenStatus-Directory/1.0",
  Accept: "application/json",
};

// browser-like UA: some status pages reject non-browser User-Agents
const TEXT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; OpenStatus-Bot/1.0)",
};

export const fetchJson = <T>(
  opts: FetchBaseOptions & { schema: z.ZodType<T> },
): Effect.Effect<T, FetchError> =>
  fetchBody(opts, JSON_HEADERS, (response) =>
    Effect.tryPromise({
      try: () => response.json(),
      catch: failWith(opts),
    }).pipe(
      Effect.flatMap((json) =>
        Effect.try({ try: () => opts.schema.parse(json), catch: failWith(opts) }),
      ),
    ),
  );

export const fetchText = (
  opts: FetchBaseOptions,
): Effect.Effect<string, FetchError> =>
  fetchBody(opts, TEXT_HEADERS, (response) =>
    Effect.tryPromise({ try: () => response.text(), catch: failWith(opts) }),
  );
