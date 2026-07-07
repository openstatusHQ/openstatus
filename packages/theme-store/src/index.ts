export * from "./custom-css";
export * from "./types";
import { hasCustomCss, sanitizeCustomCss } from "./custom-css";
import { DRACULA_THEME } from "./dracula";
import { GITHUB_HIGH_CONTRAST_THEME } from "./github";
import { OPENSTATUS_ROUNDED_THEME, OPENSTATUS_THEME } from "./openstatus";
import { SUPABASE_THEME } from "./supabase";
import type { Theme, ThemeDefinition, ThemeMap } from "./types";
import { assertUniqueThemeIds } from "./utils";
// Please keep the themes ordered :)
const THEMES_LIST = [
  OPENSTATUS_THEME,
  OPENSTATUS_ROUNDED_THEME,
  SUPABASE_THEME,
  GITHUB_HIGH_CONTRAST_THEME,
  DRACULA_THEME,
] satisfies Theme[];

// NOTE: runtime validation to ensure that the theme IDs are unique
assertUniqueThemeIds(THEMES_LIST);

export const THEMES = THEMES_LIST.reduce<ThemeMap>((acc, theme) => {
  acc[theme.id as keyof ThemeMap] = theme;
  return acc;
}, {} as ThemeMap);

export const THEME_KEYS = THEMES_LIST.map((theme) => theme.id);
export type ThemeKey = (typeof THEME_KEYS)[number];

export function generateThemeStyles(
  themeKey?: string,
  overrides?: Partial<ThemeDefinition>,
) {
  let theme = themeKey ? THEMES[themeKey] : undefined;

  if (!theme) {
    // NOTE: fallback to openstatus theme if no theme is found
    theme = OPENSTATUS_THEME;
  }

  const lightVars = Object.entries({ ...theme.light, ...overrides?.light })
    .map(([key, value]) => `${key}: ${value};`)
    .join("\n    ");
  const darkVars = Object.entries({ ...theme.dark, ...overrides?.dark })
    .map(([key, value]) => `${key}: ${value};`)
    .join("\n    ");

  return `
      :root {
        ${lightVars}
      }
      .dark {
        ${darkVars}
      }
    `;
}

/**
 * Styles for a status page: the configured theme, with the page's custom CSS
 * appended after it so custom declarations win the cascade (custom-css > theme).
 */
export function generatePageStyles({
  themeKey,
  customCss,
  overrides,
}: {
  themeKey?: string;
  customCss?: string | null;
  overrides?: Partial<ThemeDefinition>;
}) {
  const themeStyles = generateThemeStyles(themeKey, overrides);
  if (!hasCustomCss(customCss)) return themeStyles;
  return `${themeStyles}\n${sanitizeCustomCss(customCss)}`;
}
