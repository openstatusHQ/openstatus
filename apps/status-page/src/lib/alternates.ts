import type { Metadata } from "next";

import { getStatusPageBaseDomain } from "./base-domain";

function host({
  slug,
  customDomain,
  baseDomain,
}: {
  slug: string;
  customDomain?: string | null;
  baseDomain: string;
}) {
  return customDomain
    ? `https://${customDomain}`
    : `https://${slug}.${baseDomain}`;
}

// Next.js merges `alternates` shallowly, so a deeper segment that sets it
// replaces the parent's entirely — always return the full object.
export function statusPageAlternates({
  slug,
  customDomain,
  markdownPath = "/.md",
  baseDomain = getStatusPageBaseDomain(),
}: {
  slug: string;
  customDomain?: string | null;
  markdownPath?: string;
  /** Defaults to `STATUS_PAGE_BASE_DOMAIN` (openstatus.dev when unset). */
  baseDomain?: string;
}): Metadata["alternates"] {
  const base = host({ slug, customDomain, baseDomain });
  return {
    canonical: base,
    types: {
      "text/markdown": `${base}${markdownPath}`,
      "application/json": `${base}/api/status/summary.json`,
    },
  };
}
