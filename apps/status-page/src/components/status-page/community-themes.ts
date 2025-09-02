export const defaultTheme = {
  light: {} as React.CSSProperties,
  dark: {} as React.CSSProperties,
} as const;

export const supabaseTheme = {
  light: {
    "--background": "oklch(99.11% 0 0)",
    "--foreground": "oklch(20.46% 0 0)",
    "--border": "oklch(90.37% 0 0)",
    "--input": "oklch(90.37% 0 0)",

    "--primary": "oklch(76.26% 0.154 159.27)",
    "--primary-foreground": "oklch(20.46% 0 0)",
    "--muted": "oklch(97.61% 0 0)",
    "--muted-foreground": "oklch(54.52% 0 0)",
    "--secondary": "oklch(97.61% 0 0)",
    "--secondary-foreground": "oklch(20.46% 0 0)",
    "--accent": "oklch(97.61% 0 0)",
    "--accent-foreground": "oklch(20.46% 0 0)",

    "--success": "oklch(76.26% 0.154 159.27)",
    "--destructive": "oklch(62.71% 0.1936 33.34)",
    "--warning": "oklch(81.69% 0.1639 75.84)",
    "--info": "oklch(61.26% 0.218 283.85)",
  } as React.CSSProperties,
  dark: {
    "--background": "oklch(18.22% 0 0)",
    "--foreground": "oklch(98.51% 0 0)",
    "--border": "oklch(30.12% 0 0)",
    "--input": "oklch(30.12% 0 0)",

    "--primary": "oklch(68.56% 0.1558 158.13)",
    "--primary-foreground": "oklch(18.22% 0 0)",
    "--muted": "oklch(26.03% 0 0)",
    "--muted-foreground": "oklch(63.01% 0 0)",
    "--secondary": "oklch(26.03% 0 0)",
    "--secondary-foreground": "oklch(98.51% 0 0)",
    "--accent": "oklch(26.03% 0 0)",
    "--accent-foreground": "oklch(98.51% 0 0)",

    "--success": "oklch(68.56% 0.1558 158.13)",
    "--destructive": "oklch(62.71% 0.1936 33.34)",
    "--warning": "oklch(70.84% 0.1523 71.24)",
    "--info": "oklch(61.26% 0.218 283.85)",
  } as React.CSSProperties,
};

export const githubTheme = {
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
  } as React.CSSProperties,
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
    "--warning": "oklch(40.97% 0.2064 289.57)",
    "--info": "oklch(46.96% 0.2957 264.51)",
  } as React.CSSProperties,
};

export const THEMES = {
  // supabase: supabaseTheme,
  default: {
    name: "Default",
    author: { name: "@openstatus", url: "https://openstatus.dev" },
    ...defaultTheme,
  },
  github: {
    name: "Github",
    author: { name: "@openstatus", url: "https://openstatus.dev" },
    ...githubTheme,
  },
  supabase: {
    name: "Supabase",
    author: { name: "@supabase", url: "https://supabase.com" },
    ...supabaseTheme,
  },
} as const satisfies Record<
  string,
  {
    name: string;
    author: { name: string; url: string };
    light: React.CSSProperties;
    dark: React.CSSProperties;
  }
>;
