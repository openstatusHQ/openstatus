// Hard cap on stored custom CSS — enforced again by the write-path zod schemas.
export const CUSTOM_CSS_MAX_LENGTH = 10_000;

export function hasCustomCss(
  customCss: string | null | undefined,
): customCss is string {
  return typeof customCss === "string" && customCss.trim().length > 0;
}

// "<" has no valid use in CSS. Stripping it makes it impossible to break out
// of the inline <style> tag the status page renders the CSS into
// (e.g. via an injected "</style><script>").
export function sanitizeCustomCss(customCss: string): string {
  return customCss.replaceAll("<", "").slice(0, CUSTOM_CSS_MAX_LENGTH).trim();
}
