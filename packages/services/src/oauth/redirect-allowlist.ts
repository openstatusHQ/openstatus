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

export function isAllowedRedirectUri(redirectUri: string): boolean {
  // `URL.hash` is empty for a bare trailing `#`, so check the raw string.
  if (redirectUri.includes("#")) return false;
  let url: URL;
  try {
    url = new URL(redirectUri);
  } catch {
    return false;
  }
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
 * §3.1.2) and userinfo are never registered, so they never match.
 */
export function matchesRegisteredRedirectUri(
  registered: readonly string[],
  requested: string,
): boolean {
  if (requested.includes("#")) return false;
  if (registered.includes(requested)) return true;
  let url: URL;
  try {
    url = new URL(requested);
  } catch {
    return false;
  }
  if (url.username || url.password) return false;
  if (!isLoopbackHost(url.hostname.toLowerCase())) return false;
  const protocol = url.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") return false;
  return registered.some((entry) => {
    let candidate: URL;
    try {
      candidate = new URL(entry);
    } catch {
      return false;
    }
    return (
      candidate.protocol.toLowerCase() === protocol &&
      candidate.hostname.toLowerCase() === url.hostname.toLowerCase() &&
      candidate.pathname === url.pathname &&
      candidate.search === url.search
    );
  });
}
