// Custom-domain lookups exact-match page.customDomain, which is stored without a
// port; an inbound host like "status.acme.com:8080" must be normalized first.
export const stripHostPort = (host?: string | null) =>
  host ? host.replace(/:\d+$/, "") : (host ?? null);

/**
 * Returns true when the instance is running in self-hosted mode.
 */
export function isSelfHosted(): boolean {
  return process.env.SELF_HOST === "true";
}

/**
 * Returns true when the host matches the expected SaaS subdomain pattern
 * ({slug}.stpg.dev) and the instance is NOT in self-hosted mode.
 */
export function isSaasSubdomain(host: string | null, slug: string): boolean {
  if (isSelfHosted()) return false;
  if (!host) return false;
  return host === `${slug}.stpg.dev`;
}

export const getValidSubdomain = (host?: string | null) => {
  let subdomain: string | null = null;
  if (!host && typeof window !== "undefined") {
    // On client side, get the host from window
    host = window.location.host;
  }

  // Exclude localhost and IP addresses from being treated as subdomains
  if (host?.match(/^(localhost|127\.0\.0\.1|::1|\d+\.\d+\.\d+\.\d+)/)) {
    return null;
  }

  // Handle subdomains of localhost (e.g., hello.localhost:3000)
  if (host?.match(/^([^.]+)\.localhost(:\d+)?$/)) {
    const match = host.match(/^([^.]+)\.localhost(:\d+)?$/);
    return match?.[1] || null;
  }

  // we should improve here for custom vercel deploy page
  if (host?.includes(".") && !host.includes(".vercel.app")) {
    const candidate = host.split(".")[0];
    if (candidate && !candidate.includes("www")) {
      // Valid candidate
      subdomain = candidate;
    }
  }

  // In case the host is a custom domain
  if (
    host &&
    !(
      host?.includes("stpg.dev") ||
      host?.includes("openstatus.dev") ||
      host?.endsWith(".vercel.app")
    )
  ) {
    subdomain = host;
  }
  return subdomain;
};
