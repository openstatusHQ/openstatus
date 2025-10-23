"use client";

import { ThemeSelect } from "@/components/themes/theme-select";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { THEMES, THEME_KEYS } from "@openstatus/theme-store";
import { Check, ChevronsUpDown, Palette } from "lucide-react";
import { useEffect } from "react";
import { useState } from "react";
import { useStatusPage } from "./floating-button";

export const COMMUNITY_THEME = THEME_KEYS;
export type CommunityTheme = (typeof COMMUNITY_THEME)[number];

export function FloatingTheme({ className }: { className?: string }) {
  const { communityTheme, setCommunityTheme } = useStatusPage();
  const [display, setDisplay] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const enabled = sessionStorage.getItem("community-theme") === "true";
    const host = window.location.host;
    if (
      (host.includes("localhost") ||
        host.includes("stpg.dev") ||
        host.includes("openstatus.dev") ||
        host.includes("vercel.app")) &&
      enabled
    ) {
      setDisplay(true);
      setOpen(true);
    }
  }, []);

  if (!display) return null;

  return (
    <div className={cn("fixed right-4 bottom-4 z-50", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button size="icon" className="size-12 rounded-full">
            <Palette className="size-5" />
            <span className="sr-only">Open theme settings</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="space-y-4 p-4">
            <div className="space-y-2">
              <h4 className="font-medium leading-none">Theme Settings</h4>
              <p className="text-muted-foreground text-sm">
                Test community themes on the status page.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="theme">Theme Mode</Label>
              <ThemeSelect id="theme" className="w-full" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="community-theme">Community Theme</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="community-theme"
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal"
                  >
                    {THEMES[communityTheme].name}
                    <ChevronsUpDown className="opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0">
                  <Command>
                    <CommandInput
                      placeholder="Search themes..."
                      className="h-9"
                    />
                    <CommandList>
                      <CommandEmpty>No themes found.</CommandEmpty>
                      <CommandGroup>
                        {COMMUNITY_THEME.map((theme) => (
                          <CommandItem
                            value={theme}
                            key={theme}
                            onSelect={(v) =>
                              setCommunityTheme(v as CommunityTheme)
                            }
                          >
                            <span className="truncate">
                              {THEMES[theme].name}
                            </span>
                            <span className="truncate font-commit-mono text-muted-foreground text-xs">
                              by {THEMES[theme].author.name}
                            </span>
                            <Check
                              className={cn(
                                "ml-auto",
                                theme === communityTheme
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
