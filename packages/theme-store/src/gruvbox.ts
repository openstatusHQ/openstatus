// https://github.com/morhetz/gruvbox — medium contrast, dark and light variants

import type { Theme } from "./types";

export const GRUVBOX_THEME = {
  id: "gruvbox",
  name: "Gruvbox",
  author: { name: "@pat-s", url: "https://github.com/pat-s" },
  light: {
    "--radius": "0.25rem",

    "--background": "oklch(95.55% 0.0555 96.15)", // #fbf1c7 light0
    "--foreground": "oklch(34.41% 0.0066 48.52)", // #3c3836 dark1
    "--card": "oklch(96.55% 0.0394 100.86)", // #f9f5d7 light0_hard
    "--card-foreground": "var(--foreground)",
    "--popover": "var(--card)",
    "--popover-foreground": "var(--foreground)",
    "--border": "oklch(82.55% 0.0507 85.12)", // #d5c4a1 light2
    "--input": "oklch(75.64% 0.041 82.28)", // #bdae93 light3
    "--ring": "var(--primary)",

    "--primary": "oklch(51.26% 0.1616 39.3)", // #af3a03 neutral orange
    "--primary-foreground": "var(--background)",
    "--secondary": "oklch(89.41% 0.0566 89.24)", // #ebdbb2 light1
    "--secondary-foreground": "var(--foreground)",
    "--muted": "var(--secondary)",
    // NOTE: the palette's muted tones are too light on light0 for body-adjacent
    // text — light4 (#a89984) reaches 2.5:1 and dark4 (#7c6f64) 4.3:1 — so
    // dark3 (#665c54) is used instead, at 5.7:1.
    "--muted-foreground": "oklch(48.18% 0.0181 61.04)", // #665c54 dark3
    "--accent": "var(--secondary)",
    "--accent-foreground": "var(--foreground)",

    "--success": "oklch(54.63% 0.1124 106.46)", // #79740e neutral green
    "--destructive": "oklch(43.74% 0.1789 28.26)", // #9d0006 neutral red
    "--warning": "oklch(61.76% 0.1277 70.67)", // #b57614 neutral yellow
    "--info": "oklch(47.06% 0.0816 215.81)", // #076678 neutral blue
  },
  dark: {
    "--radius": "0.25rem",

    "--background": "oklch(27.68% 0 89.88)", // #282828 dark0
    "--foreground": "oklch(89.41% 0.0566 89.24)", // #ebdbb2 light1
    "--card": "oklch(34.41% 0.0066 48.52)", // #3c3836 dark1
    "--card-foreground": "var(--foreground)",
    "--popover": "var(--card)",
    "--popover-foreground": "var(--foreground)",
    "--border": "oklch(41.1% 0.0115 51.87)", // #504945 dark2
    "--input": "oklch(48.18% 0.0181 61.04)", // #665c54 dark3
    "--ring": "var(--primary)",

    "--primary": "oklch(73.11% 0.182 51.69)", // #fe8019 bright orange
    "--primary-foreground": "var(--background)",
    "--secondary": "oklch(41.1% 0.0115 51.87)", // #504945 dark2
    "--secondary-foreground": "var(--foreground)",
    "--muted": "var(--secondary)",
    "--muted-foreground": "oklch(75.64% 0.041 82.28)", // #bdae93 light3
    "--accent": "var(--secondary)",
    "--accent-foreground": "var(--foreground)",

    "--success": "oklch(76.52% 0.1581 110.83)", // #b8bb26 bright green
    "--destructive": "oklch(65.97% 0.2175 30.39)", // #fb4934 bright red
    "--warning": "oklch(83.25% 0.1595 82.99)", // #fabd2f bright yellow
    "--info": "oklch(69.27% 0.042 169.77)", // #83a598 bright blue
  },
} as const satisfies Theme;
