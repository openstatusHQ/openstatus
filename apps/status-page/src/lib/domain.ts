import type { NextRequest } from "next/server";

export const getValidSubdomain = (host?: string | null) => {
  let subdomain: string | null = null;
  if (!host && typeof window !== "undefined") {
    // On client side, get the host from window
    // biome-ignore lint: to fix later
    host = window.location.host;
  }

  // Exclude localhost and IP addresses from being treated as subdomains
  if (
    host?.match(/^(localhost|127\\.0\\.0\\.1|::1|\\d+\\.\\d+\\.\\d+\\.\\d+)/)
  ) {
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

export const getValidCustomDomain = (req: NextRequest | Request) => {
  const url = "nextUrl" in req ? req.nextUrl.clone() : new URL(req.url);
  const headers = req.headers;
  const host = headers.get("x-forwarded-host");

  let prefix = "";
  let type: "hostname" | "pathname";

  const hostnames = host?.split(/[.:]/) ?? url.host.split(/[.:]/);
  const pathnames = url.pathname.split("/");

  const subdomain = getValidSubdomain(url.host);
  console.log({
    hostnames,
    pathnames,
    host,
    urlHost: url.host,
    subdomain,
  });

  if (
    hostnames.length > 2 &&
    hostnames[0] !== "www" &&
    !url.host.endsWith(".vercel.app")
  ) {
    prefix = hostnames[0].toLowerCase();
    type = "hostname";
  } else {
    prefix = pathnames[1].toLowerCase();
    type = "pathname";
  }

  if (subdomain !== null) {
    prefix = subdomain.toLowerCase();
  }

  console.log({ type, prefix });

  return { type, prefix };
};
