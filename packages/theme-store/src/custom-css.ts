import type { ThemeDefinition } from "./types";
import { THEME_VAR_NAMES } from "./types";

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

export type CustomCssValidation =
  | { valid: true }
  | { valid: false; errors: string[] };

// Comments and quoted strings may legitimately contain braces — drop them
// before checking balance.
function stripCommentsAndStrings(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, "");
}

/** Structural validation for user-authored custom CSS; empty input is valid. */
export function validateCustomCss(customCss: string): CustomCssValidation {
  const errors: string[] = [];

  if (customCss.length > CUSTOM_CSS_MAX_LENGTH) {
    errors.push(
      `Custom CSS must be at most ${CUSTOM_CSS_MAX_LENGTH} characters.`,
    );
  }

  if (customCss.includes("<")) {
    errors.push("Custom CSS must not contain the '<' character.");
  }

  const stripped = stripCommentsAndStrings(customCss);
  let depth = 0;
  for (const char of stripped) {
    if (char === "{") depth++;
    if (char === "}") depth--;
    if (depth < 0) break;
  }
  if (depth !== 0) {
    errors.push("Custom CSS has unbalanced curly braces.");
  }

  if (depth === 0 && stripped.trim().length > 0 && !stripped.includes("{")) {
    errors.push(
      "Custom CSS must contain declaration blocks, e.g. :root { --primary: red; }.",
    );
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

/**
 * A `:root` / `.dark` skeleton listing every supported CSS variable,
 * pre-filled with the given theme's values (empty where the theme has none).
 * Used as the editor placeholder in the dashboard.
 */
export function generateCustomCssTemplate(theme?: ThemeDefinition): string {
  const block = (vars: ThemeDefinition["light"]) =>
    THEME_VAR_NAMES.map((name) => `  ${name}: ${vars?.[name] ?? ""};`).join(
      "\n",
    );
  return `:root {\n${block(theme?.light ?? {})}\n}\n\n.dark {\n${block(
    theme?.dark ?? {},
  )}\n}`;
}
