export const WORKSPACE_SLUG_COOKIE = "workspace-slug";

// Client-side workspace switch: set the cookie the proxy reads, then hard-reload
// so every server component re-resolves against the new workspace.
export function switchWorkspace(slug: string) {
  document.cookie = `${WORKSPACE_SLUG_COOKIE}=${slug}; path=/;`;
  window.location.href = "/overview";
}
