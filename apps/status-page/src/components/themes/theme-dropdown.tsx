"use client";

import { useTheme } from "next-themes";
import type * as React from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Laptop, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { useEffect } from "react";
import { Skeleton } from "../ui/skeleton";

function getThemeIcon(theme?: string | null) {
  if (theme === "light") return <Sun className="h-4 w-4" />;
  if (theme === "dark") return <Moon className="h-4 w-4" />;
  if (theme === "system") return <Laptop className="h-4 w-4" />;
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
        <Button variant="outline" size="icon">
          {getThemeIcon(theme ?? "system")}
          <span className="sr-only">{theme ?? "system"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {["light", "dark", "system"].map((theme) => (
          <DropdownMenuItem key={theme} onClick={() => setTheme(theme)}>
            {getThemeIcon(theme)}
            <span className="capitalize">{theme}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
