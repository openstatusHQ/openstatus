import { lookup } from "node:dns/promises";
import { base } from "@openstatus/assertions";
import { monitorMethods, monitorStatus } from "@openstatus/db/src/schema";

import { z } from "zod";

// --- SSRF Protection ---

const BLOCKED_IPV4_RANGES = [
  // Loopback
  { prefix: "127.", mask: null },
  // Link-local
  { prefix: "169.254.", mask: null },
  // Private 10.x.x.x
  { prefix: "10.", mask: null },
  // Private 172.16.0.0 - 172.31.255.255
  {
    prefix: "172.",
    mask: (ip: string) => {
      const second = Number.parseInt(ip.split(".")[1] ?? "", 10);
      return second >= 16 && second <= 31;
    },
  },
  // Private 192.168.x.x
  { prefix: "192.168.", mask: null },
  // Current network
  { prefix: "0.", mask: null },
];

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.internal",
]);

function isBlockedIPv4(ip: string): boolean {
  for (const range of BLOCKED_IPV4_RANGES) {
    if (ip.startsWith(range.prefix)) {
      if (range.mask === null || range.mask(ip)) return true;
    }
  }
  return false;
}

function isBlockedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::1" || normalized === "::") return true;
  // Unique local addresses (fc00::/7)
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  // Link-local (fe80::/10)
  if (normalized.startsWith("fe80")) return true;
  // IPv4-mapped IPv6 addresses (::ffff:x.x.x.x)
  if (normalized.startsWith("::ffff:")) {
    const ipv4Part = normalized.slice(7);
    if (isBlockedIPv4(ipv4Part)) return true;
  }
  return false;
}

function isBlockedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(lower)) return true;

  // Check if hostname is a raw IP address
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(lower)) {
    return isBlockedIPv4(lower);
  }
  if (lower.startsWith("[") && lower.endsWith("]")) {
    return isBlockedIPv6(lower.slice(1, -1));
  }

  return false;
}

/**
 * Validates that a URL is safe to fetch (not targeting internal/private infrastructure).
 * Checks protocol, hostname, and resolved IP address.
 * Throws an error if the URL is not safe.
 */
export async function assertSafeUrl(urlString: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error("Invalid URL");
  }

  // Only allow HTTP(S)
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `URL protocol "${parsed.protocol}" is not allowed. Only http: and https: are permitted.`,
    );
  }

  // Block known dangerous hostnames and raw private IPs
  if (isBlockedHost(parsed.hostname)) {
    throw new Error(
      "URL targets a private or internal address, which is not allowed.",
    );
  }

  // DNS resolution check — catch hostnames that resolve to private IPs
  try {
    const { address, family } = await lookup(parsed.hostname);
    if (family === 4 && isBlockedIPv4(address)) {
      throw new Error(
        "URL resolves to a private IP address, which is not allowed.",
      );
    }
    if (family === 6 && isBlockedIPv6(address)) {
      throw new Error(
        "URL resolves to a private IP address, which is not allowed.",
      );
    }
  } catch (err) {
    // Re-throw our own errors
    if (err instanceof Error && err.message.includes("not allowed")) {
      throw err;
    }
    // DNS lookup failures — let them through (the fetch will fail anyway)
  }
}

/**
 * Synchronous URL safety check for use in Zod schemas.
 * Checks protocol and hostname/IP without DNS resolution.
 */
export function assertSafeUrlSync(urlString: string): void {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error("Invalid URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `URL protocol "${parsed.protocol}" is not allowed. Only http: and https: are permitted.`,
    );
  }

  if (isBlockedHost(parsed.hostname)) {
    throw new Error(
      "URL targets a private or internal address, which is not allowed.",
    );
  }
}

/**
 * Zod schema for URLs that are safe from SSRF.
 * Validates format and blocks private/internal addresses.
 */
export const safeUrlSchema = z
  .string()
  .refine(
    (val) => {
      try {
        new URL(val);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Invalid URL" },
  )
  .refine(
    (val) => {
      try {
        assertSafeUrlSync(val);
        return true;
      } catch {
        return false;
      }
    },
    { message: "URL must not target private or internal addresses" },
  );

export const httpPayloadSchema = z.object({
  workspaceId: z.string(),
  monitorId: z.string(),
  method: z.enum(monitorMethods),
  body: z.string().optional(),
  headers: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
  url: z.string(),
  cronTimestamp: z.number(),
  status: z.enum(monitorStatus),
  assertions: z.array(base).nullable(),
  timeout: z.number().prefault(45000),
  degradedAfter: z.number().nullable(),
  trigger: z.enum(["cron", "api"]).optional().nullable().prefault("cron"),
  otelConfig: z
    .object({
      endpoint: z.string(),
      headers: z.record(z.string(), z.string()),
    })
    .optional(),
  retry: z.number().prefault(3),
  followRedirects: z.boolean().prefault(true),
});

export type HttpPayload = z.infer<typeof httpPayloadSchema>;

export const tpcPayloadSchema = z.object({
  status: z.enum(monitorStatus),
  workspaceId: z.string(),
  uri: z.string(),
  monitorId: z.string(),
  assertions: z.array(base).nullable(),
  cronTimestamp: z.number(),
  timeout: z.number().prefault(45000),
  degradedAfter: z.number().nullable(),
  trigger: z.enum(["cron", "api"]).optional().nullable().prefault("cron"),
  otelConfig: z
    .object({
      endpoint: z.string(),
      headers: z.record(z.string(), z.string()),
    })
    .optional(),
  retry: z.number().prefault(3),
});

export type TcpPayload = z.infer<typeof tpcPayloadSchema>;

export const DNSPayloadSchema = z.object({
  status: z.enum(monitorStatus),
  workspaceId: z.string(),
  uri: z.string(),
  monitorId: z.string(),
  assertions: z.array(base).nullable(),
  cronTimestamp: z.number(),
  timeout: z.number().prefault(45000),
  degradedAfter: z.number().nullable(),
  trigger: z.enum(["cron", "api"]).optional().nullable().prefault("cron"),
  otelConfig: z
    .object({
      endpoint: z.string(),
      headers: z.record(z.string(), z.string()),
    })
    .optional(),
  retry: z.number().prefault(3),
});

export type DNSPayload = z.infer<typeof DNSPayloadSchema>;

export function transformHeaders(headers: { key: string; value: string }[]) {
  return headers.length > 0
    ? headers.reduce(
        (acc, curr) => {
          acc[curr.key] = curr.value;
          return acc;
        },
        {} as Record<string, string>,
      )
    : {};
}
