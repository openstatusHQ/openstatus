"use client";

import { useTheme } from "next-themes";
import type * as React from "react";

import { Laptop, Moon, Sun } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

export function ThemeToggle({
  className,
  ...props
}: React.ComponentProps<typeof SelectTrigger>) {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // NOTE: hydration error if we don't do this
  if (!mounted) {
    return (
      <Select>
        <SelectTrigger className={cn("w-[180px]", className)} {...props}>
          <SelectValue placeholder="Select theme" />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select value={theme} onValueChange={setTheme}>
      <SelectTrigger className={cn("w-[180px]", className)} {...props}>
        <SelectValue defaultValue={theme} placeholder="Select theme" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="light">
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4" />
            <span>Light</span>
          </div>
        </SelectItem>
        <SelectItem value="dark">
          <div className="flex items-center gap-2">
            <Moon className="h-4 w-4" />
            <span>Dark</span>
          </div>
        </SelectItem>
        <SelectItem value="system">
          <div className="flex items-center gap-2">
            <Laptop className="h-4 w-4" />
            <span>System</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
