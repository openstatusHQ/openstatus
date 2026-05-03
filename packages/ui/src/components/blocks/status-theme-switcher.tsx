"use client";

import { useStatusBlocksLabels } from "@openstatus/ui/components/blocks/status-i18n";
import {
  THEME_VALUES,
  type ThemeValue,
} from "@openstatus/ui/components/blocks/status.types";
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

export type { ThemeValue };

function ThemeIcon({
  value,
  className,
}: {
  value: ThemeValue;
  className?: string;
}) {
  const Icon = value === "light" ? Sun : value === "dark" ? Moon : Laptop;
  return <Icon className={cn("h-4 w-4", className)} />;
}

/**
 * StatusThemeSwitcher — agnostic light/dark/system switcher.
 *
 * Pure presentation: caller owns the value and onValueChange wiring (next-themes,
 * form state, etc.). The block does no hydration handling — render a Skeleton
 * yourself before the active theme is known.
 */
export function StatusThemeSwitcher({
  value,
  onValueChange,
  className,
  ...props
}: Omit<
  React.ComponentProps<typeof DropdownMenuTrigger>,
  "value" | "onValueChange"
> & {
  value: ThemeValue;
  onValueChange: (value: ThemeValue) => void;
}) {
  const labels = useStatusBlocksLabels();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild className={className} {...props}>
        <Button data-slot="status-theme-switcher" variant="ghost" size="icon">
          <ThemeIcon value={value} />
          <span className="sr-only">{labels.ariaToggleTheme}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" alignOffset={-4}>
        {THEME_VALUES.map((v) => {
          const isActive = v === value;
          return (
            <DropdownMenuItem
              data-slot="status-theme-switcher-item"
              key={v}
              onClick={() => onValueChange(v)}
            >
              <span>{labels.themeNames[v]}</span>
              <span className="ml-auto">
                <ThemeIcon
                  value={v}
                  className={
                    isActive ? "text-foreground" : "text-muted-foreground"
                  }
                />
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * StatusThemeSwitcherSkeleton — same footprint as the trigger button.
 * Render while the active theme isn't known yet (e.g. before next-themes
 * hydrates) so the surrounding layout doesn't shift.
 */
export function StatusThemeSwitcherSkeleton({
  className,
  ...props
}: React.ComponentProps<typeof Skeleton>) {
  return (
    <Skeleton
      data-slot="status-theme-switcher-skeleton"
      className={cn("size-9", className)}
      {...props}
    />
  );
}
