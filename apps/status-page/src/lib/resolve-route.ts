import { defaultLocale, locales } from "@/i18n/config";
import { getValidSubdomain } from "./domain";

export type RouteType = "hostname" | "pathname";

export interface ResolvedRoute {
  type: RouteType;
  prefix: string;
  locale: string;
  /** The internal path to rewrite to: /{prefix}/{locale}/{rest} */
  rewritePath: string;
}

/**
 * Resolves the routing type, page slug, and locale from request context.
 * Pure function — no side effects, no DB calls, no Next.js APIs.
 */
export function resolveRoute({
  host,
  urlHost,
  pathname,
}: {
  /** x-forwarded-host header value */
  host: string | null;
  /** req.nextUrl.host */
  urlHost: string;
  /** req.nextUrl.pathname */
  pathname: string;
}): ResolvedRoute | null {
  const hostnames = host?.split(/[.:]/) ?? urlHost.split(/[.:]/);
  const pathnames = pathname.split("/");

  // Prefer x-forwarded-host for custom-domain detection (behind reverse proxy/CDN,
  // req.nextUrl.host may be an internal host, not the real custom domain)
  const subdomain = getValidSubdomain(host ?? urlHost);

  let prefix: string;
  let type: RouteType;

  if (
    hostnames.length > 2 &&
    hostnames[0] !== "www" &&
    !urlHost.endsWith(".vercel.app")
  ) {
    prefix = hostnames[0].toLowerCase();
    type = "hostname";
  } else {
    prefix = (pathnames[1] ?? "").toLowerCase();
    type = "pathname";
  }

  if (subdomain !== null) {
    prefix = subdomain.toLowerCase();
  }

  // Root path on non-hostname type — no page to resolve
  if (pathname === "/" && type !== "hostname" && subdomain === null) {
    return null;
  }

  // Resolve locale based on routing type
  if (type === "hostname") {
    const firstSegment = pathnames[1]?.toLowerCase();
    const hasLocale = (locales as readonly string[]).includes(
      firstSegment as (typeof locales)[number],
    );
    const locale = hasLocale ? firstSegment : defaultLocale;
    const rest = (hasLocale ? pathnames.slice(2) : pathnames.slice(1))
      .filter(Boolean)
      .join("/");

    return {
      type,
      prefix,
      locale,
      rewritePath: `/${prefix}/${locale}${rest ? `/${rest}` : ""}`,
    };
  }

  // pathname type: locale is at index 2 (/{slug}/{locale}/...)
  const localeSegment = pathnames[2]?.toLowerCase();
  const hasLocale = (locales as readonly string[]).includes(
    localeSegment as (typeof locales)[number],
  );
  const locale = hasLocale ? localeSegment : defaultLocale;

  if (hasLocale) {
    // Already has locale in path — rewrite path is the pathname as-is
    return {
      type,
      prefix,
      locale,
      rewritePath: pathname,
    };
  }

  // No locale in path — insert default locale after slug
  const rest = pathnames.slice(2).filter(Boolean).join("/");
  return {
    type,
    prefix,
    locale,
    rewritePath: `/${prefix}/${locale}${rest ? `/${rest}` : ""}`,
  };
}
