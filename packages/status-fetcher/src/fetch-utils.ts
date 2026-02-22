/**
 * Fetch utilities with timeout and retry logic
 *
 * @module fetch-utils
 * @description Provides robust HTTP fetching with timeout and automatic retry capabilities
 */

/**
 * Options for fetch operations with timeout support
 * Extends standard RequestInit but excludes 'signal' since we manage it internally
 */
export type FetchWithTimeoutOptions = Omit<RequestInit, "signal"> & {
  /** Timeout in milliseconds (default: 30000ms / 30s) */
  timeout?: number;
};

/**
 * Options for retry behavior
 */
export type RetryOptions = {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay between retries in milliseconds (default: 100ms) */
  initialDelay?: number;
  /** Maximum delay cap in milliseconds (default: 5000ms) */
  maxDelay?: number;
  /**
   * Custom function to determine if a request should be retried
   * @param error - The error that occurred
   * @param attempt - The current attempt number (0-indexed)
   * @returns true to retry, false to stop
   */
  shouldRetry?: (error: Error, attempt: number) => boolean;
};

/**
 * Fetch with timeout support using AbortController
 *
 * @param url - The URL to fetch
 * @param options - Fetch options including timeout
 * @returns Promise resolving to the Response
 * @throws {Error} If request times out or fetch fails
 *
 * @example
 * ```typescript
 * const response = await fetchWithTimeout('https://api.example.com', {
 *   timeout: 5000,
 *   headers: { 'Authorization': 'Bearer token' }
 * });
 * ```
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {},
): Promise<Response> {
  const { timeout = 30000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timeout after ${timeout}ms: ${url}`);
    }
    throw error;
  }
}

/**
 * Fetch with automatic retry on transient failures
 *
 * Features:
 * - Exponential backoff with jitter (±25%) to prevent thundering herd
 * - Smart retry: only retries on network errors and 5xx server errors
 * - No retry on 4xx client errors
 * - Respects maxDelay cap to prevent excessively long waits
 *
 * @param url - The URL to fetch
 * @param options - Combined fetch and retry options
 * @returns Promise resolving to the Response
 * @throws {Error} If all retry attempts fail
 *
 * @example
 * ```typescript
 * // Basic usage with defaults (3 retries, 30s timeout)
 * const response = await fetchWithRetry('https://api.example.com');
 *
 * // Custom retry configuration
 * const response = await fetchWithRetry('https://api.example.com', {
 *   maxRetries: 5,
 *   initialDelay: 200,
 *   timeout: 10000,
 *   shouldRetry: (error, attempt) => {
 *     // Custom retry logic
 *     return attempt < 3 && error.message.includes('ECONNRESET');
 *   }
 * });
 * ```
 */
export async function fetchWithRetry(
  url: string,
  options: FetchWithTimeoutOptions & RetryOptions = {},
): Promise<Response> {
  const {
    maxRetries = 3,
    initialDelay = 100,
    maxDelay = 5000,
    shouldRetry = defaultShouldRetry,
    ...fetchOptions
  } = options;

  let lastError: Error | undefined;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, fetchOptions);

      // Don't retry on successful responses or 4xx client errors
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }

      // 5xx server errors - retry
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    // Check if we should retry
    if (attempt < maxRetries && shouldRetry(lastError, attempt)) {
      // Add jitter (±25%) to prevent thundering herd
      const jitter = delay * 0.25 * (Math.random() * 2 - 1);
      await sleep(delay + jitter);
      delay = Math.min(delay * 2, maxDelay); // Exponential backoff with cap
    } else {
      break;
    }
  }

  throw lastError || new Error("Unknown error during fetch with retry");
}

/**
 * Default retry logic: retry on network errors and 5xx responses
 *
 * Retry conditions:
 * - Network errors (fetch failed, network issues)
 * - 5xx server errors (503 Service Unavailable, 500 Internal Server Error, etc.)
 * - Timeout errors only on first attempt
 *
 * Does NOT retry:
 * - 4xx client errors (400 Bad Request, 404 Not Found, etc.)
 * - Timeout errors after first attempt (likely not transient)
 *
 * @param error - The error that occurred
 * @param attempt - The current attempt number (0-indexed)
 * @returns true if request should be retried
 */
function defaultShouldRetry(error: Error, attempt: number): boolean {
  // Don't retry on timeout errors after first attempt
  if (error.message.includes("timeout") && attempt > 0) {
    return false;
  }

  // Retry on network errors
  if (
    error.message.includes("fetch failed") ||
    error.message.includes("network")
  ) {
    return true;
  }

  // Retry on 5xx errors
  if (error.message.match(/HTTP 5\d{2}/)) {
    return true;
  }

  return false;
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * In-flight request cache for deduplication
 * Prevents multiple concurrent requests to the same URL
 */
const inflightRequests = new Map<string, Promise<Response>>();

/**
 * Fetch with request deduplication
 *
 * If multiple requests to the same URL are made concurrently, only one actual
 * fetch is performed and all callers receive the same promise. This prevents
 * thundering herd to the same endpoint.
 *
 * @param url - The URL to fetch
 * @param options - Fetch options with timeout and retry
 * @returns Promise resolving to the Response
 *
 * @example
 * ```typescript
 * // These three concurrent calls will result in only ONE actual fetch
 * const [r1, r2, r3] = await Promise.all([
 *   fetchWithDeduplication('https://api.example.com'),
 *   fetchWithDeduplication('https://api.example.com'),
 *   fetchWithDeduplication('https://api.example.com'),
 * ]);
 * ```
 */
export async function fetchWithDeduplication(
  url: string,
  options: FetchWithTimeoutOptions & RetryOptions = {},
): Promise<Response> {
  // Create cache key from URL and relevant options
  const cacheKey = `${url}:${JSON.stringify({
    method: options.method || "GET",
    headers: options.headers,
  })}`;

  // Check if request is already in flight
  const existing = inflightRequests.get(cacheKey);
  if (existing) {
    return existing;
  }

  // Start new request and cache the promise
  const promise = fetchWithRetry(url, options).finally(() => {
    // Clean up when request completes
    inflightRequests.delete(cacheKey);
  });

  inflightRequests.set(cacheKey, promise);
  return promise;
}

/**
 * Custom error class for fetch operations with rich context
 *
 * Provides detailed information about fetch failures including:
 * - The URL that was being fetched
 * - Which fetcher was making the request
 * - Which directory entry was being processed
 * - The underlying cause (via standard Error.cause)
 *
 * @example
 * ```typescript
 * try {
 *   await fetcher.fetch(entry);
 * } catch (error) {
 *   if (error instanceof FetchError) {
 *     console.error({
 *       message: error.message,     // "HTTP 503: Service Unavailable"
 *       url: error.url,             // "https://api.github.com/status"
 *       fetcher: error.fetcherName, // "atlassian"
 *       entry: error.entryId,       // "github"
 *       cause: error.cause          // Original error
 *     });
 *   }
 * }
 * ```
 */
export class FetchError extends Error {
  /**
   * Creates a new FetchError
   *
   * @param message - Human-readable error message
   * @param url - The URL that failed
   * @param fetcherName - Name of the fetcher (e.g., "atlassian", "instatus")
   * @param entryId - Directory entry ID (e.g., "github", "slack")
   * @param cause - Original error that caused this failure
   */
  constructor(
    message: string,
    public readonly url: string,
    public readonly fetcherName?: string,
    public readonly entryId?: string,
    cause?: Error,
  ) {
    super(message, { cause }); // Use standard Error.cause
    this.name = "FetchError";
  }

  /**
   * Formats error with full context for logging
   * @returns Formatted error string
   */
  toString(): string {
    let msg = `[${this.name}]`;
    if (this.fetcherName) msg += ` ${this.fetcherName}`;
    if (this.entryId) msg += ` (${this.entryId})`;
    msg += `: ${this.message}`;
    if (this.cause) msg += ` - Caused by: ${(this.cause as Error).message}`;
    return msg;
  }
}
