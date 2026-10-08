import type { Context, MiddlewareHandler } from "hono";
import { type RateLimitInfo, rateLimiter } from "hono-rate-limiter";

import { extractCredential } from "./credentials";
import { limits } from "./limits";
import { shedResponse, wideEvent } from "./shed";

const EXEMPT_PREFIXES = ["/openapi", "/.well-known/"];
const EXEMPT_PATHS = new Set(["/ping"]);
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isExempt(path: string): boolean {
  return (
    EXEMPT_PATHS.has(path) || EXEMPT_PREFIXES.some((p) => path.startsWith(p))
  );
}

function isPublic(path: string): boolean {
  return path === "/public" || path.startsWith("/public/");
}

const RPC_READ = /\/(Get|List|Check)[A-Za-z]*$/;

/**
 * Connect sends reads over POST, so `/rpc` is classified by method name;
 * `/mcp` is JSON-RPC and stays unclassified. `/oauth` POSTs register
 * clients and mint tokens, mostly unauthenticated, so they are writes too.
 */
function isWrite(c: Context): boolean {
  const path = c.req.path;
  if (path.startsWith("/v1/") || path.startsWith("/oauth/")) {
    return WRITE_METHODS.has(c.req.method);
  }
  if (path.startsWith("/rpc/")) {
    return c.req.method === "POST" && !RPC_READ.test(path);
  }
  return false;
}

/** Raw credentials must never sit in the store or in logs. */
async function fingerprint(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  )
    .join("")
    .slice(0, 16);
}

/**
 * Fly sets `fly-client-ip` itself. Without it, only the last
 * `x-forwarded-for` entry was appended by a proxy we trust; the client
 * controls everything before it.
 */
function clientIp(c: Context): string {
  const fly = c.req.header("fly-client-ip");
  if (fly) return fly;
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) return forwarded.split(",").at(-1)?.trim() || "unknown";
  return "unknown";
}

export async function credentialKey(c: Context): Promise<string> {
  const credential = extractCredential({ get: (n) => c.req.header(n) });
  if (credential) return `key:${await fingerprint(credential.token)}`;
  return `ip:${clientIp(c)}`;
}

function ipKey(c: Context): string {
  return `ip:${clientIp(c)}`;
}

function hasCredential(c: Context): boolean {
  return extractCredential({ get: (n) => c.req.header(n) }) !== null;
}

type RateLimitVariables = { Variables: { rateLimit: RateLimitInfo } };

function limiter(opts: {
  windowMs: number;
  limit: () => number;
  keyGenerator: (c: Context) => string | Promise<string>;
  skip: (c: Context) => boolean;
  /** Count only responses with this status; everything else is refunded. */
  countStatus?: number;
}): MiddlewareHandler {
  return rateLimiter<RateLimitVariables>({
    windowMs: opts.windowMs,
    limit: () => opts.limit(),
    keyGenerator: opts.keyGenerator,
    skip: opts.skip,
    skipSuccessfulRequests: opts.countStatus !== undefined,
    requestWasSuccessful: (c) => c.res.status !== opts.countStatus,
    standardHeaders: false,
    handler: (c) => {
      const event = wideEvent(c);
      if (event) event.rate_limited = true;
      const reset = c.get("rateLimit")?.resetTime?.getTime();
      const retryAfterSeconds = reset
        ? Math.ceil((reset - Date.now()) / 1000)
        : Math.ceil(opts.windowMs / 1000);
      return shedResponse(c, {
        code: "TOO_MANY_REQUESTS",
        status: 429,
        message: "Rate limit exceeded, retry later",
        retryAfterSeconds,
      });
    },
  });
}

export type RateLimitConfig = {
  perMinute: number;
  burstPer10s: number;
  writesPerMinute: number;
  publicPerMinute: number;
};

/**
 * Stores are per machine on purpose: the goal is to protect each machine,
 * not to meter usage globally. Windows are fixed, not sliding; the 10 s
 * bucket is what stops a burst before a fixed minute window fills.
 * Limits are read per request so the shared `limits` object stays live.
 *
 * Credential buckets exist before authentication, so rotating made-up keys
 * would dodge them; `authFailures` caps 401s per client IP instead. Only
 * failures count, so tenants behind one egress IP never pay for each other.
 */
export function createRateLimit(config: RateLimitConfig): MiddlewareHandler[] {
  const skipKeyed = (c: Context) =>
    isExempt(c.req.path) || isPublic(c.req.path);

  const authFailures = limiter({
    windowMs: 60_000,
    limit: () => config.perMinute,
    keyGenerator: ipKey,
    skip: (c) => skipKeyed(c) || !hasCredential(c),
    countStatus: 401,
  });
  const burst = limiter({
    windowMs: 10_000,
    limit: () => config.burstPer10s,
    keyGenerator: credentialKey,
    skip: skipKeyed,
  });
  const minute = limiter({
    windowMs: 60_000,
    limit: () => config.perMinute,
    keyGenerator: credentialKey,
    skip: skipKeyed,
  });
  const writes = limiter({
    windowMs: 60_000,
    limit: () => config.writesPerMinute,
    keyGenerator: credentialKey,
    skip: (c) => skipKeyed(c) || !isWrite(c),
  });
  const publicLimiter = limiter({
    windowMs: 60_000,
    limit: () => config.publicPerMinute,
    keyGenerator: ipKey,
    skip: (c) => !isPublic(c.req.path),
  });

  return [authFailures, burst, minute, writes, publicLimiter];
}

export const rateLimit = createRateLimit(limits);
