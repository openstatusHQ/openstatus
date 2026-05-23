import { mock } from "bun:test";
import { Cause, Effect, Exit, Option } from "effect";
import type { FetchError } from "../src/fetch";
import type {
  StatusFetcher,
  StatusPageEntry,
  StatusResult,
} from "../src/types";

type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

export const installMockFetch = (impl: FetchImpl) => {
  const fn = mock(impl);
  global.fetch = fn as unknown as typeof fetch;
  return fn;
};

export const runFetcher = (
  fetcher: StatusFetcher,
  entry: StatusPageEntry,
): Promise<StatusResult> => Effect.runPromise(fetcher.fetch(entry));

export const runFetcherExit = (
  fetcher: StatusFetcher,
  entry: StatusPageEntry,
) => Effect.runPromiseExit(fetcher.fetch(entry));

export const expectFetchError = (
  exit: Exit.Exit<StatusResult, FetchError>,
): FetchError => {
  if (!Exit.isFailure(exit)) {
    throw new Error("expected Exit.Failure, got Success");
  }
  const failure = Cause.failureOption(exit.cause);
  if (Option.isNone(failure)) {
    throw new Error("expected Cause.Fail, got defect");
  }
  return failure.value;
};
