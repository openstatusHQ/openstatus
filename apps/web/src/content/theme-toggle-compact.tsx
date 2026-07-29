"use client";

import { Dark, Light, System } from "@openstatus/icons";
import { useTheme } from "next-themes";
import type * as React from "react";
import { useEffect, useState } from "react";

import { cn } from "../lib/utils";

const options = [
  { value: "light", label: "Light theme", Icon: Light },
  { value: "dark", label: "Dark theme", Icon: Dark },
  { value: "system", label: "System theme", Icon: System },
] as const;

export function ThemeToggleCompact({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div
      className={cn(
        "bg-border [&>*]:bg-background flex shrink-0 items-center gap-px border",
        className,
      )}
      {...props}
    >
      {options.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          aria-label={label}
          aria-pressed={mounted ? theme === value : undefined}
          data-active={mounted ? theme === value : false}
          onClick={() => setTheme(value)}
          className="text-muted-foreground data-[active=true]:text-foreground hover:bg-muted data-[active=true]:bg-muted flex items-center justify-center p-2 transition-colors"
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
