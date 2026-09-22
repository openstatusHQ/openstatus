/**
 * `/oauth/register` is unauthenticated, so an arbitrary redirect target would
 * let anyone register a client and use it in a confused-deputy attack against
 * an openstatus user. Every entry below needs a one-line justification.
 * Third parties do not need an entry: a URL client id (see `cimd.ts`) proves
 * domain ownership instead.
 *
 * - `openstatus.dev` (+ subdomains): first-party clients.
 * - `claude.ai` (+ subdomains): Claude web connectors call back on
 *   `https://claude.ai/api/mcp/auth_callback`.
 * - `chatgpt.com` (+ subdomains): ChatGPT connectors.
 * - `cursor.com` (+ subdomains): Cursor's hosted callback.
 *
 * Loopback hosts are allowed on http or https (RFC 8252 native clients such
 * as Claude Code): a victim's loopback address cannot exfiltrate a code.
 *
 * Custom schemes are matched on scheme only; the host part is app-defined:
 * - `cursor://`: Cursor desktop.
 * - `vscode://`, `vscode-insiders://`: VS Code MCP client.
 */
export const ALLOWED_REDIRECT_HOSTS = [
  "openstatus.dev",
  "claude.ai",
  "chatgpt.com",
  "cursor.com",
] as const;

export const ALLOWED_REDIRECT_SCHEMES = [
  "cursor:",
  "vscode:",
  "vscode-insiders:",
] as const;

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1"
  );
}

function isAllowlistedHost(hostname: string): boolean {
  return ALLOWED_REDIRECT_HOSTS.some(
    (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`),
  );
}

/**
 * `URL` drops an empty userinfo (`https://@host`), so `username`/`password`
 * alone miss it. Inspect the raw authority, normalised the way `URL` does.
 */
function hasUserinfo(uri: string): boolean {
  const raw = uri.trim().replace(/[\t\n\r]/g, "");
  const authority = /^[^:/?#]+:\/\/([^/?#]*)/.exec(raw)?.[1] ?? "";
  return authority.includes("@");
}

function hasFragmentOrUserinfo(uri: string): boolean {
  // `URL.hash` is empty for a bare trailing `#`, so check the raw string.
  return uri.includes("#") || hasUserinfo(uri);
}

export function isAllowedRedirectUri(redirectUri: string): boolean {
  // RFC 6749 §3.1.2 forbids fragments; credentials have no legitimate use.
  if (hasFragmentOrUserinfo(redirectUri)) return false;
  let url: URL;
  try {
    url = new URL(redirectUri);
  } catch {
    return false;
  }
  if (url.username || url.password) return false;
  const protocol = url.protocol.toLowerCase();
  if ((ALLOWED_REDIRECT_SCHEMES as readonly string[]).includes(protocol)) {
    return true;
  }

  const hostname = url.hostname.toLowerCase();
  if (isLoopbackHost(hostname)) {
    return protocol === "http:" || protocol === "https:";
  }
  return protocol === "https:" && isAllowlistedHost(hostname);
}

/**
 * RFC 8252 §7.3: native clients bind an ephemeral port, so a loopback
 * redirect matches its registered entry on everything but the port.
 * Any other URI must match a registered entry exactly. Fragments (RFC 6749
 * §3.1.2) and userinfo never match on either side: registration rejects them
 * today, and entries written before that guard must not widen the match.
 */
export function matchesRegisteredRedirectUri(
  registered: readonly string[],
  requested: string,
): boolean {
  if (hasFragmentOrUserinfo(requested)) return false;
  let url: URL;
  try {
    url = new URL(requested);
  } catch {
    return false;
  }
  if (url.username || url.password) return false;
  if (registered.includes(requested)) return true;
  if (!isLoopbackHost(url.hostname.toLowerCase())) return false;
  const protocol = url.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") return false;
  return registered.some((entry) => {
    if (hasFragmentOrUserinfo(entry)) return false;
    let candidate: URL;
    try {
      candidate = new URL(entry);
    } catch {
      return false;
    }
    return (
      !candidate.username &&
      !candidate.password &&
      candidate.protocol.toLowerCase() === protocol &&
      candidate.hostname.toLowerCase() === url.hostname.toLowerCase() &&
      candidate.pathname === url.pathname &&
      candidate.search === url.search
    );
  });
}
