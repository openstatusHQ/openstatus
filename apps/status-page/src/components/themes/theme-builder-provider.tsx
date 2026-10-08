"use client";

import { THEMES, type Theme } from "@openstatus/theme-store";
import { useQueryStates } from "nuqs";
import { createContext, useContext, useEffect, useState } from "react";

import { searchParamsParsers } from "../../app/(public)/search-params";

interface ThemeBuilderContextType {
  /** Theme in the builder: the selected theme plus the user's edits. */
  theme: Theme;
  setTheme: React.Dispatch<React.SetStateAction<Theme>>;
  /** True once the builder theme differs from the selected registered theme. */
  isModified: boolean;
  reset: () => void;
}

const ThemeBuilderContext = createContext<ThemeBuilderContextType | null>(null);

export function useThemeBuilder() {
  const context = useContext(ThemeBuilderContext);
  if (!context) {
    throw new Error("useThemeBuilder must be used within ThemeBuilderProvider");
  }
  return context;
}

export function ThemeBuilderProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [{ t }] = useQueryStates(searchParamsParsers);
  const [theme, setTheme] = useState<Theme>(THEMES[t]);

  useEffect(() => {
    setTheme(THEMES[t]);
  }, [t]);

  const isModified = JSON.stringify(theme) !== JSON.stringify(THEMES[t]);

  return (
    <ThemeBuilderContext.Provider
      value={{ theme, setTheme, isModified, reset: () => setTheme(THEMES[t]) }}
    >
      {children}
    </ThemeBuilderContext.Provider>
  );
}
