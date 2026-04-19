import type { Page } from "@openstatus/db/src/schema";
import { stripPrefixForExternal } from "./strip-prefix-for-external";
import type { Action, ComposeInput } from "./types";

type Input = Pick<ComposeInput, "route" | "requestUrl"> & {
  page: Pick<Page, "locales" | "defaultLocale">;
};

/**
 * If the page restricts locales and the current route's locale isn't in that
 * list, redirect to the page's default locale. Assumes `route` has already been
 * normalised via applyPageLocaleOverride.
 */
export function resolveLocaleAction({
  route,
  page,
  requestUrl,
}: Input): Action | null {
  if (!page.locales || page.locales.length === 0) return null;
  if (page.locales.includes(route.locale)) return null;

  const pageDefault = page.defaultLocale || "en";
  const expectedSegment = `/${route.prefix}/${route.locale}`;
  // Invariant: `rewritePath` is constructed by `resolveRoute` with the
  // `/${prefix}/${locale}` segment. If that ever changes (e.g. a new route
  // shape that doesn't embed the locale), `.replace()` would no-op and we'd
  // redirect to the same URL — so bail out here rather than emit a redirect
  // that could loop.
  if (!route.rewritePath.includes(expectedSegment)) return null;
  const redirectPath = route.rewritePath.replace(
    expectedSegment,
    `/${route.prefix}/${pageDefault}`,
  );
  // For pathname routing, use the rewrite path directly;
  // for hostname routing, strip the prefix from the redirect URL
  const externalPath = stripPrefixForExternal(route, redirectPath);
  return {
    type: "redirect",
    url: new URL(externalPath || "/", requestUrl),
    reason: "locale-mismatch-redirect",
  };
}
