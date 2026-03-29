import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const BLOCKED_IP_RANGES = [
  // IPv4 private ranges
  { prefix: "10.", mask: null },
  { prefix: "127.", mask: null },
  { prefix: "0.", mask: null },
  // 172.16.0.0/12
  { prefix: "172.", mask: (ip: string) => {
    const second = Number.parseInt(ip.split(".")[1], 10);
    return second >= 16 && second <= 31;
  }},
  { prefix: "192.168.", mask: null },
  // Link-local
  { prefix: "169.254.", mask: null },
  // IPv6
  { prefix: "::1", mask: null },
  { prefix: "::ffff:127.", mask: null },
  { prefix: "::ffff:10.", mask: null },
  { prefix: "::ffff:192.168.", mask: null },
  { prefix: "::ffff:169.254.", mask: null },
  { prefix: "fc", mask: null }, // Unique local
  { prefix: "fd", mask: null }, // Unique local
  { prefix: "fe80", mask: null }, // Link-local
];

function isPrivateIP(ip: string): boolean {
  const normalized = ip.toLowerCase();

  for (const range of BLOCKED_IP_RANGES) {
    if (normalized.startsWith(range.prefix)) {
      if (range.mask === null) return true;
      if (range.mask(normalized)) return true;
    }
  }

  // Also check ::ffff:172.16-31.x.x
  if (normalized.startsWith("::ffff:172.")) {
    const ipv4Part = normalized.slice("::ffff:".length);
    const second = Number.parseInt(ipv4Part.split(".")[1], 10);
    if (second >= 16 && second <= 31) return true;
  }

  return false;
}

/**
 * Validates a URL is safe for server-side requests (not targeting internal infrastructure).
 * Throws if the URL targets a private/internal IP address.
 */
export async function validateUrl(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }

  // Only allow http and https
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Blocked protocol: ${parsed.protocol}`);
  }

  // Strip brackets from IPv6 addresses
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");

  // Check if hostname is a raw IP
  if (isIP(hostname)) {
    if (isPrivateIP(hostname)) {
      throw new Error("URL targets a private/internal IP address");
    }
    return;
  }

  // Resolve DNS to check the actual IP
  try {
    const { address } = await lookup(hostname);
    if (isPrivateIP(address)) {
      throw new Error("URL resolves to a private/internal IP address");
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("private/internal")) {
      throw err;
    }
    throw new Error(`DNS resolution failed for ${hostname}`);
  }
}

/**
 * A fetch wrapper that blocks requests to private/internal IP addresses.
 * Use this for all user-supplied URLs to prevent SSRF attacks.
 */
export async function safeFetch(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  await validateUrl(url);
  return fetch(url, init);
}
