import { directory } from "./data/directory";
import type { StatusPageEntry } from "./types";

export function getStatusDirectory(): StatusPageEntry[] {
  return directory;
}

export * from "./types";
export * from "./utils";
export {
  fetchWithTimeout,
  fetchWithRetry,
  fetchWithDeduplication,
  FetchError,
  type FetchWithTimeoutOptions,
  type RetryOptions,
} from "./fetch-utils";
export type { DirectoryEntry } from "./data/index";
