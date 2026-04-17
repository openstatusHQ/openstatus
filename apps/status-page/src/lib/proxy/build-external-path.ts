import type { ResolvedRoute } from "../resolve-route";

/**
 * Builds the external-facing path for a page, accounting for routing mode.
 * - hostname routing: the slug is implicit in the host, so the suffix stands alone.
 * - pathname routing: the slug is prepended, e.g. `/acme/login`.
 *
 * Pass `suffix` as a leading-slash path segment (e.g. "/login") or "" for the page root.
 */
export function buildExternalPath(
  route: Pick<ResolvedRoute, "type" | "prefix">,
  suffix: string,
): string {
  if (route.type === "hostname") return suffix;
  return `/${route.prefix}${suffix}`;
}
