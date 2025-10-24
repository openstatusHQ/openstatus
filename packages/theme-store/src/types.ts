export const THEME_VAR_NAMES = [
  // NOTE: default shadcn/ui colors
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
  "--border",
  "--input",
  "--ring",
  "--destructive", // red, outage/error status
  // NOTE: the following colors are used for the public monitors UI to differentiate the percentiles of the response times
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",

  // NOTE: the following colors are not part of shadcn/ui, but are essential part of the status page
  "--success", // green, operational status
  "--warning", // yellow, degraded status
  "--info", // blue, monitoring status

  // NOTE: the following colors are used for the public monitors UI to differentiate the different regions
  // It is not required to add them to your custom theme, but you can if you want to.
  // DEFAULT: https://github.com/openstatusHQ/openstatus/blob/main/apps/status-page/src/app/globals.css#L98
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
