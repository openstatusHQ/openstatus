"use client";

import {
  StatusThemeSwitcher as BlockThemeSwitcher,
  StatusThemeSwitcherSkeleton,
  type ThemeValue,
} from "@openstatus/ui/components/blocks/status-theme-switcher";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

function isThemeValue(value: string | undefined): value is ThemeValue {
  return value === "light" || value === "dark" || value === "system";
}

export function ThemeSwitcher({
  className,
  ...props
}: Omit<
  React.ComponentProps<typeof BlockThemeSwitcher>,
  "value" | "onValueChange"
>) {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <StatusThemeSwitcherSkeleton className={className} />;
  }

  const value: ThemeValue = isThemeValue(theme) ? theme : "system";

  return (
    <BlockThemeSwitcher
      value={value}
      onValueChange={setTheme}
      className={className}
      {...props}
    />
  );
}
