import type { Page } from "@openstatus/db/src/schema";
import { getValidSubdomain } from "../domain";
import type { Action } from "./types";

interface Input {
  page: Pick<Page, "slug" | "customDomain">;
  host: string | null;
  /** req.nextUrl.host — passed to subdomain detection. */
  urlHost: string;
  pathname: string;
  /** Incoming search string, preserved on the rewrite. */
  search: string;
  isSelfHosted: boolean;
  /** Base URL for constructing rewrite targets on the same origin. */
  requestUrl: string;
}

/**
 * stpg.dev ↔ custom-domain rewrite. Runs only when the request reaches us on a
 * host other than `{slug}.stpg.dev` for a page that has a configured custom
 * domain (and we are not in self-hosted mode).
 *
 * Four branches:
 * 1. subdomain absent, deep path → rewrite to `/{slug}/<rest>` (path-strip).
 * 2. subdomain present, deep path → rewrite to `https://{slug}.stpg.dev/<rest>` (subdomain-subpath).
 * 3. subdomain present, shallow path → rewrite to `https://{slug}.stpg.dev{pathname}` (subdomain-root).
 * 4. Otherwise → rewrite to `/{slug}` (fallback).
 *
 * All branches preserve the incoming search string.
 */
export function resolveCustomDomainRewrite({
  page,
  host,
  urlHost,
  pathname,
  search,
  isSelfHosted,
  requestUrl,
}: Input): Action | null {
  if (isSelfHosted) return null;
  if (!page.customDomain) return null;
  if (host === `${page.slug}.stpg.dev`) return null;

  const pathnames = pathname.split("/");
  const subdomain = getValidSubdomain(urlHost);

  // Branch 1: no subdomain, pathname has >1 segment → strip leading segment.
  if (pathnames.length > 2 && !subdomain) {
    const rest = pathnames.slice(2).join("/");
    // Trailing-slash only (e.g. "/status.acme.com/") yields empty `rest` —
    // emit `/{slug}` without a trailing slash to match Branch 4's semantics
    // and avoid a redundant 308 from Next.js trailing-slash handling.
    const path = rest ? `/${page.slug}/${rest}` : `/${page.slug}`;
    const url = new URL(path, requestUrl);
    url.search = search;
    return {
      type: "rewrite",
      url,
      reason: "custom-domain-rewrite-path-strip",
    };
  }

  // Branch 2 & 3: subdomain present — rewrite to the stpg.dev host.
  if (subdomain) {
    if (pathnames.length > 2) {
      const rest = pathnames.slice(1).join("/");
      const url = new URL(rest, `https://${page.slug}.stpg.dev`);
      url.search = search;
      return {
        type: "rewrite",
        url,
        reason: "custom-domain-rewrite-subdomain-subpath",
      };
    }
    const url = new URL(pathname, `https://${page.slug}.stpg.dev`);
    url.search = search;
    return {
      type: "rewrite",
      url,
      reason: "custom-domain-rewrite-subdomain-root",
    };
  }

  // Branch 4: fallback — rewrite to the bare slug.
  const url = new URL(`/${page.slug}`, requestUrl);
  url.search = search;
  return {
    type: "rewrite",
    url,
    reason: "custom-domain-rewrite-fallback",
  };
}
