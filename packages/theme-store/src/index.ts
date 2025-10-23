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
