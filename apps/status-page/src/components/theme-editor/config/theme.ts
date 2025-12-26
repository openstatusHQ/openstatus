import type { ThemeEditorState } from "../types/editor";
import type { ThemeStyles } from "../types/theme";
import { defaultPresets } from "../utils/theme-presets";

// these are common between light and dark modes
// we can assume that light mode's value will be used for dark mode as well
export const COMMON_STYLES = [
  "font-sans",
  "font-serif",
  "font-mono",
  "radius",
  "shadow-opacity",
  "shadow-blur",
  "shadow-spread",
  "shadow-offset-x",
  "shadow-offset-y",
  "letter-spacing",
  "spacing",
];

export const DEFAULT_FONT_SANS =
  "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'";

export const DEFAULT_FONT_SERIF =
  'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif';

export const DEFAULT_FONT_MONO =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

// // Default light theme styles (converted from OKLCH to hex for browser compatibility)
// export const defaultLightThemeStyles = {
//   background: "#ffffff",
//   foreground: "#0a0a0a",
//   card: "#ffffff",
//   "card-foreground": "#0a0a0a",
//   popover: "#ffffff",
//   "popover-foreground": "#0a0a0a",
//   primary: "#171717",
//   "primary-foreground": "#fafafa",
//   secondary: "#f5f5f5",
//   "secondary-foreground": "#171717",
//   muted: "#f5f5f5",
//   "muted-foreground": "#737373",
//   accent: "#f5f5f5",
//   "accent-foreground": "#171717",
//   destructive: "#e7000b",
//   "destructive-foreground": "#ffffff",
//   border: "#e5e5e5",
//   input: "#e5e5e5",
//   ring: "#a1a1a1",
//   "chart-1": "#91c5ff",
//   "chart-2": "#3a81f6",
//   "chart-3": "#2563ef",
//   "chart-4": "#1a4eda",
//   "chart-5": "#1f3fad",
//   radius: "0.625rem",
//   sidebar: "#fafafa",
//   "sidebar-foreground": "#0a0a0a",
//   "sidebar-primary": "#171717",
//   "sidebar-primary-foreground": "#fafafa",
//   "sidebar-accent": "#f5f5f5",
//   "sidebar-accent-foreground": "#171717",
//   "sidebar-border": "#e5e5e5",
//   "sidebar-ring": "#a1a1a1",
//   "font-sans": DEFAULT_FONT_SANS,
//   "font-serif": DEFAULT_FONT_SERIF,
//   "font-mono": DEFAULT_FONT_MONO,

//   "shadow-color": "#000000",
//   "shadow-opacity": "0.1",
//   "shadow-blur": "3px",
//   "shadow-spread": "0px",
//   "shadow-offset-x": "0",
//   "shadow-offset-y": "1px",

//   "letter-spacing": "0em",
//   spacing: "0.25rem",
// };

// // Default dark theme styles (converted from OKLCH to hex for browser compatibility)
// export const defaultDarkThemeStyles = {
//   ...defaultLightThemeStyles,
//   background: "#0a0a0a",
//   foreground: "#fafafa",
//   card: "#171717",
//   "card-foreground": "#fafafa",
//   popover: "#262626",
//   "popover-foreground": "#fafafa",
//   primary: "#e5e5e5",
//   "primary-foreground": "#171717",
//   secondary: "#262626",
//   "secondary-foreground": "#fafafa",
//   muted: "#262626",
//   "muted-foreground": "#a1a1a1",
//   accent: "#404040",
//   "accent-foreground": "#fafafa",
//   destructive: "#ff6467",
//   "destructive-foreground": "#fafafa",
//   border: "#282828",
//   input: "#343434",
//   ring: "#737373",
//   "chart-1": "#91c5ff",
//   "chart-2": "#3a81f6",
//   "chart-3": "#2563ef",
//   "chart-4": "#1a4eda",
//   "chart-5": "#1f3fad",
//   radius: "0.625rem",
//   sidebar: "#171717",
//   "sidebar-foreground": "#fafafa",
//   "sidebar-primary": "#1447e6",
//   "sidebar-primary-foreground": "#fafafa",
//   "sidebar-accent": "#262626",
//   "sidebar-accent-foreground": "#fafafa",
//   "sidebar-border": "#282828",
//   "sidebar-ring": "#525252",

//   "shadow-color": "#000000",

//   "letter-spacing": "0em",
//   spacing: "0.25rem",
// };

export const defaultLightThemeStyles =
  defaultPresets["modern-minimal"]?.styles?.light;
export const defaultDarkThemeStyles =
  defaultPresets["modern-minimal"]?.styles?.dark;

// Default theme state
export const defaultThemeState: ThemeEditorState = {
  styles: {
    light: defaultLightThemeStyles as ThemeStyles["light"],
    dark: defaultDarkThemeStyles as ThemeStyles["dark"],
  },
  currentMode:
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light",
  hslAdjustments: {
    hueShift: 0,
    saturationScale: 1,
    lightnessScale: 1,
  },
};
