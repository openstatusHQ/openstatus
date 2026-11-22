export const WORKSPACE_SLUG_COOKIE = "workspace-slug";

// Persistent on purpose: a session cookie is dropped when mobile browsers evict
// the tab, silently falling back to the user's first workspace.
export const WORKSPACE_SLUG_MAX_AGE = 60 * 60 * 24 * 365;

// Client-side workspace switch: set the cookie the proxy reads, then hard-reload
// so every server component re-resolves against the new workspace.
export function switchWorkspace(slug: string, href = "/overview") {
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${WORKSPACE_SLUG_COOKIE}=${slug}; path=/; max-age=${WORKSPACE_SLUG_MAX_AGE}; samesite=lax${secure}`;
  window.location.href = href;
}
