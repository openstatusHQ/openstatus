export const THEME_VAR_NAMES = [
  "--radius",
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--destructive",
  "--border",
  "--input",
  "--ring",
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
  "--sidebar",
  "--sidebar-foreground",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
  "--sidebar-border",
  "--sidebar-ring",
  "--success",
  "--warning",
  "--info",
  "--rainbow-1",
  "--rainbow-2",
  "--rainbow-3",
  "--rainbow-4",
  "--rainbow-5",
  "--rainbow-6",
  "--rainbow-7",
  "--rainbow-8",
  "--rainbow-9",
  "--rainbow-10",
  "--rainbow-11",
  "--rainbow-12",
  "--rainbow-13",
  "--rainbow-14",
  "--rainbow-15",
  "--rainbow-16",
  "--rainbow-17",
] as const;

export type ThemeVarName = (typeof THEME_VAR_NAMES)[number];
export type ThemeVars = Partial<Record<ThemeVarName, string>>;
export type ThemeMode = "light" | "dark";

export interface ThemeDefinition {
  light: ThemeVars;
  dark: ThemeVars;
}

export interface ThemeInfo {
  id: string;
  name: string;
  author: { name: string; url: string };
}

export type Theme = ThemeInfo & ThemeDefinition;
export type ThemeMap = Record<string, Theme>;
