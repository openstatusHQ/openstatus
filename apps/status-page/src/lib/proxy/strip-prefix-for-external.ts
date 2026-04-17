import type { ResolvedRoute } from "../resolve-route";

/**
 * Inverse of buildExternalPath: strips the page prefix from an already-built
 * internal path when the page uses hostname routing. Used by the locale-mismatch
 * redirect, which starts from the internal rewrite path and needs to hand back
 * an external URL.
 */
export function stripPrefixForExternal(
  route: Pick<ResolvedRoute, "type" | "prefix">,
  internalPath: string,
): string {
  if (route.type !== "hostname") return internalPath;
  const leading = `/${route.prefix}`;
  return internalPath.startsWith(leading)
    ? internalPath.slice(leading.length)
    : internalPath;
}
