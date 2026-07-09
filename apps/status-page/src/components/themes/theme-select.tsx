"use client";

import { System, Dark, Light } from "@openstatus/icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui/components/ui/select";
import { Skeleton } from "@openstatus/ui/components/ui/skeleton";
import { cn } from "@openstatus/ui/lib/utils";
import { useTheme } from "next-themes";
import type * as React from "react";
import { useState } from "react";
import { useEffect } from "react";

export function ThemeSelect({
  className,
  ...props
}: React.ComponentProps<typeof SelectTrigger>) {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Skeleton
        className={cn("border-border h-9 rounded-md border", className)}
      />
    );
  }

  return (
    <Select value={theme} onValueChange={setTheme}>
      <SelectTrigger className={cn("w-full", className)} {...props}>
        <SelectValue
          className="w-full"
          defaultValue={theme}
          placeholder="Select theme"
        />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="light">
          <div className="flex items-center gap-2">
            <Light className="h-4 w-4" />
            <span>Light</span>
          </div>
        </SelectItem>
        <SelectItem value="dark">
          <div className="flex items-center gap-2">
            <Dark className="h-4 w-4" />
            <span>Dark</span>
          </div>
        </SelectItem>
        <SelectItem value="system">
          <div className="flex items-center gap-2">
            <System className="h-4 w-4" />
            <span>System</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
