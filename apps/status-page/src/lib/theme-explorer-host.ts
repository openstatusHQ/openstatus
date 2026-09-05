import { stripHostPort } from "./domain";

/** The only host the theme explorer is published on. */
export const THEME_EXPLORER_HOST = "themes.openstatus.dev";
export const THEME_EXPLORER_URL = `https://${THEME_EXPLORER_HOST}`;

/** The only page the explorer host serves, at `/status/{locale}`. */
export const THEME_EXPLORER_PAGE_SLUG = "status";

// The explorer lives at `/`, which is also where every unresolved host lands
// (unknown slug, custom domain pointed at us but missing from `page`). Without
// this allowlist those hosts render — and share — the explorer as their 404.
// `stpg.dev` is the internal origin every proxied host is rewritten to; it stays
// allowed so the explorer still renders if the proxy drops `x-forwarded-host`,
// but only the canonical host is indexable.
const ALLOWED_HOSTS = [
  THEME_EXPLORER_HOST,
  "stpg.dev",
  "www.stpg.dev",
  "localhost",
];

export function isThemeExplorerHost(host?: string | null) {
  const hostname = stripHostPort(host)?.toLowerCase();
  if (!hostname) return false;
  return ALLOWED_HOSTS.includes(hostname) || hostname.endsWith(".vercel.app");
}

export function isCanonicalThemeExplorerHost(host?: string | null) {
  return stripHostPort(host)?.toLowerCase() === THEME_EXPLORER_HOST;
}
