"use client";

import { useIframe } from "@/hooks/use-iframe";
import { iframeThemeParser } from "@/lib/iframe-params";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { useQueryState } from "nuqs";
import type * as React from "react";

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  const iframe = useIframe();
  const [theme] = useQueryState("theme", iframeThemeParser);
  const forcedTheme = iframe.mode && theme ? theme : undefined;

  return (
    <NextThemesProvider {...props} forcedTheme={forcedTheme}>
      {children}
    </NextThemesProvider>
  );
}
