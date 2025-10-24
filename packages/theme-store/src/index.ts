export * from "./types";
import { DEFAULT_ROUNDED_THEME, DEFAULT_THEME } from "./default";
import { GITHUB_CONTRAST } from "./github-contrast";
import { SUPABASE } from "./supabase";
import type { Theme, ThemeMap } from "./types";

// TODO: Add validation to ensure that the theme IDs are unique
const THEMES_LIST = [
  DEFAULT_THEME,
  DEFAULT_ROUNDED_THEME,
  SUPABASE,
  GITHUB_CONTRAST,
] satisfies Theme[];

export const THEMES = THEMES_LIST.reduce<ThemeMap>((acc, theme) => {
  acc[theme.id as keyof ThemeMap] = theme;
  return acc;
}, {} as ThemeMap);

export const THEME_KEYS = THEMES_LIST.map((theme) => theme.id);
export type ThemeKey = (typeof THEME_KEYS)[number];

export function generateThemeStyles(themeKey: ThemeKey = "default") {
  const theme = THEMES[themeKey];
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
