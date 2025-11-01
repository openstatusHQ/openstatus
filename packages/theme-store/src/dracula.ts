// https://draculatheme.com/spec

import type { Theme } from "./types";

export const DRACULA_THEME = {
  id: "dracula",
  name: "Dracula",
  author: { name: "@thibaultleouay", url: "https://thibaultleouay.dev" },
  light: {
    "--background": "#FFFBEB", // Background
    "--foreground": "#1F1F1F", // Foreground
    "--border": "#6C664B", // Current Line
    "--input": "var(--border)", // Current Line

    "--primary": "var(--foreground)",
    "--primary-foreground": "var(--background)",
    "--secondary": "var(--muted)",
    "--secondary-foreground": "var(--accent-foreground)",
    "--muted": "#CFCFDE", // Section
    "--muted-foreground": "#6C664B", // NOTE: non standard color for improved readability
    "--accent": "var(--muted)",
    "--accent-foreground": "var(--foreground)",

    "--success": "#14710a", // Green
    "--destructive": "#cb3a2a", // Red
    "--warning": "#A34D14", // Orange
    "--info": "#644AC9", // Purple

    "--chart-1": "#A3144D", // Pink
    "--chart-2": "#A34D14", // Orange
    "--chart-3": "#846E15", // Yellow
    "--chart-4": "#14710a", // Green
    "--chart-5": "#036A96", // Cyan

    "--popover-foreground": "var(--foreground)",
    "--popover": "var(--background)",
    "--card": "var(--background)",
    "--card-foreground": "var(--foreground)",
  },
  dark: {
    "--background": "#282a36", // Background
    "--foreground": "#f8f8f2", // Foreground
    "--border": "#6272A4", // Current Line
    "--input": "var(--border)", // Current Line

    "--primary": "var(--foreground)",
    "--primary-foreground": "var(--background)",
    "--secondary": "var(--muted)",
    "--secondary-foreground": "var(--accent-foreground)",
    "--muted": "#44475A", // Section
    "--muted-foreground": "#A6ACCD", // NOTE: non standard color for improved readability
    "--accent": "var(--muted)",
    "--accent-foreground": "var(--foreground)",

    "--success": "#50fa7b", // Green
    "--destructive": "#ff5555", // Red
    "--warning": "#ffb86c", // Orange
    "--info": "#644AC9", // Purple

    "--chart-1": "#ff79c6", // Pink
    "--chart-2": "#ffb86c", // Orange
    "--chart-3": "#f1fa8c", // Yellow
    "--chart-4": "#50fa7b", // Green
    "--chart-5": "#036A96", // Cyan

    "--popover-foreground": "var(--foreground)",
    "--popover": "var(--background)",
    "--card": "var(--background)",
    "--card-foreground": "var(--foreground)",
  },
} as const satisfies Theme;
