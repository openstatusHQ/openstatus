const RETRYABLE_CODES = new Set(["SQLITE_BUSY", "SQLITE_LOCKED"]);
const RETRYABLE_MESSAGE = /database is (locked|busy)/i;
const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 25;
const MAX_DELAY_MS = 400;
const MAX_CAUSE_DEPTH = 10;

function hasCode(value: object): value is { code: unknown } {
  return "code" in value;
}

function hasMessage(value: object): value is { message: unknown } {
  return "message" in value;
}

function hasCause(value: object): value is { cause: unknown } {
  return "cause" in value;
}

export function isRetryableDbError(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth++) {
    if (typeof current !== "object" || current === null) return false;

    if (hasCode(current) && typeof current.code === "string") {
      if (RETRYABLE_CODES.has(current.code)) return true;
    }
    if (hasMessage(current) && typeof current.message === "string") {
      if (RETRYABLE_MESSAGE.test(current.message)) return true;
    }
    if (!hasCause(current) || current.cause === current) return false;
    current = current.cause;
  }
  return false;
}

function backoffDelayMs(attempt: number): number {
  const cap = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt);
  return Math.random() * cap;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function withBusyRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS - 1 || !isRetryableDbError(err)) throw err;
      await sleep(backoffDelayMs(attempt));
    }
  }
}
