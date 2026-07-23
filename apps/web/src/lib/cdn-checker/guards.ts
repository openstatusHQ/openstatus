import { assertSafeUrlSync } from "@openstatus/utils";

type UrlGuardResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

export function validateCdnUrl(url: string): UrlGuardResult {
  try {
    // protocol check + private/loopback/metadata-host block
    assertSafeUrlSync(url);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Invalid URL",
      status: 400,
    };
  }

  const urlObject = new URL(url);
  const hostname = urlObject.hostname.toLowerCase();
  if (
    (hostname === "openstatus.dev" || hostname.endsWith(".openstatus.dev")) &&
    urlObject.pathname.startsWith("/play/cdn-checker/api")
  ) {
    return { ok: false, error: "Self-requests are not allowed", status: 400 };
  }

  const blacklistPatterns = (process.env.BLACKLIST_URL ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  for (const pattern of blacklistPatterns) {
    let matches = false;
    try {
      matches = new RegExp(pattern).test(url);
    } catch (error) {
      // skip the bad pattern so it can't silently disable the whole guard
      console.error("Invalid blacklist pattern", pattern, error);
      continue;
    }
    if (matches) {
      return { ok: false, error: "This URL is not allowed", status: 403 };
    }
  }

  return { ok: true };
}
