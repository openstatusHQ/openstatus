"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { useQueryState } from "nuqs";
import type * as React from "react";

import { useEmbed } from "@/hooks/use-embed";
import { embedThemeParser } from "@/lib/embed-params";

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  const embed = useEmbed();
  const [theme] = useQueryState("theme", embedThemeParser);
  const forcedTheme = embed.mode && theme ? theme : undefined;

  return (
    <NextThemesProvider {...props} forcedTheme={forcedTheme}>
      {children}
    </NextThemesProvider>
  );
}
