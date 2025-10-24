export * from "./types";
import { GITHUB_HIGH_CONTRAST_THEME } from "./github";
import { OPENSTATUS_ROUNDED_THEME, OPENSTATUS_THEME } from "./openstatus";
import { SUPABASE_THEME } from "./supabase";
import type { Theme, ThemeMap } from "./types";

// TODO: Add validation to ensure that the theme IDs are unique
const THEMES_LIST = [
  OPENSTATUS_THEME,
  OPENSTATUS_ROUNDED_THEME,
  SUPABASE_THEME,
  GITHUB_HIGH_CONTRAST_THEME,
] satisfies Theme[];

export const THEMES = THEMES_LIST.reduce<ThemeMap>((acc, theme) => {
  acc[theme.id as keyof ThemeMap] = theme;
  return acc;
}, {} as ThemeMap);

export const THEME_KEYS = THEMES_LIST.map((theme) => theme.id);
export type ThemeKey = (typeof THEME_KEYS)[number];

export function generateThemeStyles(themeKey?: string) {
  let theme = themeKey ? THEMES[themeKey] : undefined;

  if (!theme) {
    // NOTE: fallback to openstatus theme if no theme is found
    theme = OPENSTATUS_THEME;
  }

  const lightVars = Object.entries(theme.light)
    .map(([key, value]) => `${key}: ${value};`)
    .join("\n    ");
  const darkVars = Object.entries(theme.dark)
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
