"use client";

import { THEMES, THEME_KEYS, type ThemeKey } from "@openstatus/theme-store";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@openstatus/ui/components/ui/command";
import { FormControl } from "@openstatus/ui/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@openstatus/ui/components/ui/popover";
import { cn } from "@openstatus/ui/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";

// Color swatches shown next to each theme option. Mirrors the playground
// convention at `apps/status-page/.../public/client.tsx`.
const SWATCH_VARS = [
  "--primary",
  "--success",
  "--warning",
  "--destructive",
  "--info",
] as const;

export function ThemeSwatches({ themeKey }: { themeKey: ThemeKey }) {
  const { resolvedTheme } = useTheme();
  const theme = THEMES[themeKey] ?? THEMES.default;
  // Match the active dashboard mode so swatches stay legible against the
  // dropdown background and accurately reflect what the user will see on the
  // published page.
  const palette = resolvedTheme === "dark" ? theme.dark : theme.light;
  return (
    <div className="-space-x-1 flex shrink-0 items-center">
      {SWATCH_VARS.map((cssVar) => (
        <span
          key={cssVar}
          aria-hidden
          className="size-3 rounded-full border border-border ring-1 ring-background"
          style={{ background: palette[cssVar] }}
        />
      ))}
    </div>
  );
}

export function ThemePickerPopover({
  value,
  onChange,
}: {
  value: ThemeKey;
  onChange: (value: ThemeKey) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <FormControl>
          <Button
            variant="outline"
            role="combobox"
            className={cn(
              "w-full min-w-0 justify-between",
              !value && "text-muted-foreground",
            )}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <ThemeSwatches themeKey={value} />
              <span className="truncate">
                {THEMES[value]?.name ?? "Select a theme"}
              </span>
            </div>
            <ChevronsUpDown className="shrink-0 opacity-50" />
          </Button>
        </FormControl>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <Command>
          <CommandInput placeholder="Search themes..." className="h-9" />
          <CommandList>
            <CommandEmpty>No themes found.</CommandEmpty>
            <CommandGroup>
              {THEME_KEYS.map((key) => {
                const { name } = THEMES[key];
                return (
                  <CommandItem
                    key={key}
                    value={key}
                    keywords={[key, name]}
                    onSelect={(v) => {
                      onChange(v as ThemeKey);
                      setOpen(false);
                    }}
                  >
                    <ThemeSwatches themeKey={key} />
                    <span className="truncate">{name}</span>
                    <Check
                      className={cn(
                        "ml-auto",
                        key === value ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
