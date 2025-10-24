import type { Theme } from "./types";

export const GITHUB_HIGH_CONTRAST_THEME = {
  id: "github-contrast",
  name: "GitHub (High Contrast)",
  author: { name: "@openstatus", url: "https://openstatus.dev" },
  light: {
    "--background": "oklch(100% 0 0)",
    "--foreground": "oklch(24.29% 0.0045 247.86)",
    "--border": "oklch(85.86% 0.0054 251.18)",
    "--input": "oklch(85.86% 0.0054 251.18)",

    "--primary": "oklch(60.81% 0.1567 142.5)",
    "--primary-foreground": "oklch(24.29% 0.0045 247.86)",
    "--muted": "oklch(97.86% 0.0019 247.86)",
    "--muted-foreground": "oklch(40.78% 0.0056 247.86)",
    "--secondary": "oklch(97.86% 0.0019 247.86)",
    "--secondary-foreground": "oklch(24.29% 0.0045 247.86)",
    "--accent": "oklch(97.86% 0.0019 247.86)",
    "--accent-foreground": "oklch(24.29% 0.0045 247.86)",

    "--success": "oklch(60.81% 0.1567 142.5)",
    "--destructive": "oklch(58.79% 0.1577 22.18)",
    "--warning": "oklch(81.84% 0.1328 85.87)",
    "--info": "oklch(45.2% 0.1445 252.03)",
  },
  dark: {
    "--background": "oklch(10.39% 0.0194 248.34)",
    "--foreground": "oklch(100% 0 0)",
    "--border": "oklch(58.41% 0.011 252.87)",
    "--input": "oklch(58.41% 0.011 252.87)",

    "--primary": "oklch(54.34% 0.1634 145.98)",
    "--primary-foreground": "oklch(100% 0 0)",
    "--muted": "oklch(33.39% 0.0223 256.4)",
    "--muted-foreground": "oklch(79.7% 0.0169 262.74)",
    "--secondary": "oklch(33.39% 0.0223 256.4)",
    "--secondary-foreground": "oklch(100% 0 0)",
    "--accent": "oklch(33.39% 0.0223 256.4)",
    "--accent-foreground": "oklch(100% 0 0)",

    "--success": "oklch(54.34% 0.1634 145.98)",
    "--destructive": "oklch(47.1% 0.1909 25.95)",
    "--warning": "oklch(81.84% 0.1328 85.87)",
    "--info": "oklch(46.96% 0.2957 264.51)",
  },
} as const satisfies Theme;
