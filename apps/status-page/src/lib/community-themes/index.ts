export * from "./types";
import { github } from "./github";
import { supabase } from "./supabase";
import type { ThemeMap } from "./types";

export const THEMES = {
  default: {
    name: "Default",
    author: { name: "@openstatus", url: "https://openstatus.dev" },
    light: {},
    dark: {},
  },
  github,
  supabase,
} as const satisfies ThemeMap;

export const THEME_KEYS = Object.keys(THEMES) as Array<keyof typeof THEMES>;
