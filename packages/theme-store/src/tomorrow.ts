// https://github.com/chriskempson/tomorrow-theme
// Light: Tomorrow. Dark: Tomorrow Night Eighties.

import type { Theme } from "./types";

export const TOMORROW_THEME = {
  id: "tomorrow",
  name: "Tomorrow",
  author: { name: "@pat-s", url: "https://github.com/pat-s" },
  light: {
    "--radius": "0.25rem",

    "--background": "oklch(100% 0 89.88)", // #ffffff Background
    "--foreground": "oklch(41.99% 0.0016 106.47)", // #4d4d4c Foreground
    "--card": "var(--background)",
    "--card-foreground": "var(--foreground)",
    "--popover": "var(--background)",
    "--popover-foreground": "var(--foreground)",
    "--border": "oklch(87.61% 0 89.88)", // #d6d6d6 Selection
    "--input": "var(--border)",
    "--ring": "var(--primary)",

    // NOTE: Tomorrow's orange (#f5871f) reaches only 4.3:1 on the background,
    // so it is darkened one step for button and link text.
    "--primary": "oklch(54.5% 0.1372 51.5)",
    "--primary-foreground": "var(--background)",
    "--secondary": "oklch(95.21% 0 89.88)", // #efefef Current Line
    "--secondary-foreground": "var(--foreground)",
    "--muted": "var(--secondary)",
    "--muted-foreground": "oklch(55.05% 0.0054 128.57)", // #8e908c Comment
    "--accent": "var(--secondary)",
    "--accent-foreground": "var(--foreground)",

    "--success": "oklch(59.74% 0.1452 122.21)", // #718c00 Green
    "--destructive": "oklch(54.23% 0.1955 26.51)", // #c82829 Red
    "--warning": "oklch(80.29% 0.1641 88.34)", // #eab700 Yellow
    "--info": "oklch(54.37% 0.109 255.62)", // #4271ae Blue
  },
  dark: {
    "--radius": "0.25rem",

    "--background": "oklch(29.72% 0 89.88)", // #2d2d2d Background
    "--foreground": "oklch(84.52% 0 89.88)", // #cccccc Foreground
    "--card": "oklch(34.46% 0 89.88)", // #393939 Current Line
    "--card-foreground": "var(--foreground)",
    "--popover": "var(--card)",
    "--popover-foreground": "var(--foreground)",
    "--border": "oklch(43.49% 0 89.88)", // #515151 Selection
    "--input": "var(--border)",
    "--ring": "var(--primary)",

    "--primary": "oklch(75.62% 0.1455 48.5)", // #f99157 Orange
    "--primary-foreground": "var(--background)",
    "--secondary": "var(--card)",
    "--secondary-foreground": "var(--foreground)",
    "--muted": "var(--card)",
    "--muted-foreground": "oklch(68.3% 0 89.88)", // #999999 Comment
    "--accent": "var(--border)",
    "--accent-foreground": "var(--foreground)",

    "--success": "oklch(79.6% 0.0889 144.68)", // #99cc99 Green
    "--destructive": "oklch(71.26% 0.1515 20.16)", // #f2777a Red
    "--warning": "oklch(87.07% 0.1325 82.74)", // #ffcc66 Yellow
    "--info": "oklch(66.76% 0.0939 249.39)", // #6699cc Blue
  },
} as const satisfies Theme;
