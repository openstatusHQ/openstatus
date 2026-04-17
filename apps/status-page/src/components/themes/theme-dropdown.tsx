"use client";

import { useTheme } from "next-themes";
import type * as React from "react";

import { Button } from "@openstatus/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@openstatus/ui/components/ui/dropdown-menu";
import { Skeleton } from "@openstatus/ui/components/ui/skeleton";
import { cn } from "@openstatus/ui/lib/utils";
import { Laptop, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { useEffect } from "react";

function getThemeIcon(theme?: string | null, className?: string) {
  if (theme === "light") return <Sun className={cn("h-4 w-4", className)} />;
  if (theme === "dark") return <Moon className={cn("h-4 w-4", className)} />;
  if (theme === "system")
    return <Laptop className={cn("h-4 w-4", className)} />;
  return null;
}

export function ThemeDropdown({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuTrigger>) {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <Skeleton className={cn("size-9", className)} />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(className)} asChild {...props}>
        <Button variant="ghost" size="icon">
          {getThemeIcon(theme ?? "system")}
          <span className="sr-only">{theme ?? "system"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" alignOffset={-4}>
        {["light", "dark", "system"].map((t) => {
          const isActive = t === theme;
          return (
            <DropdownMenuItem key={t} onClick={() => setTheme(t)}>
              <span className="capitalize">{t}</span>
              <span className={cn("ml-auto")}>
                {getThemeIcon(
                  t,
                  isActive ? "text-foreground" : "text-muted-foreground",
                )}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
