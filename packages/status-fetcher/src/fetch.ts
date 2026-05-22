import { Duration, Effect, Schedule } from "effect";
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
  init?: Omit<RequestInit, "signal">;
  timeout?: Duration.DurationInput;
  fetcherName?: string;
  entryId?: string;
};

const toError = (cause: unknown): Error =>
  cause instanceof Error ? cause : new Error(String(cause));

type HeadersOverride = NonNullable<RequestInit["headers"]>;

const mergeHeaders = (
  defaults: Record<string, string>,
  override: HeadersOverride | undefined,
): Record<string, string> => {
  const merged: Record<string, string> = { ...defaults };
  if (!override) return merged;
  if (override instanceof Headers) {
    override.forEach((value: string, key: string) => {
      merged[key] = value;
    });
    return merged;
  }
  if (Array.isArray(override)) {
    for (const [key, value] of override) {
      merged[key] = value;
    }
    return merged;
  }
  Object.assign(merged, override);
  return merged;
};

const isRetryable = (err: FetchError): boolean =>
  !(
    err.httpStatus !== undefined &&
    err.httpStatus >= 400 &&
    err.httpStatus < 500
  );

const retrySchedule = Schedule.exponential("100 millis").pipe(Schedule.jittered);

const buildFetchError = (
  opts: FetchBaseOptions,
  extras: { httpStatus?: number; cause?: Error },
): FetchError =>
  new FetchError({
    url: opts.url,
    fetcherName: opts.fetcherName,
    entryId: opts.entryId,
    httpStatus: extras.httpStatus,
    cause: extras.cause,
  });

const doFetch = (
  opts: FetchBaseOptions,
  defaultHeaders: Record<string, string>,
): Effect.Effect<Response, FetchError> =>
  Effect.tryPromise({
    try: (signal) =>
      fetch(opts.url, {
        ...opts.init,
        headers: mergeHeaders(defaultHeaders, opts.init?.headers),
        signal,
      }),
    catch: (cause) => buildFetchError(opts, { cause: toError(cause) }),
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

export const fetchJson = <T>(
  opts: FetchBaseOptions & { schema: z.ZodType<T> },
): Effect.Effect<T, FetchError> =>
  doFetch(opts, {
    "User-Agent": "OpenStatus-Directory/1.0",
    Accept: "application/json",
  }).pipe(
    Effect.flatMap((response) =>
      Effect.tryPromise({
        try: () => response.json(),
        catch: (cause) => buildFetchError(opts, { cause: toError(cause) }),
      }),
    ),
    Effect.flatMap((json) =>
      Effect.try({
        try: () => opts.schema.parse(json),
        catch: (cause) => buildFetchError(opts, { cause: toError(cause) }),
      }),
    ),
    Effect.retry({ schedule: retrySchedule, times: 3, while: isRetryable }),
  );

export const fetchText = (
  opts: FetchBaseOptions,
): Effect.Effect<string, FetchError> =>
  doFetch(opts, {
    "User-Agent": "Mozilla/5.0 (compatible; OpenStatus-Bot/1.0)",
  }).pipe(
    Effect.flatMap((response) =>
      Effect.tryPromise({
        try: () => response.text(),
        catch: (cause) => buildFetchError(opts, { cause: toError(cause) }),
      }),
    ),
    Effect.retry({ schedule: retrySchedule, times: 3, while: isRetryable }),
  );
