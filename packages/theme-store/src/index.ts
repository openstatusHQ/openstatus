export * from "./types";
import { GITHUB_CONTRAST } from "./github-contrast";
import { SUPABASE } from "./supabase";
import type { Theme, ThemeMap } from "./types";

const DEFAULT_THEME = {
  id: "default" as const,
  name: "Default",
  author: { name: "@openstatus", url: "https://openstatus.dev" },
  light: {},
  dark: {},
} as const satisfies Theme;

// TODO: Add validation to ensure that the theme IDs are unique
const THEMES_LIST = [
  DEFAULT_THEME,
  GITHUB_CONTRAST,
  SUPABASE,
] satisfies Theme[];

export const THEMES = THEMES_LIST.reduce<ThemeMap>((acc, theme) => {
  acc[theme.id as keyof ThemeMap] = theme;
  return acc;
}, {} as ThemeMap);

export const THEME_KEYS = THEMES_LIST.map((theme) => theme.id);
